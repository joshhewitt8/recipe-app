from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

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
            ))

    for step in recipe.method_steps:
        db.add(models.MethodStep(
            recipe_id=db_recipe.id,
            step_number=step.step_number,
            title=step.title,
            description=step.description,
        ))

    if recipe.macros:
        db.add(models.Macros(
            recipe_id=db_recipe.id,
            calories=recipe.macros.calories,
            protein=recipe.macros.protein,
            carbs=recipe.macros.carbs,
            fat=recipe.macros.fat,
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
            ))

    for step in recipe.method_steps:
        db.add(models.MethodStep(
            recipe_id=db_recipe.id,
            step_number=step.step_number,
            title=step.title,
            description=step.description,
        ))

    if recipe.macros:
        db.add(models.Macros(
            recipe_id=db_recipe.id,
            calories=recipe.macros.calories,
            protein=recipe.macros.protein,
            carbs=recipe.macros.carbs,
            fat=recipe.macros.fat,
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
