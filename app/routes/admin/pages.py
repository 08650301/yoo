# app/routes/admin/pages.py

from flask import Blueprint, render_template
from app.models import Template

# 这个蓝图专门用于渲染后台管理的HTML页面
admin_pages_bp = Blueprint('admin_pages', __name__, url_prefix='/admin')

@admin_pages_bp.route('/templates')
def route_admin_templates_list():
    """
    渲染后台模板管理的主页面。
    这个页面会列出所有可用的模板。
    """
    templates = Template.query.order_by(Template.id.asc()).all()
    return render_template('admin/admin_templates.html', templates=templates)
