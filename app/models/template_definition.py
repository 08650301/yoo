from app import db
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

# --- 模板管理部分 ---

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


class ValidationRule(db.Model):
    """基础校验规则表"""
    id = db.Column(db.Integer, primary_key=True)
    field_id = db.Column(db.Integer, db.ForeignKey('field_definition.id', ondelete='CASCADE'), nullable=False)
    rule_type = db.Column(db.String(50), nullable=False)
    rule_value = db.Column(db.String(255))
    message = db.Column(db.String(255))

    field = relationship("FieldDefinition", back_populates="validation_rules")


class ConditionalRule(db.Model):
    """联动规则表，存储字段间的复杂逻辑"""
    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.Integer, db.ForeignKey('sheet_definition.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    # 使用 JSON 类型来存储复杂的规则定义对象
    definition = db.Column(JSON, nullable=False)

    sheet = relationship("SheetDefinition", back_populates="conditional_rules")
