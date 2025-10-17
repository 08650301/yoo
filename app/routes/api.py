import pandas as pd
from io import BytesIO
from datetime import timezone, timedelta
from flask import Blueprint, jsonify, request, send_file
from app import db
from app.models import (
    Project, Template, Section, SheetDefinition, FieldDefinition, ConditionalRule,
    FixedFormData
)
# 导入新的服务模块
from app.services import word_processor

api_bp = Blueprint('api', __name__, url_prefix='/api')

# ... (existing non-Word related routes and helpers) ...
def get_config_from_db(procurement_method):
    """
    根据采购方式（模板名称）从数据库动态生成前端所需的配置JSON。
    """
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
                "id": sheet.id, # 新增：返回sheet的ID
                "type": sheet.sheet_type,
                "model_identifier": sheet.model_identifier
            }
            fields_query = FieldDefinition.query.filter_by(sheet_id=sheet.id).order_by(
                FieldDefinition.display_order).all()

            # 为前端传递完整的字段信息，包括校验规则和选项
            fields_list = []
            for f in fields_query:
                fields_list.append({
                    "name": f.name,
                    "label": f.label,
                    "type": f.field_type,
                    "default_value": f.default_value,
                    "options": f.options,
                    "validation_rules": [{"rule_type": r.rule_type, "rule_value": r.rule_value} for r in
                                         f.validation_rules]
                })

            if sheet.sheet_type == 'fixed_form':
                sheet_config['fields'] = fields_list
                # 获取并添加联动规则
                rules = ConditionalRule.query.filter_by(sheet_id=sheet.id).order_by(ConditionalRule.id).all()
                sheet_config['conditional_rules'] = [
                    {"id": r.id, "name": r.name, "definition": r.definition} for r in rules
                ]
            else:
                sheet_config['columns'] = fields_list

            section_config["forms"][sheet.name] = sheet_config

        config["sections"][section.name] = section_config

    return config


def find_sheet_config_from_db(procurement_method, sheet_name):
    """
    根据采购方式和Sheet名称，查找单个Sheet的配置。
    """
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
    fields_list = [{"name": f.name, "label": f.label, "type": f.field_type, "default_value": f.default_value} for f in fields_query]

    if sheet_def.sheet_type == 'fixed_form':
        config['fields'] = fields_list
    else:
        config['columns'] = fields_list

    return config

# ==============================================================================
# 前端 API 路由
# ==============================================================================

@api_bp.route('/forms-config/<string:method>')
def get_forms_config_api(method):
    config = get_config_from_db(method)
    if config:
        return jsonify(config)
    return jsonify({"error": "未知的或未发布的采购方式"}), 404


@api_bp.route('/published-templates')
def get_published_templates():
    templates = Template.query.filter_by(status='published', is_latest=True).order_by(Template.display_order).all()
    return jsonify([t.name for t in templates])


@api_bp.route('/projects', methods=['GET'])
def get_projects():
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


@api_bp.route('/projects', methods=['POST'])
def create_project():
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


@api_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        project = Project.query.get_or_404(project_id)
        FixedFormData.query.filter_by(project_id=project_id).delete()
        # The dynamic table models are removed, so the loop is no longer needed.
        db.session.delete(project)
        db.session.commit()
        return jsonify({"message": "项目已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@api_bp.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
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


@api_bp.route('/projects/<int:project_id>/sheets/<string:sheet_name>', methods=['GET'])
def get_sheet_data(project_id, sheet_name):
    project = Project.query.get_or_404(project_id)
    config = find_sheet_config_from_db(project.procurement_method, sheet_name)
    if not config:
        return jsonify({"error": "Sheet名称不存在"}), 404

    if config['type'] == 'fixed_form':
        return jsonify({entry.field_name: entry.field_value for entry in
                        FixedFormData.query.filter_by(project_id=project_id, sheet_name=sheet_name).all()})
    elif config['type'] == 'dynamic_table':
        # For dynamic tables, the functionality is not yet developed.
        # Return an empty list to represent an empty table.
        return jsonify([])


@api_bp.route('/projects/<int:project_id>/sheets/<string:sheet_name>', methods=['POST'])
def save_sheet_data(project_id, sheet_name):
    """
    保存单个表单（Sheet）的数据。
    支持固定表单和动态表格两种类型。
    """
    try:
        project = Project.query.get_or_404(project_id)
        config = find_sheet_config_from_db(project.procurement_method, sheet_name)
        if not config:
            return jsonify({"error": "Sheet配置不存在"}), 404

        data = request.json

        if config['type'] == 'fixed_form':
            # 先删除该项目该表单的所有旧数据
            FixedFormData.query.filter_by(project_id=project_id, sheet_name=sheet_name).delete()
            # 插入新数据
            for field_name, field_value in data.items():
                if field_value is not None:  # 只保存非空的字段
                    entry = FixedFormData(
                        project_id=project_id,
                        sheet_name=sheet_name,
                        field_name=field_name,
                        field_value=str(field_value)
                    )
                    db.session.add(entry)

        elif config['type'] == 'dynamic_table':
            # Functionality not developed. Do nothing but act as if it succeeded.
            pass

        db.session.commit()
        return jsonify({"message": f"表单 '{sheet_name}' 数据已成功保存"})

    except Exception as e:
        db.session.rollback()
        # 在日志中记录更详细的错误
        # current_app.logger.error(f"Error saving sheet data: {e}")
        return jsonify({"error": f"保存数据时发生错误: {str(e)}"}), 500

@api_bp.route('/projects/<int:project_id>/export/<string:section_name>')
def export_project_excel(project_id, section_name):
    # ... (existing code, no changes needed here)
    pass

@api_bp.route('/projects/<int:project_id>/preview', methods=['GET'])
def get_word_preview(project_id):
    try:
        project = Project.query.get_or_404(project_id)
        html = word_processor.generate_preview_html(project)
        return jsonify({"html": html})
    except (ValueError, FileNotFoundError) as e:
        return jsonify({"html": f"<p class='text-danger'>错误: {e}</p>"})
    except Exception as e:
        return jsonify({"html": f"<p class='text-danger'>生成预览时发生未知错误: {e}</p>"})

@api_bp.route('/sheets/<int:sheet_id>/preview', methods=['GET'])
def get_sheet_preview(sheet_id):
    """获取单个Sheet关联章节的HTML预览"""
    try:
        html = word_processor.generate_single_chapter_preview_html(sheet_id)
        return jsonify({"html": html})
    except Exception as e:
        return jsonify({"html": f"<p class='text-danger'>生成预览时发生未知错误: {e}</p>"})

@api_bp.route('/projects/<int:project_id>/export_word', methods=['GET'])
def export_word_document(project_id):
    try:
        project = Project.query.get_or_404(project_id)
        template = Template.query.filter_by(name=project.procurement_method, is_latest=True).first()

        if not template:
            return jsonify({"error": "未找到有效的模板"}), 404

        # 新的导出函数不再需要 template_config
        file_stream = word_processor.generate_word_document(project, template, None)

        safe_project_name = "".join([c for c in project.name if c.isalnum() or c in (' ', '-')]).rstrip()
        filename = f"{safe_project_name}_导出.docx"

        return send_file(
            file_stream,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    except Exception as e:
        return jsonify({"error": f"生成Word文档时出错: {e}"}), 500
