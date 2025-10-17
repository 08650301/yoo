from app import db
from sqlalchemy.types import JSON

class DynamicTableRow(db.Model):
    """动态表格行数据存储表"""
    __tablename__ = 'dynamic_table_row'

    id = db.Column(db.Integer, primary_key=True)

    # 使用 sheet_id 而不是 project_id，可以更精确地关联到具体的动态表格定义
    sheet_id = db.Column(db.Integer, db.ForeignKey('sheet_definition.id', ondelete='CASCADE'), nullable=False)

    # 使用 project_id 可以在删除整个项目时快速清理数据
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)

    # 存储该行所有列数据的JSON对象
    # 例如: {"column_name_1": "value1", "column_name_2": "value2"}
    data = db.Column(JSON, nullable=False)

    # 行的显示顺序
    display_order = db.Column(db.Integer, nullable=False, default=0)

    # 关系定义 (可选，但有助于查询)
    sheet_definition = db.relationship('SheetDefinition')
    project = db.relationship('Project')