import os
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import httpx

import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

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


# ── Ingredient search ──────────────────────────────────────────────────────────

@app.get("/api/ingredients/search")
async def search_ingredients(q: str = Query(..., min_length=2)):
    """Search USDA FoodData Central and return matching ingredients with macros."""
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

    data = resp.json()
    results = []

    for food in data.get("foods", []):
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
def list_recipes(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
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
        db_group = models.IngredientGroup(
            recipe_id=db_recipe.id,
            name=group_data.name,
            order=group_data.order,
        )
        db.add(db_group)
        db.flush()
        for ing in group_data.ingredients:
            db.add(models.Ingredient(
                group_id=db_group.id,
                name=ing.name,
                amount=ing.amount,
                unit=ing.unit,
                calories_per_100g=ing.calories_per_100g,
                protein_per_100g=ing.protein_per_100g,
                carbs_per_100g=ing.carbs_per_100g,
                fat_per_100g=ing.fat_per_100g,
            ))

    for step in recipe.method_steps:
        db.add(models.MethodStep(
            recipe_id=db_recipe.id,
            step_number=step.step_number,
            title=step.title,
            description=step.description,
        ))

    macros = _calculate_macros(recipe)
    db.add(models.Macros(
        recipe_id=db_recipe.id,
        calories=macros["calories"],
        protein=macros["protein"],
        carbs=macros["carbs"],
        fat=macros["fat"],
    ))

    db.commit()
    db.refresh(db_recipe)
    return db_recipe


@app.get("/api/recipes/{recipe_id}", response_model=schemas.RecipeOut)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@app.put("/api/recipes/{recipe_id}", response_model=schemas.RecipeOut)
def update_recipe(
    recipe_id: int,
    recipe: schemas.RecipeUpdate,
    db: Session = Depends(get_db),
):
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
        db_group = models.IngredientGroup(
            recipe_id=db_recipe.id,
            name=group_data.name,
            order=group_data.order,
        )
        db.add(db_group)
        db.flush()
        for ing in group_data.ingredients:
            db.add(models.Ingredient(
                group_id=db_group.id,
                name=ing.name,
                amount=ing.amount,
                unit=ing.unit,
                calories_per_100g=ing.calories_per_100g,
                protein_per_100g=ing.protein_per_100g,
                carbs_per_100g=ing.carbs_per_100g,
                fat_per_100g=ing.fat_per_100g,
            ))

    for step in recipe.method_steps:
        db.add(models.MethodStep(
            recipe_id=db_recipe.id,
            step_number=step.step_number,
            title=step.title,
            description=step.description,
        ))

    macros = _calculate_macros(recipe)
    db.add(models.Macros(
        recipe_id=db_recipe.id,
        calories=macros["calories"],
        protein=macros["protein"],
        carbs=macros["carbs"],
        fat=macros["fat"],
    ))

    db.commit()
    db.refresh(db_recipe)
    return db_recipe


@app.delete("/api/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    db_recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(db_recipe)
    db.commit()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _calculate_macros(recipe: schemas.RecipeCreate) -> dict:
    """Sum macros across all ingredients (assuming amounts are in grams) and divide by servings."""
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
    servings = max(recipe.servings or 1, 1)

    for group in recipe.ingredient_groups:
        for ing in group.ingredients:
            if ing.amount and ing.calories_per_100g is not None:
                factor = ing.amount / 100
                totals["calories"] += (ing.calories_per_100g or 0) * factor
                totals["protein"] += (ing.protein_per_100g or 0) * factor
                totals["carbs"] += (ing.carbs_per_100g or 0) * factor
                totals["fat"] += (ing.fat_per_100g or 0) * factor

    return {k: round(v / servings, 1) for k, v in totals.items()}
