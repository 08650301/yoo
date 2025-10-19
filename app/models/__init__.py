# app/models/__init__.py

# 导入所有模型，以便 Flask-Migrate 和 SQLAlchemy 可以发现它们
from .project import Project
from .template import Template
from .section import Section
from .word_template_chapter import WordTemplateChapter
from .sheet_definition import SheetDefinition
from .field_definition import FieldDefinition
from .validation_rule import ValidationRule
from .conditional_rule import ConditionalRule
from .dynamic_data import DynamicTableRow
from .fixed_form_data import FixedFormData
