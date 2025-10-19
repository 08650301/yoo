# app/models/word_template_chapter.py

from app import db
from sqlalchemy.orm import relationship

class WordTemplateChapter(db.Model):
    """章节Word模板表，存储每个章节的.docx文件信息"""
    __tablename__ = 'word_template_chapter'
    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey('section.id', ondelete='CASCADE'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(512), nullable=False)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    # 关系定义: 一个章节模板属于一个分区
    section = relationship("Section", back_populates="chapters")
    # 关系定义: 一个章节模板可以被一个Sheet关联 (一对一)
    sheet_definition = relationship("SheetDefinition", back_populates="word_template_chapter", uselist=False)
