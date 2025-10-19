# app/routes/admin/sheets.py

from flask import Blueprint, jsonify, request
from app import db
from app.models import SheetDefinition

admin_sheets_bp = Blueprint('admin_sheets', __name__)

@admin_sheets_bp.route('/api/sheets/reorder', methods=['POST'])
def reorder_sheets():
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

@admin_sheets_bp.route('/api/sections/<int:section_id>/sheets', methods=['POST'])
def create_sheet(section_id):
    try:
        data = request.json
        name = data.get('name', '').strip()
        sheet_type = data.get('type')
        if not name:
            return jsonify({"error": "Sheet名称不能为空"}), 400
        if sheet_type not in ['fixed_form', 'dynamic_table']:
            return jsonify({"error": "无效的Sheet类型"}), 400

        model_identifier = None

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


@admin_sheets_bp.route('/api/sheets/<int:sheet_id>', methods=['DELETE'])
def delete_sheet(sheet_id):
    try:
        sheet = SheetDefinition.query.get_or_404(sheet_id)
        db.session.delete(sheet)
        db.session.commit()
        return jsonify({"message": "Sheet已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
