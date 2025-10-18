# app/services/preview_generator.py

from flask import render_template_string
from app.models import (
    Project, Template, Section, SheetDefinition, FieldDefinition,
    FixedFormData, DynamicTableRow
)

def generate_project_preview_html(project_id):
    """
    生成整个项目的完整HTML预览。
    """
    project = Project.query.get_or_404(project_id)
    template = Template.query.filter_by(name=project.procurement_method, is_latest=True).first()
    if not template:
        raise ValueError("未找到项目关联的模板。")

    html_parts = []

    # 按照 display_order 获取所有章节
    sections = Section.query.filter_by(template_id=template.id).order_by(Section.display_order).all()

    for section in sections:
        html_parts.append(f"<h2>{section.name}</h2>")

        # 按照 display_order 获取章节下的所有表单
        sheets = SheetDefinition.query.filter_by(section_id=section.id).order_by(SheetDefinition.display_order).all()

        for sheet in sheets:
            html_parts.append(f"<h3>{sheet.name}</h3>")

            fields = FieldDefinition.query.filter_by(sheet_id=sheet.id).order_by(FieldDefinition.display_order).all()

            if sheet.sheet_type == 'fixed_form':
                # 处理固定表单
                data = {item.field_name: item.field_value for item in FixedFormData.query.filter_by(project_id=project.id, sheet_name=sheet.name).all()}

                # 构建值到标签的映射
                value_to_label_maps = {}
                for field in fields:
                    if field.options:
                        value_to_label_maps[field.name] = {opt['value']: opt['label'] for opt in field.options}

                preview_html = "<ul>"
                for field in fields:
                    raw_value = data.get(field.name, field.default_value or '')

                    # 使用映射转换值
                    display_value = raw_value
                    if field.name in value_to_label_maps:
                        map_dict = value_to_label_maps[field.name]
                        if field.field_type in ['select-multiple', 'checkbox-group'] and isinstance(raw_value, str):
                             # 多选值是逗号分隔的
                            selected_values = raw_value.split(',')
                            display_value = ', '.join([map_dict.get(val, val) for val in selected_values])
                        else:
                            display_value = map_dict.get(raw_value, raw_value)

                    # 创建占位符
                    placeholder = f'<span data-placeholder-for="{field.name}">{display_value or "**********"}</span>'
                    preview_html += f"<li><strong>{field.label}:</strong> {placeholder}</li>"
                preview_html += "</ul>"
                html_parts.append(preview_html)

            elif sheet.sheet_type == 'dynamic_table':
                # 处理动态表格
                rows_data = [row.data for row in DynamicTableRow.query.filter_by(project_id=project.id, sheet_id=sheet.id).order_by(DynamicTableRow.display_order).all()]

                preview_html = '<table class="table table-bordered"><thead><tr>'
                preview_html += "<th>序号</th>" # 添加序号列
                for field in fields:
                    preview_html += f"<th>{field.label}</th>"
                preview_html += "</tr></thead><tbody>"

                if rows_data:
                    for i, row in enumerate(rows_data):
                        preview_html += f"<tr><td>{i + 1}</td>" # 显示行号
                        for field in fields:
                            cell_value = row.get(field.name, '')
                            preview_html += f"<td>{cell_value}</td>"
                        preview_html += "</tr>"
                else:
                    preview_html += f'<tr><td colspan="{len(fields) + 1}" class="text-center">无数据</td></tr>'

                preview_html += "</tbody></table>"
                html_parts.append(preview_html)

    return "".join(html_parts)


def generate_sheet_preview_html(sheet_id, project_id=None):
    """
    生成单个Sheet的HTML预览。
    如果提供了 project_id，则会填充数据。
    否则，只显示字段标签和占位符。
    """
    sheet = SheetDefinition.query.get_or_404(sheet_id)
    fields = FieldDefinition.query.filter_by(sheet_id=sheet.id).order_by(FieldDefinition.display_order).all()

    html_parts = [f"<h3>{sheet.name}</h3>"]

    data = {}
    if project_id:
        if sheet.sheet_type == 'fixed_form':
            data = {item.field_name: item.field_value for item in FixedFormData.query.filter_by(project_id=project_id, sheet_name=sheet.name).all()}
        # 动态表格的数据处理在下面进行

    if sheet.sheet_type == 'fixed_form':
        preview_html = "<ul>"
        for field in fields:
            value = data.get(field.name, field.default_value or '')
            # 在这种无数据的预览模式下，我们只显示占位符
            placeholder = f'<span data-placeholder-for="{field.name}">{value or "**********"}</span>'
            preview_html += f"<li><strong>{field.label}:</strong> {placeholder}</li>"
        preview_html += "</ul>"
        html_parts.append(preview_html)

    elif sheet.sheet_type == 'dynamic_table':
        rows_data = []
        if project_id:
            rows_data = [row.data for row in DynamicTableRow.query.filter_by(project_id=project_id, sheet_id=sheet.id).order_by(DynamicTableRow.display_order).all()]

        preview_html = '<table class="table table-bordered"><thead><tr>'
        preview_html += "<th>序号</th>"
        for field in fields:
            preview_html += f"<th>{field.label}</th>"
        preview_html += "</tr></thead><tbody>"

        if rows_data:
             for i, row in enumerate(rows_data):
                preview_html += f"<tr><td>{i + 1}</td>"
                for field in fields:
                    cell_value = row.get(field.name, '')
                    preview_html += f"<td>{cell_value}</td>"
                preview_html += "</tr>"
        else:
            # 即使没有数据，也显示一个空行结构作为预览
            preview_html += '<tr>'
            preview_html += f'<td>1</td>' # 示例行号
            for field in fields:
                 preview_html += f'<td><span data-placeholder-for="{field.name}"></span></td>'
            preview_html += '</tr>'
            preview_html += f'<tr><td colspan="{len(fields) + 1}" class="text-center">无数据</td></tr>'

        preview_html += "</tbody></table>"
        html_parts.append(preview_html)

    return "".join(html_parts)
