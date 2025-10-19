# app/models/template.py

from app import db
from sqlalchemy.orm import relationship

class Template(db.Model):
    """模板表，代表一种采购方式"""
    __tablename__ = 'template'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(20), nullable=False, default='draft')  # 'draft' 或 'published'
    is_latest = db.Column(db.Boolean, default=True)  # 标记是否是最新版本
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    parent_id = db.Column(db.Integer, db.ForeignKey('template.id'))  # 用于版本克隆溯源
    display_order = db.Column(db.Integer, nullable=False, default=0)

    # 关系定义: 一个模板有多个分区
    sections = relationship("Section", back_populates="template", cascade="all, delete-orphan",
                            order_by="Section.display_order")
    parent = relationship("Template", remote_side=[id])
