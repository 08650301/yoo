import pandas as pd
import re
import os
from flask import Blueprint, jsonify, request, render_template, abort
from werkzeug.utils import secure_filename
from sqlalchemy.orm import joinedload
from app import db
from app.models import (
    Template, Section, SheetDefinition, FieldDefinition, ValidationRule, ConditionalRule,
    DYNAMIC_TABLE_MODELS
)

# 这个蓝图处理所有与后台管理界面相关的路由
admin_bp = Blueprint('admin', __name__)


# ==============================================================================
# 后台管理页面路由
# ==============================================================================

@admin_bp.route('/templates')
def admin_templates():
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


@admin_bp.route('/template/<int:template_id>')
def admin_template_detail(template_id):
    template = Template.query.get_or_404(template_id)
    sections = template.sections
    # 【修复】将 dict_keys 转换为 list，以避免 JSON 序列化错误
    dynamic_models_list = list(DYNAMIC_TABLE_MODELS.keys())
    return render_template('admin/admin_template_detail.html', template=template, sections=sections,
                           dynamic_models=dynamic_models_list, readonly=not template.is_latest)


@admin_bp.route('/templates/history/<string:template_name>')
def admin_template_history(template_name):
    versions = Template.query.filter_by(name=template_name).order_by(Template.version.desc()).all()
    if not versions:
        abort(404)
    return render_template('admin/admin_template_history.html', versions=versions, template_name=template_name)


@admin_bp.route('/sheet/<int:sheet_id>/fields')
def admin_sheet_fields(sheet_id):
    sheet = SheetDefinition.query.options(joinedload(SheetDefinition.section).joinedload(Section.template)).get_or_404(
        sheet_id)

    fields_query = sheet.fields
    fields_json = []
    for field in fields_query:
        field_dict = {
            "id": field.id,
            "sheet_id": field.sheet_id,
            "name": field.name,
            "label": field.label,
            "field_type": field.field_type,
            "options": field.options,
            "default_value": field.default_value,
            "help_tip": field.help_tip,
            "display_order": field.display_order,
            "validation_rules": [{"rule_type": rule.rule_type, "rule_value": rule.rule_value} for rule in
                                 field.validation_rules]
        }
        fields_json.append(field_dict)

    # 使用Flask的json.dumps确保正确的JSON序列化
    from flask import json
    fields_data = json.dumps(fields_json, ensure_ascii=False)

    return render_template('admin/admin_sheet_fields.html', sheet=sheet, fields_data=fields_data)


# ==============================================================================
# 后台管理API
# 注意：这些 API 的 URL 路径现在会自动带上 /admin 前缀
# ==============================================================================

@admin_bp.route('/api/templates/reorder', methods=['POST'])
def reorder_templates():
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

# ==============================================================================
# 后台管理API - Word模板上传
# ==============================================================================

UPLOAD_FOLDER = 'uploads/word_templates'
ALLOWED_EXTENSIONS = {'docx'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@admin_bp.route('/api/templates/<int:template_id>/upload_word_template', methods=['POST'])
def upload_word_template(template_id):
    template = Template.query.get_or_404(template_id)
    if 'word_template' not in request.files:
        return jsonify({"error": "没有找到文件部分"}), 400
    file = request.files['word_template']
    if file.filename == '':
        return jsonify({"error": "没有选择文件"}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(f"template_{template.id}_{template.name}_{file.filename}")

        # 确保上传目录存在
        upload_path = os.path.join(os.getcwd(), UPLOAD_FOLDER)
        os.makedirs(upload_path, exist_ok=True)

        filepath = os.path.join(upload_path, filename)

        # 如果存在旧文件，先删除
        if template.word_template_path and os.path.exists(template.word_template_path):
            try:
                os.remove(template.word_template_path)
            except OSError as e:
                # 如果文件删除失败，打印一个警告但继续执行
                print(f"Warning: could not remove old file {template.word_template_path}: {e}")

        file.save(filepath)
        template.word_template_path = filepath
        db.session.commit()
        return jsonify({"message": "Word模板上传并关联成功", "filepath": filepath}), 200
    else:
        return jsonify({"error": "文件类型不允许，请上传.docx文件"}), 400


@admin_bp.route('/api/sections/reorder', methods=['POST'])
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


@admin_bp.route('/api/sheets/reorder', methods=['POST'])
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


@admin_bp.route('/api/templates', methods=['POST'])
def create_template():
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


@admin_bp.route('/api/templates/by-name/<string:template_name>', methods=['DELETE'])
def delete_template_by_name(template_name):
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


@admin_bp.route('/api/templates/<int:template_id>/version', methods=['DELETE'])
def delete_template_version(template_id):
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


@admin_bp.route('/api/templates/<int:template_id>/set-active', methods=['POST'])
def set_template_version_active(template_id):
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


@admin_bp.route('/api/templates/<int:template_id>/status', methods=['PUT'])
def toggle_template_status(template_id):
    try:
        template = Template.query.get_or_404(template_id)
        data = request.json
        new_status = data.get('status')
        if new_status not in ['published', 'draft']:
            return jsonify({"error": "无效的状态"}), 400
        if new_status == 'published':
            Template.query.filter(
                Template.name == template.name,
                Template.id != template_id
            ).update({"status": "draft"})
        template.status = new_status
        db.session.commit()
        return jsonify({"message": f"模板 '{template.name}' 状态已更新为 {new_status}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/templates/<int:template_id>/clone', methods=['POST'])
def clone_template(template_id):
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


@admin_bp.route('/api/templates/<int:template_id>/import', methods=['POST'])
def import_sheets_from_excel(template_id):
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


@admin_bp.route('/api/templates/<int:template_id>/sections', methods=['POST'])
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


@admin_bp.route('/api/sections/<int:section_id>', methods=['PUT'])
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


@admin_bp.route('/api/sections/<int:section_id>', methods=['DELETE'])
def delete_section(section_id):
    try:
        section = Section.query.get_or_404(section_id)
        db.session.delete(section)
        db.session.commit()
        return jsonify({"message": "分区已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/sections/<int:section_id>/sheets', methods=['POST'])
def create_sheet(section_id):
    try:
        data = request.json
        name = data.get('name', '').strip()
        sheet_type = data.get('type')
        model_identifier = data.get('model_identifier')
        if not name:
            return jsonify({"error": "Sheet名称不能为空"}), 400
        if sheet_type not in ['fixed_form', 'dynamic_table']:
            return jsonify({"error": "无效的Sheet类型"}), 400
        if sheet_type == 'dynamic_table' and not model_identifier:
            return jsonify({"error": "动态表格必须选择一个数据模型"}), 400

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


@admin_bp.route('/api/sheets/<int:sheet_id>', methods=['DELETE'])
def delete_sheet(sheet_id):
    try:
        sheet = SheetDefinition.query.get_or_404(sheet_id)
        db.session.delete(sheet)
        db.session.commit()
        return jsonify({"message": "Sheet已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/sheets/<int:sheet_id>/fields', methods=['POST'])
def create_field(sheet_id):
    try:
        data = request.json
        if not data.get('label', '').strip() or not data.get('name', '').strip() or not data.get('field_type'):
            return jsonify({"error": "标签、内部名称和字段类型均为必填项"}), 400

        # 检查字段名称是否已存在
        existing_field = FieldDefinition.query.filter_by(sheet_id=sheet_id, name=data['name']).first()
        if existing_field:
            return jsonify({"error": f"字段内部名称 '{data['name']}' 已存在"}), 400

        last_field = FieldDefinition.query.filter_by(sheet_id=sheet_id).order_by(
            FieldDefinition.display_order.desc()).first()
        new_order = (last_field.display_order + 1) if last_field else 0

        new_field = FieldDefinition(
            sheet_id=sheet_id, name=data['name'], label=data['label'], field_type=data['field_type'],
            options=data.get('options'), default_value=data.get('default_value'),
            help_tip=data.get('help_tip'), display_order=new_order
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


@admin_bp.route('/api/fields/<int:field_id>', methods=['DELETE'])
def delete_field(field_id):
    try:
        field = FieldDefinition.query.get_or_404(field_id)
        db.session.delete(field)
        db.session.commit()
        return jsonify({"message": "字段已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/fields/<int:field_id>', methods=['PUT'])
def update_field(field_id):
    try:
        field = FieldDefinition.query.get_or_404(field_id)
        data = request.json

        # The 'name' attribute is now immutable and cannot be changed after creation.
        # The following block has been removed:
        # if 'name' in data and data['name'] != field.name:
        #     ...

        field.label = data.get('label', field.label)
        field.field_type = data.get('field_type', field.field_type)
        field.options = data.get('options')
        field.default_value = data.get('default_value')
        field.help_tip = data.get('help_tip')

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


@admin_bp.route('/api/sheets/<int:sheet_id>/fields/reorder', methods=['POST'])
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


# ==============================================================================
# 后台管理API - 联动规则 (Conditional Rules)
# ==============================================================================

def is_rule_self_referential(definition):
    """
    检查联动规则的触发字段是否也是其目标字段之一，以防止死循环。
    """
    if not isinstance(definition, dict):
        return False

    # 从 'if' 条件中获取触发字段
    if_clause = definition.get('if')
    if not isinstance(if_clause, dict):
        return False

    trigger_field = if_clause.get('field')
    if not trigger_field:
        return False

    # 检查 'then' 动作中的所有目标字段
    then_clauses = definition.get('then', [])
    if not isinstance(then_clauses, list):
        return False

    for action in then_clauses:
        if isinstance(action, dict):
            targets = action.get('targets', [])
            if isinstance(targets, list) and trigger_field in targets:
                return True  # 检测到自我引用

    return False


@admin_bp.route('/api/sheets/<int:sheet_id>/conditional_rules', methods=['GET'])
def get_conditional_rules(sheet_id):
    try:
        rules = ConditionalRule.query.filter_by(sheet_id=sheet_id).order_by(ConditionalRule.id).all()
        return jsonify(
            [{"id": r.id, "name": r.name, "sheet_id": r.sheet_id, "definition": r.definition} for r in rules])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/sheets/<int:sheet_id>/conditional_rules', methods=['POST'])
def create_conditional_rule(sheet_id):
    try:
        data = request.json
        if not data or not data.get('name') or not data.get('definition'):
            return jsonify({"error": "规则名称和定义为必填项"}), 400

        # 【优化】在这里添加死循环验证
        if is_rule_self_referential(data.get('definition')):
            return jsonify({"error": "联动规则配置错误：触发条件的字段不能作为目标字段，这会造成死循环。"}), 400

        new_rule = ConditionalRule(
            sheet_id=sheet_id,
            name=data['name'],
            definition=data['definition']
        )
        db.session.add(new_rule)
        db.session.commit()
        return jsonify({"message": "新联动规则已创建", "id": new_rule.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/conditional_rules/<int:rule_id>', methods=['PUT'])
def update_conditional_rule(rule_id):
    try:
        rule = ConditionalRule.query.get_or_404(rule_id)
        data = request.json
        if not data or not data.get('name') or not data.get('definition'):
            return jsonify({"error": "规则名称和定义为必填项"}), 400

        # 【优化】在这里添加死循环验证
        if is_rule_self_referential(data.get('definition')):
            return jsonify({"error": "联动规则配置错误：触发条件的字段不能作为目标字段，这会造成死循环。"}), 400

        rule.name = data['name']
        rule.definition = data['definition']
        db.session.commit()
        return jsonify({"message": f"规则 '{rule.name}' 已更新"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/conditional_rules/<int:rule_id>', methods=['DELETE'])
def delete_conditional_rule(rule_id):
    try:
        rule = ConditionalRule.query.get_or_404(rule_id)
        db.session.delete(rule)
        db.session.commit()
        return jsonify({"message": "联动规则已删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
