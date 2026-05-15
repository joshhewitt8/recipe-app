from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class IngredientBase(BaseModel):
    name: str
    amount: float
    unit: Optional[str] = None
    calories_per_100g: Optional[float] = None
    protein_per_100g: Optional[float] = None
    carbs_per_100g: Optional[float] = None
    fat_per_100g: Optional[float] = None


class IngredientCreate(IngredientBase):
    pass


class IngredientOut(IngredientBase):
    id: int
    group_id: int
    model_config = {"from_attributes": True}


class IngredientGroupBase(BaseModel):
    name: str
    order: int = 0


class IngredientGroupCreate(IngredientGroupBase):
    ingredients: List[IngredientCreate] = []


class IngredientGroupOut(IngredientGroupBase):
    id: int
    recipe_id: int
    ingredients: List[IngredientOut] = []
    model_config = {"from_attributes": True}


class MethodStepBase(BaseModel):
    step_number: int
    title: Optional[str] = None
    description: str


class MethodStepCreate(MethodStepBase):
    pass


class MethodStepOut(MethodStepBase):
    id: int
    recipe_id: int
    model_config = {"from_attributes": True}


class MacrosBase(BaseModel):
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None


class MacrosCreate(MacrosBase):
    pass


class MacrosOut(MacrosBase):
    id: int
    recipe_id: int
    model_config = {"from_attributes": True}


class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    servings: int = 4
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    notes: Optional[str] = None


class RecipeCreate(RecipeBase):
    ingredient_groups: List[IngredientGroupCreate] = []
    method_steps: List[MethodStepCreate] = []
    macros: Optional[MacrosCreate] = None


class RecipeUpdate(RecipeCreate):
    pass


class RecipeOut(RecipeBase):
    id: int
    ingredient_groups: List[IngredientGroupOut] = []
    method_steps: List[MethodStepOut] = []
    macros: Optional[MacrosOut] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class RecipeSummaryOut(RecipeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
