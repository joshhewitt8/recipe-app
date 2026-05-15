from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    servings = Column(Integer, default=4)
    prep_time = Column(Integer)
    cook_time = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ingredient_groups = relationship(
        "IngredientGroup",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="IngredientGroup.order",
    )
    method_steps = relationship(
        "MethodStep",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="MethodStep.step_number",
    )
    macros = relationship(
        "Macros",
        back_populates="recipe",
        cascade="all, delete-orphan",
        uselist=False,
    )


class IngredientGroup(Base):
    __tablename__ = "ingredient_groups"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    name = Column(String(100), nullable=False)
    order = Column(Integer, default=0)

    recipe = relationship("Recipe", back_populates="ingredient_groups")
    ingredients = relationship(
        "Ingredient",
        back_populates="group",
        cascade="all, delete-orphan",
    )


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("ingredient_groups.id"), nullable=False)
    name = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    unit = Column(String(50))

    group = relationship("IngredientGroup", back_populates="ingredients")


class MethodStep(Base):
    __tablename__ = "method_steps"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    title = Column(String(255))
    description = Column(Text, nullable=False)

    recipe = relationship("Recipe", back_populates="method_steps")


class Macros(Base):
    __tablename__ = "macros"
    __table_args__ = (UniqueConstraint("recipe_id"),)

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    calories = Column(Float)
    protein = Column(Float)
    carbs = Column(Float)
    fat = Column(Float)

    recipe = relationship("Recipe", back_populates="macros")
