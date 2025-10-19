# app/routes/admin/sections_sheets.py

from flask import Blueprint, jsonify, request
from app import db
from app.models import Section, SheetDefinition

admin_sections_sheets_bp = Blueprint('admin_sections_sheets', __name__, url_prefix='/admin/api')


# ==============================================================================
# 分区 (Section) 管理 API
# ==============================================================================

@admin_sections_sheets_bp.route('/sections/reorder', methods=['POST'])
def reorder_sections():
    """更新分区在模板内的显示顺序"""
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


@admin_sections_sheets_bp.route('/templates/<int:template_id>/sections', methods=['POST'])
def create_section(template_id):
    """在指定模板下创建一个新分区"""
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


@admin_sections_sheets_bp.route('/sections/<int:section_id>', methods=['PUT'])
def update_section(section_id):
    """更新一个分区的名称"""
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


@admin_sections_sheets_bp.route('/sections/<int:section_id>', methods=['DELETE'])
def delete_section(section_id):
    """删除一个分区及其下的所有内容"""
    try:
        section = Section.query.get_or_404(section_id)
        db.session.delete(section)
        db.session.commit()
        return jsonify({"message": "分区已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# 表单 (Sheet) 管理 API
# ==============================================================================

@admin_sections_sheets_bp.route('/sheets/reorder', methods=['POST'])
def reorder_sheets():
    """更新表单在分区内的显示顺序"""
    try:
        data = request.json
        sheet_ids = data.get('order', [])
        section_id = data.get('section_id')
        if not section_id:
            return jsonify({"error": "缺少section_id"}), 400

        for index, sheet_id in enumerate(sheet_ids):
            sheet = SheetDefinition.query.get(sheet_id)
            if sheet and sheet.section_id == int(section_id):
                sheet.display_order = index
        db.session.commit()
        return jsonify({"message": "Sheet顺序更新成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_sections_sheets_bp.route('/sections/<int:section_id>/sheets', methods=['POST'])
def create_sheet(section_id):
    """在指定分区下创建一个新表单"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        sheet_type = data.get('type')
        if not name:
            return jsonify({"error": "Sheet名称不能为空"}), 400
        if sheet_type not in ['fixed_form', 'dynamic_table']:
            return jsonify({"error": "无效的Sheet类型"}), 400

        model_identifier = None # model_identifier 不再需要

        last_sheet = SheetDefinition.query.filter_by(section_id=section_id).order_by(
            SheetDefinition.display_order.desc()).first()
        new_order = (last_sheet.display_order + 1) if last_sheet else 0
        new_sheet = SheetDefinition(section_id=section_id, name=name, sheet_type=sheet_type, display_order=new_order,
                                    model_identifier=model_identifier)
        db.session.add(new_sheet)
        db.session.commit()
        return jsonify({"message": "新Sheet创建成功", "id": new_sheet.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_sections_sheets_bp.route('/sheets/<int:sheet_id>', methods=['DELETE'])
def delete_sheet(sheet_id):
    """删除一个表单及其下的所有内容"""
    try:
        sheet = SheetDefinition.query.get_or_404(sheet_id)
        db.session.delete(sheet)
        db.session.commit()
        return jsonify({"message": "Sheet已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
