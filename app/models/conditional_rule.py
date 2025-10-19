# app/models/conditional_rule.py

from app import db
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

class ConditionalRule(db.Model):
    """联动规则表，存储字段间的复杂逻辑"""
    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.Integer, db.ForeignKey('sheet_definition.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    # 使用 JSON 类型来存储复杂的规则定义对象
    definition = db.Column(JSON, nullable=False)

    sheet = relationship("SheetDefinition", back_populates="conditional_rules")
