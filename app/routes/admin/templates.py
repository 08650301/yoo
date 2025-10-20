# app/routes/admin/templates.py

from flask import Blueprint, jsonify, request
from app import db
from app.models import Template

# 这个蓝图专门用于管理模板的增删改查 API
admin_templates_bp = Blueprint('admin_templates', __name__, url_prefix='/admin/api')

@admin_templates_bp.route('/templates', methods=['POST'])
def create_template():
    """创建一个新的模板"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        if not name:
            return jsonify({"error": "模板名称不能为空"}), 400

        # 检查模板名称是否已存在
        if Template.query.filter_by(name=name).first():
            return jsonify({"error": "具有相同名称的模板已存在"}), 409

        new_template = Template(name=name)
        db.session.add(new_template)
        db.session.commit()

        return jsonify({
            "message": "新模板创建成功！",
            "id": new_template.id,
            "name": new_template.name,
            "status": new_template.status,
            "version": new_template.version
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
