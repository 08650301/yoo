# app/routes/api/data.py

from flask import Blueprint, jsonify, request
from app import db
from app.models import (
    Project, Template, Section, SheetDefinition, FieldDefinition, ConditionalRule,
    FixedFormData, DynamicTableRow
)

api_data_bp = Blueprint('api_data', __name__, url_prefix='/api')


# ==============================================================================
# 辅助函数
# ==============================================================================

def get_config_from_db(procurement_method):
    """根据采购方式（模板名称）从数据库动态生成前端所需的配置JSON"""
    template = Template.query.filter_by(name=procurement_method, status='published', is_latest=True).first()
    if not template:
        return None

    config = {"sections": {}}
    sections_query = Section.query.filter_by(template_id=template.id).order_by(Section.display_order).all()

    for section in sections_query:
        section_config = {"order": [], "forms": {}}
        sheets_query = SheetDefinition.query.filter_by(section_id=section.id).order_by(
            SheetDefinition.display_order).all()

        for sheet in sheets_query:
            section_config["order"].append(sheet.name)
            sheet_config = {
                "id": sheet.id,
                "type": sheet.sheet_type,
                "model_identifier": sheet.model_identifier
            }
            fields_query = FieldDefinition.query.filter_by(sheet_id=sheet.id).order_by(
                FieldDefinition.display_order).all()

            fields_list = []
            for f in fields_query:
                fields_list.append({
                    "name": f.name, "label": f.label, "field_type": f.field_type,
                    "default_value": f.default_value, "options": f.options,
                    "validation_rules": [{"rule_type": r.rule_type, "rule_value": r.rule_value} for r in f.validation_rules]
                })

            if sheet.sheet_type == 'fixed_form':
                sheet_config['fields'] = fields_list
                rules = ConditionalRule.query.filter_by(sheet_id=sheet.id).order_by(ConditionalRule.id).all()
                sheet_config['conditional_rules'] = [{"id": r.id, "name": r.name, "definition": r.definition} for r in rules]
            else:
                sheet_config['columns'] = fields_list

            section_config["forms"][sheet.name] = sheet_config
        config["sections"][section.name] = section_config
    return config


def find_sheet_config_from_db(procurement_method, sheet_name):
    """根据采购方式和Sheet名称，查找单个Sheet的配置"""
    template = Template.query.filter_by(name=procurement_method, is_latest=True).first()
    if not template:
        return None

    sheet_def = SheetDefinition.query.join(Section).filter(
        Section.template_id == template.id,
        SheetDefinition.name == sheet_name
    ).first()
    if not sheet_def:
        return None

    config = {"type": sheet_def.sheet_type, "model_identifier": sheet_def.model_identifier}
    fields_query = FieldDefinition.query.filter_by(sheet_id=sheet_def.id).order_by(FieldDefinition.display_order).all()
    fields_list = [{"name": f.name, "label": f.label, "field_type": f.field_type, "default_value": f.default_value} for f in fields_query]

    if sheet_def.sheet_type == 'fixed_form':
        config['fields'] = fields_list
    else:
        config['columns'] = fields_list
    return config


# ==============================================================================
# 配置获取与数据存取 API
# ==============================================================================

@api_data_bp.route('/forms-config/<string:method>')
def get_forms_config_api(method):
    """获取指定采购方式（模板）的完整表单配置"""
    config = get_config_from_db(method)
    if config:
        return jsonify(config)
    return jsonify({"error": "未知的或未发布的采购方式"}), 404


@api_data_bp.route('/published-templates')
def get_published_templates():
    """获取所有已发布的模板名称列表"""
    templates = Template.query.filter_by(status='published', is_latest=True).order_by(Template.display_order).all()
    return jsonify([t.name for t in templates])


@api_data_bp.route('/projects/<int:project_id>/sheets/<string:sheet_name>', methods=['GET'])
def get_sheet_data(project_id, sheet_name):
    """获取指定项目、指定表单的已存数据"""
    project = Project.query.get_or_404(project_id)
    config = find_sheet_config_from_db(project.procurement_method, sheet_name)
    if not config:
        return jsonify({"error": "Sheet名称不存在"}), 404

    sheet_def = SheetDefinition.query.filter_by(name=sheet_name).first_or_404()

    if config['type'] == 'fixed_form':
        return jsonify({entry.field_name: entry.field_value for entry in
                        FixedFormData.query.filter_by(project_id=project_id, sheet_name=sheet_name).all()})
    elif config['type'] == 'dynamic_table':
        rows = DynamicTableRow.query.filter_by(
            project_id=project_id,
            sheet_id=sheet_def.id
        ).order_by(DynamicTableRow.display_order).all()
        return jsonify([row.data for row in rows])


@api_data_bp.route('/projects/<int:project_id>/sheets/<string:sheet_name>', methods=['POST'])
def save_sheet_data(project_id, sheet_name):
    """保存指定项目、指定表单的数据"""
    try:
        project = Project.query.get_or_404(project_id)
        config = find_sheet_config_from_db(project.procurement_method, sheet_name)
        if not config:
            return jsonify({"error": "Sheet配置不存在"}), 404

        data = request.json
        sheet_def = SheetDefinition.query.filter_by(name=sheet_name).first_or_404()

        if config['type'] == 'fixed_form':
            FixedFormData.query.filter_by(project_id=project_id, sheet_name=sheet_name).delete()
            for field_name, field_value in data.items():
                if field_value is not None:
                    entry = FixedFormData(
                        project_id=project_id, sheet_name=sheet_name,
                        field_name=field_name, field_value=str(field_value)
                    )
                    db.session.add(entry)
        elif config['type'] == 'dynamic_table':
            DynamicTableRow.query.filter_by(project_id=project_id, sheet_id=sheet_def.id).delete()
            for index, row_data in enumerate(data):
                if any(val for val in row_data.values()):
                    entry = DynamicTableRow(
                        project_id=project_id, sheet_id=sheet_def.id,
                        data=row_data, display_order=index
                    )
                    db.session.add(entry)

        db.session.commit()
        return jsonify({"message": f"表单 '{sheet_name}' 数据已成功保存"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"保存数据时发生错误: {str(e)}"}), 500
