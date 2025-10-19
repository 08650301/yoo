# app/models/section.py

from app import db
from sqlalchemy.orm import relationship

class Section(db.Model):
    """分区表，模板内的逻辑分组"""
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('template.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)

    # 关系定义: 一个分区属于一个模板，一个分区有多个 Sheet
    template = relationship("Template", back_populates="sections")
    sheets = relationship("SheetDefinition", back_populates="section", cascade="all, delete-orphan",
                          order_by="SheetDefinition.display_order")
    # 新增关系：一个分区有多个章节文档
    chapters = relationship("WordTemplateChapter", back_populates="section", cascade="all, delete-orphan",
                            order_by="WordTemplateChapter.display_order")
