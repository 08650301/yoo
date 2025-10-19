# app/models/validation_rule.py

from app import db
from sqlalchemy.orm import relationship

class ValidationRule(db.Model):
    """基础校验规则表"""
    id = db.Column(db.Integer, primary_key=True)
    field_id = db.Column(db.Integer, db.ForeignKey('field_definition.id', ondelete='CASCADE'), nullable=False)
    rule_type = db.Column(db.String(50), nullable=False)
    rule_value = db.Column(db.String(255))
    message = db.Column(db.String(255))

    field = relationship("FieldDefinition", back_populates="validation_rules")
