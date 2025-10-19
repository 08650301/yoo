# app/routes/admin/templates.py

import re
import pandas as pd
from flask import Blueprint, jsonify, request, render_template, abort
from app import db
from app.models import Template, Section, SheetDefinition, FieldDefinition, ValidationRule

# 创建一个新的蓝图，用于管理模板相关的后台页面和API
admin_templates_bp = Blueprint('admin_templates', __name__, url_prefix='/admin')

# ==============================================================================
# 模板管理页面
# ==============================================================================

@admin_templates_bp.route('/templates')
def admin_templates():
    """显示所有最新版本的模板列表"""
    templates_query = Template.query.filter_by(is_latest=True).order_by(Template.display_order).all()
    template_data = []
    for t in templates_query:
        version_count = db.session.query(db.func.count(Template.id)).filter_by(name=t.name).scalar()
        template_data.append({
            'name': t.name,
            'version': t.version,
            'status': t.status,
            'id': t.id,
            'version_count': version_count
        })
    return render_template('admin/admin_templates.html', templates=template_data)


@admin_templates_bp.route('/template/<int:template_id>')
def admin_template_detail(template_id):
    """显示单个模板版本的详细信息，包括其下的分区和表单"""
    template = Template.query.get_or_404(template_id)
    sections = template.sections
    return render_template('admin/admin_template_detail.html', template=template, sections=sections,
                           readonly=not template.is_latest)


@admin_templates_bp.route('/templates/history/<string:template_name>')
def admin_template_history(template_name):
    """显示一个模板的所有历史版本"""
    versions = Template.query.filter_by(name=template_name).order_by(Template.version.desc()).all()
    if not versions:
        abort(404)
    return render_template('admin/admin_template_history.html', versions=versions, template_name=template_name)


# ==============================================================================
# 模板管理 API
# ==============================================================================

@admin_templates_bp.route('/api/templates/reorder', methods=['POST'])
def reorder_templates():
    """更新模板的显示顺序"""
    try:
        data = request.json
        template_ids = data.get('order', [])
        for index, template_id in enumerate(template_ids):
            template = Template.query.get(template_id)
            if template:
                template.display_order = index
        db.session.commit()
        return jsonify({"message": "模板顺序更新成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_templates_bp.route('/api/templates', methods=['POST'])
def create_template():
    """创建一个新的模板"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        if not name:
            return jsonify({"error": "模板名称不能为空"}), 400
        if Template.query.filter_by(name=name, is_latest=True).first():
            return jsonify({"error": "该模板名称已存在"}), 400

        max_order = db.session.query(db.func.max(Template.display_order)).filter_by(is_latest=True).scalar() or -1
        new_template = Template(name=name, status='draft', version=1, is_latest=True, display_order=max_order + 1)
        db.session.add(new_template)
        db.session.commit()
        return jsonify({"message": "新模板创建成功", "id": new_template.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_templates_bp.route('/api/templates/by-name/<string:template_name>', methods=['DELETE'])
def delete_template_by_name(template_name):
    """根据名称删除一个模板及其所有版本"""
    try:
        published_version = Template.query.filter_by(name=template_name, status='published').first()
        if published_version:
            return jsonify({"error": "无法删除，因为该模板尚有版本处于“已发布”状态。请先将其撤销为草稿。"}), 400

        templates_to_delete = Template.query.filter_by(name=template_name).all()
        if not templates_to_delete:
            return jsonify({"error": "找不到要删除的模板"}), 404

        for t in templates_to_delete:
            db.session.delete(t)

        db.session.commit()
        return jsonify({"message": f"模板 '{template_name}' 及其所有版本已成功删除。"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_templates_bp.route('/api/templates/<int:template_id>/version', methods=['DELETE'])
def delete_template_version(template_id):
    """删除一个指定的模板版本"""
    try:
        template_to_delete = Template.query.get_or_404(template_id)
        if template_to_delete.is_latest:
            return jsonify({"error": "不能删除最新的版本。"}), 400

        db.session.delete(template_to_delete)
        db.session.commit()
        return jsonify({"message": f"版本 V{template_to_delete.version} 已被成功删除。"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_templates_bp.route('/api/templates/<int:template_id>/set-active', methods=['POST'])
def set_template_version_active(template_id):
    """将一个指定的模板版本设置为最新版本"""
    try:
        template_to_activate = Template.query.get_or_404(template_id)
        Template.query.filter(
            Template.name == template_to_activate.name,
            Template.id != template_id
        ).update({"is_latest": False})
        template_to_activate.is_latest = True
        db.session.commit()
        return jsonify(
            {"message": f"模板 '{template_to_activate.name}' V{template_to_activate.version} 已被激活为最新版本。"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_templates_bp.route('/api/templates/<int:template_id>/status', methods=['PUT'])
def toggle_template_status(template_id):
    """切换模板的状态（草稿/已发布）"""
    try:
        template = Template.query.get_or_404(template_id)
        data = request.json
        new_status = data.get('status')
        if new_status not in ['published', 'draft']:
            return jsonify({"error": "无效的状态"}), 400
        if new_status == 'published':
            Template.query.filter(
                Template.name == template.name,
                Template.id != template.id
            ).update({"status": "draft"})
        template.status = new_status
        db.session.commit()
        return jsonify({"message": f"模板 '{template.name}' 状态已更新为 {new_status}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_templates_bp.route('/api/templates/<int:template_id>/clone', methods=['POST'])
def clone_template(template_id):
    """克隆一个现有模板，创建一个新的版本"""
    try:
        original_template = Template.query.get_or_404(template_id)
        max_version = db.session.query(db.func.max(Template.version)).filter_by(
            name=original_template.name).scalar() or 0
        current_latest = Template.query.filter_by(name=original_template.name, is_latest=True).first()
        if current_latest:
            current_latest.is_latest = False

        new_template = Template(
            name=original_template.name,
            version=max_version + 1,
            status='draft',
            is_latest=True,
            parent_id=original_template.id,
            display_order=original_template.display_order
        )
        db.session.add(new_template)
        db.session.flush()

        original_sections = Section.query.filter_by(template_id=original_template.id).order_by(
            Section.display_order).all()
        for sec in original_sections:
            new_section = Section(template_id=new_template.id, name=sec.name, display_order=sec.display_order)
            db.session.add(new_section)
            db.session.flush()
            original_sheets = SheetDefinition.query.filter_by(section_id=sec.id).order_by(
                SheetDefinition.display_order).all()
            for sheet in original_sheets:
                new_sheet = SheetDefinition(section_id=new_section.id, name=sheet.name, sheet_type=sheet.sheet_type,
                                            display_order=sheet.display_order, model_identifier=sheet.model_identifier)
                db.session.add(new_sheet)
                db.session.flush()
                original_fields = FieldDefinition.query.filter_by(sheet_id=sheet.id).order_by(
                    FieldDefinition.display_order).all()
                for field in original_fields:
                    new_field = FieldDefinition(sheet_id=new_sheet.id, name=field.name, label=field.label,
                                                field_type=field.field_type, options=field.options,
                                                default_value=field.default_value, help_tip=field.help_tip,
                                                display_order=field.display_order)
                    db.session.add(new_field)
                    db.session.flush()
                    original_rules = ValidationRule.query.filter_by(field_id=field.id).all()
                    for rule in original_rules:
                        new_rule = ValidationRule(field_id=new_field.id, rule_type=rule.rule_type,
                                                  rule_value=rule.rule_value, message=rule.message)
                        db.session.add(new_rule)
        db.session.commit()
        return jsonify({"message": f"模板 '{original_template.name}' 已成功克隆为 V{new_template.version}",
                        "new_template_id": new_template.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_templates_bp.route('/api/templates/<int:template_id>/import', methods=['POST'])
def import_sheets_from_excel(template_id):
    """从Excel文件导入多个Sheets及其字段到模板中"""
    if 'file' not in request.files:
        return jsonify({"error": "没有找到文件"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "没有选择文件"}), 400
    if not file.filename.endswith('.xlsx'):
        return jsonify({"error": "请上传 .xlsx 格式的Excel文件"}), 400

    try:
        xls = pd.ExcelFile(file.stream.read())
        last_section = Section.query.filter_by(template_id=template_id).order_by(Section.display_order.desc()).first()
        new_order = (last_section.display_order + 1) if last_section else 0
        new_section = Section(template_id=template_id, name=f"导入自 {file.filename}", display_order=new_order)
        db.session.add(new_section)
        db.session.flush()

        rule_mapping = {
            '必填': ('required', 'True'),
            '只读': ('disabled', 'True'),
            '最小长度': ('minLength', None),
            '最大长度': ('maxLength', None),
            '正则表达式': ('pattern', None),
            '最小值': ('minValue', None),
            '最大值': ('maxValue', None),
            '必须包含 (每行一个)': ('contains', None),
            '必须不包含 (每行一个)': ('excludes', None)
        }

        for sheet_order_index, sheet_name in enumerate(xls.sheet_names):
            df = pd.read_excel(xls, sheet_name=sheet_name).fillna('')
            is_fixed = '字段名' in df.columns and '录入内容' in df.columns
            sheet_type = 'fixed_form' if is_fixed else 'dynamic_table'

            if is_fixed:
                df.rename(columns={'字段名': '显示名称 (Label)', '录入内容': '默认值'}, inplace=True)

            if '显示名称 (Label)' not in df.columns:
                continue

            new_sheet = SheetDefinition(section_id=new_section.id, name=sheet_name, sheet_type=sheet_type,
                                        display_order=sheet_order_index)
            db.session.add(new_sheet)
            db.session.flush()

            fields_data = df.to_dict('records')

            for field_order, field_info in enumerate(fields_data):
                label = str(field_info.get('显示名称 (Label)', '')).strip()
                if not label:
                    continue

                name = str(field_info.get('内部名称 (Name)', '')).strip()
                if not name:
                    name = re.sub(r'\s+', '_', label.lower())

                new_field = FieldDefinition(
                    sheet_id=new_sheet.id, name=name, label=label,
                    field_type=str(field_info.get('字段类型', 'text')),
                    options=str(field_info.get('选项 (每行一个)', '')).replace('\n', ','),
                    default_value=str(field_info.get('默认值', '')),
                    help_tip=str(field_info.get('帮助提示', '')),
                    display_order=field_order
                )
                db.session.add(new_field)
                db.session.flush()

                for col_name, (rule_type, fixed_value) in rule_mapping.items():
                    if col_name in field_info and pd.notna(field_info[col_name]) and field_info[col_name] != '':
                        if fixed_value:
                            if str(field_info[col_name]).lower() in ['true', 'yes', '是', '1']:
                                db.session.add(
                                    ValidationRule(field_id=new_field.id, rule_type=rule_type, rule_value=fixed_value))
                        else:
                            rule_value = str(field_info[col_name])
                            if '(每行一个)' in col_name:
                                rule_value = rule_value.replace('\n', ',')
                            db.session.add(
                                ValidationRule(field_id=new_field.id, rule_type=rule_type, rule_value=rule_value))

        db.session.commit()
        return jsonify({"message": f"成功从 '{file.filename}' 导入 {len(xls.sheet_names)} 个Sheet！"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"导入失败: {str(e)}"}), 500
