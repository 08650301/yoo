# app/routes/admin/fields.py

from flask import Blueprint, jsonify, request
from app import db
from app.models import FieldDefinition, ValidationRule

admin_fields_bp = Blueprint('admin_fields', __name__)

FIELD_TYPES_REQUIRING_OPTIONS = ['select', 'select-multiple', 'radio', 'checkbox-group']

@admin_fields_bp.route('/api/sheets/<int:sheet_id>/fields', methods=['POST'])
def create_field(sheet_id):
    try:
        data = request.json
        field_type = data.get('field_type')

        options_data = None
        if field_type in FIELD_TYPES_REQUIRING_OPTIONS:
            labels = data.get('option_labels', [])
            values = data.get('option_values', [])
            if not labels or len(labels) != len(values):
                return jsonify({"error": "选项标签和值必须提供且数量一致"}), 400
            options_data = [{"label": label, "value": value} for label, value in zip(labels, values) if label]
            if not options_data:
                 return jsonify({"error": "对于此字段类型，选项内容不能为空"}), 400

        if not data.get('label', '').strip() or not data.get('name', '').strip() or not field_type:
            return jsonify({"error": "标签、内部名称和字段类型均为必填项"}), 400

        existing_field = FieldDefinition.query.filter_by(sheet_id=sheet_id, name=data['name']).first()
        if existing_field:
            return jsonify({"error": f"字段内部名称 '{data['name']}' 已存在"}), 400

        last_field = FieldDefinition.query.filter_by(sheet_id=sheet_id).order_by(
            FieldDefinition.display_order.desc()).first()
        new_order = (last_field.display_order + 1) if last_field else 0

        new_field = FieldDefinition(
            sheet_id=sheet_id, name=data['name'], label=data['label'], field_type=data['field_type'],
            options=options_data, default_value=data.get('default_value'),
            help_tip=data.get('help_tip'), display_order=new_order,
            export_word_as_label=data.get('export_word_as_label', False),
            export_excel_as_label=data.get('export_excel_as_label', True)
        )
        db.session.add(new_field)
        db.session.flush()

        validation_data = data.get('validation', {})
        for rule_type, rule_value in validation_data.items():
            if rule_value or rule_value is False:
                db.session.add(ValidationRule(field_id=new_field.id, rule_type=rule_type, rule_value=str(rule_value)))

        db.session.commit()
        return jsonify({"message": "新字段创建成功", "id": new_field.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_fields_bp.route('/api/fields/<int:field_id>', methods=['DELETE'])
def delete_field(field_id):
    try:
        field = FieldDefinition.query.get_or_404(field_id)
        db.session.delete(field)
        db.session.commit()
        return jsonify({"message": "字段已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_fields_bp.route('/api/fields/<int:field_id>', methods=['PUT'])
def update_field(field_id):
    try:
        field = FieldDefinition.query.get_or_404(field_id)
        data = request.json
        field_type = data.get('field_type', field.field_type)

        options_data = field.options
        if field_type in FIELD_TYPES_REQUIRING_OPTIONS:
            labels = data.get('option_labels', [])
            values = data.get('option_values', [])
            if not labels or len(labels) != len(values):
                return jsonify({"error": "选项标签和值必须提供且数量一致"}), 400
            options_data = [{"label": label, "value": value} for label, value in zip(labels, values) if label]
            if not options_data:
                 return jsonify({"error": "对于此字段类型，选项内容不能为空"}), 400

        field.label = data.get('label', field.label)
        field.field_type = field_type
        field.options = options_data
        field.default_value = data.get('default_value')
        field.help_tip = data.get('help_tip')

        if 'export_word_as_label' in data:
            field.export_word_as_label = data.get('export_word_as_label')
        if 'export_excel_as_label' in data:
            field.export_excel_as_label = data.get('export_excel_as_label')

        ValidationRule.query.filter_by(field_id=field_id).delete()
        validation_data = data.get('validation', {})
        for rule_type, rule_value in validation_data.items():
            if rule_value or rule_value is False:
                db.session.add(ValidationRule(field_id=field_id, rule_type=rule_type, rule_value=str(rule_value)))

        db.session.commit()
        return jsonify({"message": f"字段 '{field.label}' 更新成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_fields_bp.route('/api/sheets/<int:sheet_id>/fields/reorder', methods=['POST'])
def reorder_fields(sheet_id):
    try:
        data = request.json
        field_ids = data.get('order', [])
        for index, field_id in enumerate(field_ids):
            field = FieldDefinition.query.get(field_id)
            if field and field.sheet_id == int(sheet_id):
                field.display_order = index
        db.session.commit()
        return jsonify({"message": "字段顺序更新成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
