# app/models/project.py

from app import db
from datetime import datetime

class Project(db.Model):
    """项目表"""
    __tablename__ = 'project'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    number = db.Column(db.String(100), nullable=False, unique=True)
    procurement_method = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
