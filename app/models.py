from app import db
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON


# ==============================================================================
# 数据库模型定义
# 每个类对应数据库中的一个表
# ==============================================================================

# --- 用户数据部分 ---

class Project(db.Model):
    """项目表"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    number = db.Column(db.String(100), nullable=False)
    procurement_method = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())


class FixedFormData(db.Model):
    """固定表单数据存储表"""
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    sheet_name = db.Column(db.String(100), nullable=False)
    field_name = db.Column(db.String(100), nullable=False)
    field_value = db.Column(db.Text)


# --- 动态表格模型 ---

class KeyTechIndicator(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    product_name = db.Column(db.String(200))
    tech_spec = db.Column(db.Text)
    requirement = db.Column(db.Text)
    notes = db.Column(db.Text)


class BizReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    step = db.Column(db.String(50))
    category = db.Column(db.String(50))


class TechReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    step = db.Column(db.String(50))
    category = db.Column(db.String(50))


class ServiceReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    step = db.Column(db.String(50))
    category = db.Column(db.String(50))


class PriceReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)
    max_score = db.Column(db.Float)
    min_score = db.Column(db.Float)
    category = db.Column(db.String(50))


class DeductReviewItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    item_name = db.Column(db.String(200))
    criteria = db.Column(db.Text)


class ShareAllocationPrinciple(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    supplier = db.Column(db.String(200))
    ratio = db.Column(db.String(100))
    region = db.Column(db.String(200))


class EffectiveSupplierPrinciple(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    effective_supplier_count = db.Column(db.String(200))
    candidate_count = db.Column(db.String(200))
    winner_count = db.Column(db.String(200))


class MultiShareAllocationPrinciple(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50));
    winner_count = db.Column(db.String(100));
    rank_1 = db.Column(db.String(50));
    rank_2 = db.Column(db.String(50));
    rank_3 = db.Column(db.String(50));
    rank_4 = db.Column(db.String(50));
    rank_5 = db.Column(db.String(50));
    rank_6 = db.Column(db.String(50));
    rank_7 = db.Column(db.String(50));
    rank_8 = db.Column(db.String(50));
    rank_9 = db.Column(db.String(50));
    rank_10 = db.Column(db.String(50));
    rank_11 = db.Column(db.String(50));
    rank_12 = db.Column(db.String(50));
    rank_13 = db.Column(db.String(50));
    rank_14 = db.Column(db.String(50));
    rank_15 = db.Column(db.String(50));
    rank_16 = db.Column(db.String(50));
    rank_17 = db.Column(db.String(50));
    rank_18 = db.Column(db.String(50));
    rank_19 = db.Column(db.String(50));
    rank_20 = db.Column(db.String(50));
    rank_21 = db.Column(db.String(50));
    rank_22 = db.Column(db.String(50));
    rank_23 = db.Column(db.String(50));
    rank_24 = db.Column(db.String(50));
    rank_25 = db.Column(db.String(50));
    rank_26 = db.Column(db.String(50));
    rank_27 = db.Column(db.String(50));
    rank_28 = db.Column(db.String(50));
    rank_29 = db.Column(db.String(50));
    rank_30 = db.Column(db.String(50));
    rank_31 = db.Column(db.String(50));
    rank_32 = db.Column(db.String(50));
    rank_33 = db.Column(db.String(50));
    rank_34 = db.Column(db.String(50));
    rank_35 = db.Column(db.String(50));
    rank_36 = db.Column(db.String(50));
    rank_37 = db.Column(db.String(50));
    rank_38 = db.Column(db.String(50));
    rank_39 = db.Column(db.String(50));
    rank_40 = db.Column(db.String(50));
    rank_41 = db.Column(db.String(50));
    rank_42 = db.Column(db.String(50));
    rank_43 = db.Column(db.String(50));
    rank_44 = db.Column(db.String(50));
    rank_45 = db.Column(db.String(50));
    rank_46 = db.Column(db.String(50));
    rank_47 = db.Column(db.String(50));
    rank_48 = db.Column(db.String(50));
    rank_49 = db.Column(db.String(50));
    rank_50 = db.Column(db.String(50));
    notes = db.Column(db.Text)


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


class SheetDefinition(db.Model):
    """Sheet 定义表，代表一个具体的表单或表格"""
    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey('section.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    sheet_type = db.Column(db.String(50), nullable=False)  # 'fixed_form' 或 'dynamic_table'
    display_order = db.Column(db.Integer, nullable=False, default=0)
    model_identifier = db.Column(db.String(100), nullable=True)  # 动态表格关联的模型标识

    # 关系定义
    section = relationship("Section", back_populates="sheets")
    fields = relationship("FieldDefinition", back_populates="sheet", cascade="all, delete-orphan",
                          order_by="FieldDefinition.display_order")
    conditional_rules = relationship("ConditionalRule", back_populates="sheet", cascade="all, delete-orphan")


class FieldDefinition(db.Model):
    """字段定义表，定义了表单中的每个输入项"""
    __table_args__ = (db.UniqueConstraint('sheet_id', 'name', name='uq_sheet_field_name'),)
    
    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.Integer, db.ForeignKey('sheet_definition.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # 内部名称
    label = db.Column(db.String(200), nullable=False)  # 显示名称
    field_type = db.Column(db.String(50), nullable=False)
    options = db.Column(db.Text)  # 用于下拉、单选、复选的选项，逗号分隔
    default_value = db.Column(db.String(255))
    help_tip = db.Column(db.Text)
    display_order = db.Column(db.Integer, nullable=False, default=0)

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


# 动态表格模型标识符到模型类的映射
DYNAMIC_TABLE_MODELS = {
    "key_tech_indicator": KeyTechIndicator, "biz_review_item": BizReviewItem, "tech_review_item": TechReviewItem,
    "service_review_item": ServiceReviewItem, "price_review_item": PriceReviewItem,
    "deduct_review_item": DeductReviewItem,
    "share_allocation_principle": ShareAllocationPrinciple, "effective_supplier_principle": EffectiveSupplierPrinciple,
    "multi_share_allocation_principle": MultiShareAllocationPrinciple
}

