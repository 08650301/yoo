from flask import Blueprint, render_template
from app.models import Project

# 这个蓝图处理主要的、面向用户的前端页面路由
main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def route_index():
    """渲染项目仪表盘主页"""
    return render_template('main/index.html')


@main_bp.route('/projects/<int:project_id>')
def route_project_detail(project_id):
    """渲染特定项目的详细数据填报页面"""
    project = Project.query.get_or_404(project_id)
    return render_template('main/project.html', project=project)
