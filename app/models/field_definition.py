# app/models/field_definition.py

from app import db
from sqlalchemy.orm import relationship

class FieldDefinition(db.Model):
    """字段定义表，定义了表单中的每个输入项"""
    __table_args__ = (db.UniqueConstraint('sheet_id', 'name', name='uq_sheet_field_name'),)

    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.Integer, db.ForeignKey('sheet_definition.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # 内部名称
    label = db.Column(db.String(200), nullable=False)  # 显示名称
    field_type = db.Column(db.String(50), nullable=False)
    options = db.Column(db.JSON) # 用于存储选项的JSON数组，例如: [{"label": "是", "value": "1"}]
    default_value = db.Column(db.String(255))
    help_tip = db.Column(db.Text)
    display_order = db.Column(db.Integer, nullable=False, default=0)

    # 新增：用于控制选择类字段在导出时的行为
    # True 表示导出选项的 'label'，False 表示导出 'value'
    export_word_as_label = db.Column(db.Boolean, nullable=False, default=False, server_default='0')
    export_excel_as_label = db.Column(db.Boolean, nullable=False, default=True, server_default='1')

    sheet = relationship("SheetDefinition", back_populates="fields")
    validation_rules = relationship("ValidationRule", back_populates="field", cascade="all, delete-orphan")
