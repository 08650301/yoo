# This file makes the 'models' directory a Python package.
# We import all the models from the submodules here
# to make them easily accessible from 'app.models'.

# Import models from project.py
from .project import Project, FixedFormData

# Import models from review_items.py
from .review_items import (
    KeyTechIndicator,
    BizReviewItem,
    TechReviewItem,
    ServiceReviewItem,
    PriceReviewItem,
    DeductReviewItem
)

# Import models from allocation.py
from .allocation import (
    ShareAllocationPrinciple,
    EffectiveSupplierPrinciple,
    MultiShareAllocationPrinciple
)

# Import models from template_definition.py
from .template_definition import (
    Template,
    Section,
    SheetDefinition,
    FieldDefinition,
    ValidationRule,
    ConditionalRule,
    WordTemplateChapter,
    DYNAMIC_TABLE_MODELS
)

# It's a good practice to define __all__ to specify what gets imported
# when a client does 'from app.models import *'
__all__ = [
    # from project
    'Project', 'FixedFormData',
    # from review_items
    'KeyTechIndicator', 'BizReviewItem', 'TechReviewItem', 'ServiceReviewItem',
    'PriceReviewItem', 'DeductReviewItem',
    # from allocation
    'ShareAllocationPrinciple', 'EffectiveSupplierPrinciple', 'MultiShareAllocationPrinciple',
    # from template_definition
    'Template', 'Section', 'SheetDefinition', 'FieldDefinition',
    'ValidationRule', 'ConditionalRule', 'WordTemplateChapter', 'DYNAMIC_TABLE_MODELS'
]
