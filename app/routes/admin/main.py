# app/routes/admin/main.py

from flask import Blueprint, render_template, abort
from sqlalchemy.orm import joinedload
from app import db
from app.models import Template, Section, SheetDefinition

# 这个蓝图负责后台管理的核心页面渲染
admin_main_bp = Blueprint('admin_main', __name__)

@admin_main_bp.route('/templates')
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


@admin_main_bp.route('/template/<int:template_id>')
def admin_template_detail(template_id):
    template = Template.query.get_or_404(template_id)
    sections = template.sections
    return render_template('admin/admin_template_detail.html', template=template, sections=sections,
                           dynamic_models=[], readonly=not template.is_latest)


@admin_main_bp.route('/templates/history/<string:template_name>')
def admin_template_history(template_name):
    versions = Template.query.filter_by(name=template_name).order_by(Template.version.desc()).all()
    if not versions:
        abort(404)
    return render_template('admin/admin_template_history.html', versions=versions, template_name=template_name)


@admin_main_bp.route('/sheet/<int:sheet_id>/fields')
def admin_sheet_fields(sheet_id):
    sheet = SheetDefinition.query.options(joinedload(SheetDefinition.section).joinedload(Section.template)).get_or_404(
        sheet_id)

    is_column_mode = (sheet.sheet_type == 'dynamic_table')

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
            "export_word_as_label": field.export_word_as_label,
            "export_excel_as_label": field.export_excel_as_label,
            "validation_rules": [{"rule_type": rule.rule_type, "rule_value": rule.rule_value} for rule in
                                 field.validation_rules]
        }
        fields_json.append(field_dict)

    from flask import json
    fields_data = json.dumps(fields_json, ensure_ascii=False)

    return render_template('admin/admin_sheet_fields.html', sheet=sheet, fields_data=fields_data, is_column_mode=is_column_mode)
