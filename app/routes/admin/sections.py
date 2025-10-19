# app/routes/admin/sections.py

from flask import Blueprint, jsonify, request
from app import db
from app.models import Section

admin_sections_bp = Blueprint('admin_sections', __name__)

@admin_sections_bp.route('/api/sections/reorder', methods=['POST'])
def reorder_sections():
    try:
        data = request.json
        section_ids = data.get('order', [])
        for index, section_id in enumerate(section_ids):
            section = Section.query.get(section_id)
            if section:
                section.display_order = index
        db.session.commit()
        return jsonify({"message": "分区顺序更新成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@admin_sections_bp.route('/api/templates/<int:template_id>/sections', methods=['POST'])
def create_section(template_id):
    try:
        data = request.json
        name = data.get('name', '').strip()
        if not name:
            return jsonify({"error": "分区名称不能为空"}), 400
        last_section = Section.query.filter_by(template_id=template_id).order_by(Section.display_order.desc()).first()
        new_order = (last_section.display_order + 1) if last_section else 0
        new_section = Section(template_id=template_id, name=name, display_order=new_order)
        db.session.add(new_section)
        db.session.commit()
        return jsonify({"message": "新分区创建成功", "id": new_section.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@admin_sections_bp.route('/api/sections/<int:section_id>', methods=['PUT'])
def update_section(section_id):
    try:
        data = request.json
        name = data.get('name', '').strip()
        if not name:
            return jsonify({"error": "分区名称不能为空"}), 400
        section = Section.query.get_or_404(section_id)
        section.name = name
        db.session.commit()
        return jsonify({"message": "分区名称更新成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@admin_sections_bp.route('/api/sections/<int:section_id>', methods=['DELETE'])
def delete_section(section_id):
    try:
        section = Section.query.get_or_404(section_id)
        db.session.delete(section)
        db.session.commit()
        return jsonify({"message": "分区已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
