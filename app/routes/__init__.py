# app/routes/__init__.py

from flask import Blueprint

# 创建一个聚合的 admin 蓝图
admin_bp = Blueprint('admin', __name__)

# 从各个模块导入蓝图，并注册到 admin_bp 中
# 这样做可以让我们在 app/__init__.py 中只注册一个 admin_bp，但享受模块化的好处
from .admin.main import admin_main_bp
from .admin.templates import admin_templates_bp
from .admin.sections import admin_sections_bp
from .admin.sheets import admin_sheets_bp
from .admin.fields import admin_fields_bp
from .admin.rules import admin_rules_bp
from .admin.chapters import admin_chapters_bp

# 注意：这里我们不需要真的去 app.register_blueprint
# 我们只是把它们导入，以便在 app/__init__.py 中统一处理
