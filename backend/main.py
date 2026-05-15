import os
import json
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import httpx
import anthropic

import models
import schemas
from database import engine, get_db
from sqlalchemy import text, inspect as sa_inspect

models.Base.metadata.create_all(bind=engine)


def _migrate():
    """Safely add any columns introduced after initial deployment."""
    with engine.connect() as conn:
        insp = sa_inspect(engine)

        recipe_cols = {c["name"] for c in insp.get_columns("recipes")}
        if "image_url" not in recipe_cols:
            conn.execute(text("ALTER TABLE recipes ADD COLUMN image_url VARCHAR(512)"))

        ing_cols = {c["name"] for c in insp.get_columns("ingredients")}
        for col in ["calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g"]:
            if col not in ing_cols:
                conn.execute(text(f"ALTER TABLE ingredients ADD COLUMN {col} FLOAT"))
        if "prep_note" not in ing_cols:
            conn.execute(text("ALTER TABLE ingredients ADD COLUMN prep_note VARCHAR(255)"))

        conn.commit()


_migrate()

app = FastAPI(title="Recipe API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USDA_API_KEY = os.getenv("USDA_API_KEY", "")
USDA_BASE = "https://api.nal.usda.gov/fdc/v1"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")

SYSTEM_PROMPT = """You are an expert recipe designer and culinary collaborator. Help users design detailed, well-crafted recipes through conversation.

Your approach:
- Ask about dietary preferences, skill level, occasion, and available ingredients if not specified
- Be specific with quantities — use grams (g) for solids, ml for liquids, tsp/tbsp for condiments and spices
- Consider flavour balance, texture, and cooking technique
- Group ingredients logically (e.g. Marinade, Sauce, Main, Garnish)

CRITICAL RULE FOR INGREDIENTS:
- The "name" field must contain ONLY the clean ingredient name as it appears in a food database — no preparation instructions.
- Any preparation method (sliced, diced, grated, finely chopped, shredded, minced, julienned, crushed, roughly torn, etc.) goes in the separate "prep_note" field.
- Correct: {"name": "Chicken Breast", "prep_note": "thinly sliced", "amount": 500, "unit": "g"}
- Wrong:   {"name": "Thinly sliced chicken breast", "amount": 500, "unit": "g"}
- Correct: {"name": "Garlic", "prep_note": "minced", "amount": 4, "unit": "cloves"}
- Wrong:   {"name": "Minced garlic", "amount": 4, "unit": "cloves"}

When you have enough information to write a complete recipe — or when the user asks for it — include it as a JSON code block in EXACTLY this format:

```json
{
  "recipe": {
    "title": "Recipe Title",
    "description": "A brief appetising description",
    "servings": 4,
    "prep_time": 20,
    "cook_time": 30,
    "notes": "Tips, storage, or variations",
    "ingredient_groups": [
      {
        "name": "Group Name",
        "order": 0,
        "ingredients": [
          {"name": "Chicken Breast", "prep_note": "thinly sliced", "amount": 500, "unit": "g"},
          {"name": "Garlic", "prep_note": "minced", "amount": 3, "unit": "cloves"},
          {"name": "Soy Sauce", "prep_note": "", "amount": 2, "unit": "tbsp"}
        ]
      }
    ],
    "method_steps": [
      {"step_number": 1, "title": "Optional title", "description": "Detailed instruction"}
    ]
  }
}
```

After outputting the recipe, ask if they would like any adjustments."""


# ── Claude recipe design ───────────────────────────────────────────────────────

class ChatRequest(schemas.BaseModel):
    messages: List[dict]


@app.post("/api/design/chat")
async def design_chat(request: ChatRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def generate():
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=request.messages,
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Ingredient search ──────────────────────────────────────────────────────────

@app.get("/api/ingredients/search")
async def search_ingredients(q: str = Query(..., min_length=2)):
    if not USDA_API_KEY:
        raise HTTPException(status_code=500, detail="USDA API key not configured")

    async with httpx.AsyncClient(timeout=8) as client:
        resp = await client.get(
            f"{USDA_BASE}/foods/search",
            params={
                "api_key": USDA_API_KEY,
                "query": q,
                "dataType": "SR Legacy,Foundation",
                "pageSize": 12,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="USDA API error")

    results = []
    for food in resp.json().get("foods", []):
        nutrients = {n["nutrientName"]: n.get("value", 0) for n in food.get("foodNutrients", [])}
        results.append({
            "fdcId": food["fdcId"],
            "name": food["description"].title(),
            "calories": round(nutrients.get("Energy", 0), 1),
            "protein": round(nutrients.get("Protein", 0), 1),
            "carbs": round(nutrients.get("Carbohydrate, by difference", 0), 1),
            "fat": round(nutrients.get("Total lipid (fat)", 0), 1),
        })
    return results


# ── Recipes ────────────────────────────────────────────────────────────────────

@app.get("/api/recipes", response_model=List[schemas.RecipeSummaryOut])
def list_recipes(search: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(models.Recipe)
    if search:
        query = query.filter(models.Recipe.title.ilike(f"%{search}%"))
    return query.order_by(models.Recipe.created_at.desc()).all()


@app.post("/api/recipes", response_model=schemas.RecipeOut, status_code=201)
def create_recipe(recipe: schemas.RecipeCreate, db: Session = Depends(get_db)):
    db_recipe = models.Recipe(
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        prep_time=recipe.prep_time,
        cook_time=recipe.cook_time,
        notes=recipe.notes,
    )
    db.add(db_recipe)
    db.flush()

    for group_data in recipe.ingredient_groups:
        db_group = models.IngredientGroup(recipe_id=db_recipe.id, name=group_data.name, order=group_data.order)
        db.add(db_group)
        db.flush()
        for ing in group_data.ingredients:
            db.add(models.Ingredient(
                group_id=db_group.id, name=ing.name, prep_note=ing.prep_note,
                amount=ing.amount, unit=ing.unit,
                calories_per_100g=ing.calories_per_100g, protein_per_100g=ing.protein_per_100g,
                carbs_per_100g=ing.carbs_per_100g, fat_per_100g=ing.fat_per_100g,
            ))

    for step in recipe.method_steps:
        db.add(models.MethodStep(
            recipe_id=db_recipe.id, step_number=step.step_number,
            title=step.title, description=step.description,
        ))

    macros = _resolve_macros(recipe)
    db.add(models.Macros(recipe_id=db_recipe.id, **macros))

    db.commit()
    db.refresh(db_recipe)

    import threading
    threading.Thread(target=_attach_pexels_image, args=(db_recipe.id, recipe.title), daemon=True).start()

    return db_recipe


@app.get("/api/recipes/{recipe_id}", response_model=schemas.RecipeOut)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@app.put("/api/recipes/{recipe_id}", response_model=schemas.RecipeOut)
def update_recipe(recipe_id: int, recipe: schemas.RecipeUpdate, db: Session = Depends(get_db)):
    db_recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    db_recipe.title = recipe.title
    db_recipe.description = recipe.description
    db_recipe.servings = recipe.servings
    db_recipe.prep_time = recipe.prep_time
    db_recipe.cook_time = recipe.cook_time
    db_recipe.notes = recipe.notes
    db_recipe.updated_at = datetime.utcnow()

    for g in list(db_recipe.ingredient_groups):
        db.delete(g)
    for s in list(db_recipe.method_steps):
        db.delete(s)
    if db_recipe.macros:
        db.delete(db_recipe.macros)
    db.flush()

    for group_data in recipe.ingredient_groups:
        db_group = models.IngredientGroup(recipe_id=db_recipe.id, name=group_data.name, order=group_data.order)
        db.add(db_group)
        db.flush()
        for ing in group_data.ingredients:
            db.add(models.Ingredient(
                group_id=db_group.id, name=ing.name, prep_note=ing.prep_note,
                amount=ing.amount, unit=ing.unit,
                calories_per_100g=ing.calories_per_100g, protein_per_100g=ing.protein_per_100g,
                carbs_per_100g=ing.carbs_per_100g, fat_per_100g=ing.fat_per_100g,
            ))

    for step in recipe.method_steps:
        db.add(models.MethodStep(
            recipe_id=db_recipe.id, step_number=step.step_number,
            title=step.title, description=step.description,
        ))

    macros = _resolve_macros(recipe)
    db.add(models.Macros(recipe_id=db_recipe.id, **macros))

    if not db_recipe.image_url:
        import threading
        threading.Thread(target=_attach_pexels_image, args=(db_recipe.id, recipe.title), daemon=True).start()

    db.commit()
    db.refresh(db_recipe)
    return db_recipe


@app.get("/api/recipes/{recipe_id}/image-options")
async def get_image_options(
    recipe_id: int,
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not PEXELS_API_KEY:
        raise HTTPException(status_code=500, detail="Pexels API key not configured")

    query = q or recipe.title
    resp = httpx.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": PEXELS_API_KEY},
        params={"query": f"{query} food", "per_page": 12, "orientation": "landscape"},
        timeout=8,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Pexels API error")

    return [
        {
            "id": p["id"],
            "url": p["src"]["large2x"],
            "thumb": p["src"]["medium"],
            "photographer": p["photographer"],
        }
        for p in resp.json().get("photos", [])
    ]


@app.post("/api/recipes/{recipe_id}/image-url", response_model=schemas.RecipeOut)
def set_image_url(recipe_id: int, body: dict, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    recipe.image_url = body.get("url")
    recipe.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(recipe)
    return recipe


@app.delete("/api/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    db_recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(db_recipe)
    db.commit()


# ── Helpers ────────────────────────────────────────────────────────────────────

UNIT_TO_GRAMS = {
    "g": 1, "kg": 1000, "mg": 0.001,
    "ml": 1, "l": 1000,
    "tsp": 5, "tbsp": 15, "cup": 240,
    "oz": 28.35, "lb": 453.6,
}

CONTEXT_UNITS = {
    "clove":   {"garlic": 4, "default": 4},
    "cloves":  {"garlic": 4, "default": 4},
    "egg":     {"default": 58},
    "eggs":    {"default": 58},
    "can":     {"tomato": 400, "coconut": 400, "bean": 400, "chickpea": 400, "default": 400},
    "tin":     {"tomato": 400, "coconut": 400, "bean": 400, "chickpea": 400, "default": 400},
    "sprig":   {"thyme": 1, "rosemary": 2, "default": 2},
    "bunch":   {"coriander": 30, "parsley": 30, "default": 30},
    "handful": {"default": 30},
    "head":    {"garlic": 50, "broccoli": 400, "cauliflower": 600, "default": 200},
    "slice":   {"bread": 35, "cheese": 20, "default": 25},
    "rasher":  {"default": 25},
    "sheet":   {"gelatin": 2, "default": 2},
    "stick":   {"butter": 113, "cinnamon": 3, "default": 15},
    "knob":    {"butter": 15, "ginger": 10, "default": 10},
    "thumb":   {"ginger": 15, "default": 15},
    "fillet":  {"default": 150},
    "breast":  {"chicken": 180, "default": 180},
    "thigh":   {"chicken": 120, "default": 120},
}

DENSITIES = {
    "soy sauce": 1.15, "tamari": 1.15, "fish sauce": 1.07,
    "oyster sauce": 1.28, "worcestershire": 1.07, "hoisin": 1.32,
    "black bean sauce": 1.20, "mirin": 1.09,
    "gochujang": 1.45, "harissa": 1.10, "sriracha": 1.10,
    "hot sauce": 1.05, "chilli sauce": 1.10, "sweet chilli": 1.12, "sambal": 1.10,
    "tomato paste": 1.08, "tomato puree": 1.06, "ketchup": 1.15,
    "tahini": 1.07, "peanut butter": 1.08, "almond butter": 1.06, "miso": 1.18,
    "mustard": 1.09, "mayonnaise": 0.91,
    "honey": 1.40, "maple syrup": 1.32, "golden syrup": 1.43,
    "agave": 1.35, "molasses": 1.40, "treacle": 1.40,
    "olive oil": 0.91, "vegetable oil": 0.92, "sunflower oil": 0.92,
    "sesame oil": 0.92, "coconut oil": 0.92, "groundnut oil": 0.92,
    "balsamic": 1.32, "rice vinegar": 1.01, "cider vinegar": 1.01, "wine vinegar": 1.01,
    "cream": 1.01, "double cream": 1.01, "sour cream": 1.00,
    "creme fraiche": 0.98, "greek yogurt": 1.04, "yogurt": 1.04,
    "coconut milk": 1.04, "coconut cream": 1.08, "sake": 0.97,
}


def _unit_to_grams(unit: str, ingredient_name: str = "") -> float:
    u = (unit or "").lower().strip()
    name = (ingredient_name or "").lower()

    # Count-based units
    if u in CONTEXT_UNITS:
        mapping = CONTEXT_UNITS[u]
        for keyword, grams in mapping.items():
            if keyword != "default" and keyword in name:
                return float(grams)
        return float(mapping.get("default", 5))

    # Volume/weight with density correction
    base = UNIT_TO_GRAMS.get(u, 1.0)
    for key, density in DENSITIES.items():
        if key in name:
            return base * density
    return base


def _resolve_macros(recipe: schemas.RecipeCreate) -> dict:
    """Calculate macros from per-ingredient nutritional data, converting units to grams first."""
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
    servings = max(recipe.servings or 1, 1)
    for group in recipe.ingredient_groups:
        for ing in group.ingredients:
            if ing.amount and ing.calories_per_100g is not None:
                grams = ing.amount * _unit_to_grams(ing.unit, ing.name)
                f = grams / 100
                totals["calories"] += (ing.calories_per_100g or 0) * f
                totals["protein"] += (ing.protein_per_100g or 0) * f
                totals["carbs"] += (ing.carbs_per_100g or 0) * f
                totals["fat"] += (ing.fat_per_100g or 0) * f
    return {k: round(v / servings, 1) for k, v in totals.items()}


def _attach_pexels_image(recipe_id: int, title: str):
    """Fetch a Pexels food photo for the recipe title and store the URL."""
    if not PEXELS_API_KEY:
        return
    try:
        resp = httpx.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": PEXELS_API_KEY},
            params={"query": f"{title} food", "per_page": 1, "orientation": "landscape"},
            timeout=8,
        )
        if resp.status_code == 200:
            photos = resp.json().get("photos", [])
            if photos:
                url = photos[0]["src"]["large2x"]
                db = next(get_db())
                try:
                    r = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
                    if r:
                        r.image_url = url
                        db.commit()
                finally:
                    db.close()
    except Exception:
        pass
