# This file makes the 'models' directory a Python package.
# We import all the models from the submodules here
# to make them easily accessible from 'app.models'.

# Import models from project.py
from .project import Project, FixedFormData

# Import models from template_definition.py
from .template_definition import (
    Template,
    Section,
    SheetDefinition,
    FieldDefinition,
    ValidationRule,
    ConditionalRule,
    WordTemplateChapter
)

# Import models from the new dynamic_data.py
from .dynamic_data import DynamicTableRow

# It's a good practice to define __all__ to specify what gets imported
# when a client does 'from app.models import *'
__all__ = [
    # from project
    'Project', 'FixedFormData',
    # from template_definition
    'Template', 'Section', 'SheetDefinition', 'FieldDefinition',
    'ValidationRule', 'ConditionalRule', 'WordTemplateChapter',
    # from dynamic_data
    'DynamicTableRow'
]
