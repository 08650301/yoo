# app/models/sheet_definition.py

from app import db
from sqlalchemy.orm import relationship

class SheetDefinition(db.Model):
    """Sheet 定义表，代表一个具体的表单或表格"""
    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey('section.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    sheet_type = db.Column(db.String(50), nullable=False)  # 'fixed_form' 或 'dynamic_table'
    display_order = db.Column(db.Integer, nullable=False, default=0)
    model_identifier = db.Column(db.String(100), nullable=True)  # 动态表格关联的模型标识

    # 新增外键: 关联到章节Word模板
    word_template_chapter_id = db.Column(db.Integer, db.ForeignKey('word_template_chapter.id'), unique=True, nullable=True)

    # 关系定义
    section = relationship("Section", back_populates="sheets")
    fields = relationship("FieldDefinition", back_populates="sheet", cascade="all, delete-orphan",
                          order_by="FieldDefinition.display_order")
    conditional_rules = relationship("ConditionalRule", back_populates="sheet", cascade="all, delete-orphan")
    # 新增关系: 关联到章节Word模板
    word_template_chapter = relationship("WordTemplateChapter", back_populates="sheet_definition")
