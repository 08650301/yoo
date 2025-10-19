# app/routes/api/projects.py

from flask import Blueprint, jsonify, request
from datetime import timezone, timedelta
from app import db
from app.models import Project, FixedFormData, DynamicTableRow

api_projects_bp = Blueprint('api_projects', __name__, url_prefix='/api')


# ==============================================================================
# 项目 (Project) 管理 API
# ==============================================================================

@api_projects_bp.route('/projects', methods=['GET'])
def get_projects():
    """获取项目列表，支持按名称、编号和采购方式进行筛选"""
    try:
        query = Project.query
        name_query = request.args.get('name', '').strip()
        number_query = request.args.get('number', '').strip()
        method_query = request.args.get('method', '').strip()

        if name_query:
            query = query.filter(Project.name.like(f"%{name_query}%"))
        if number_query:
            query = query.filter(Project.number.like(f"%{number_query}%"))
        if method_query:
            query = query.filter(Project.procurement_method == method_query)

        projects = query.order_by(Project.created_at.desc()).all()
        china_tz = timezone(timedelta(hours=8))

        return jsonify([{
            "id": p.id,
            "name": p.name,
            "number": p.number,
            "procurement_method": p.procurement_method,
            "created_at": p.created_at.replace(tzinfo=timezone.utc).astimezone(china_tz).strftime('%Y-%m-%d %H:%M')
        } for p in projects])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_projects_bp.route('/projects', methods=['POST'])
def create_project():
    """创建一个新项目"""
    data = request.json
    if not data or not data.get('name', '').strip():
        return jsonify({"error": "项目名称不能为空"}), 400
    if not data.get('number', '').strip():
        return jsonify({"error": "项目编号不能为空"}), 400
    if not data.get('procurement_method'):
        return jsonify({"error": "必须选择采购方式"}), 400

    new_project = Project(name=data['name'], number=data['number'], procurement_method=data['procurement_method'])
    db.session.add(new_project)
    db.session.commit()
    return jsonify({"id": new_project.id, "name": new_project.name, "message": "项目创建成功"}), 201


@api_projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """删除一个项目及其所有关联数据"""
    try:
        project = Project.query.get_or_404(project_id)
        FixedFormData.query.filter_by(project_id=project_id).delete()
        DynamicTableRow.query.filter_by(project_id=project_id).delete()
        db.session.delete(project)
        db.session.commit()
        return jsonify({"message": "项目已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@api_projects_bp.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """更新一个项目的基本信息"""
    try:
        project = Project.query.get_or_404(project_id)
        data = request.json
        if not data or not data.get('name', '').strip():
            return jsonify({"error": "项目名称不能为空"}), 400
        if not data.get('number', '').strip():
            return jsonify({"error": "项目编号不能为空"}), 400
        if not data.get('procurement_method'):
            return jsonify({"error": "必须选择采购方式"}), 400

        project.name = data['name']
        project.number = data['number']
        project.procurement_method = data['procurement_method']
        db.session.commit()
        return jsonify({"message": "项目信息更新成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
