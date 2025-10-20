# app/routes/admin/pages.py

from flask import Blueprint, render_template
from app.models import Template, Section

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

from sqlalchemy.orm import joinedload

@admin_pages_bp.route('/templates/<int:template_id>')
def route_admin_template_detail(template_id):
    """
    渲染单个模板的管理详情页面。
    这个页面是管理模板结构（分区和表单）的中心。
    """
    # 使用 joinedload 来预加载关联的 sections 和 sheets，避免 N+1 查询问题
    template = Template.query.options(
        joinedload(Template.sections).joinedload(Section.sheets)
    ).get_or_404(template_id)

    # 按照 display_order 对 sections 和 sheets 进行排序
    template.sections.sort(key=lambda s: s.display_order)
    for section in template.sections:
        section.sheets.sort(key=lambda sh: sh.display_order)

    return render_template('admin/admin_template_detail.html', template=template)
