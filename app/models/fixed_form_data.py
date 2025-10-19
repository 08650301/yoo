# app/models/fixed_form_data.py

from app import db
from sqlalchemy.types import JSON

class FixedFormData(db.Model):
    """固定表单数据存储表"""
    __tablename__ = 'fixed_form_data'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    sheet_id = db.Column(db.Integer, db.ForeignKey('sheet_definition.id', ondelete='CASCADE'), nullable=False)

    # 存储整个表单所有字段数据的JSON对象
    # 例如: {"field_name_1": "value1", "field_name_2": "value2"}
    data = db.Column(JSON, nullable=False)

    # 关系定义
    project = db.relationship('Project')
    sheet_definition = db.relationship('SheetDefinition')
