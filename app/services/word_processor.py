import os
import re
import mammoth
from docx import Document
from io import BytesIO
from app.models import Project, Template, FixedFormData, DYNAMIC_TABLE_MODELS, Section, SheetDefinition, FieldDefinition

# --- Private Helper Functions ---

def _replace_text_in_paragraph(paragraph, key, value):
    """在段落中替换文本占位符"""
    if key in paragraph.text:
        inline = paragraph.runs
        for i in range(len(inline)):
            if key in inline[i].text:
                text = inline[i].text.replace(key, str(value))
                inline[i].text = text

def _replace_placeholders_in_doc(doc, placeholders):
    """替换文档中的所有文本占位符"""
    for p in doc.paragraphs:
        for key, value in placeholders.items():
            if not key.startswith('{{table_'):
                 _replace_text_in_paragraph(p, key, value)

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for key, value in placeholders.items():
                        if not key.startswith('{{table_'):
                            _replace_text_in_paragraph(p, key, value)

def _replace_table_placeholder(doc, placeholder_text, table_data, column_config):
    """查找并替换表格占位符"""
    for p in doc.paragraphs:
        if placeholder_text in p.text:
            p.text = ""
            if not table_data: return True

            headers = [col['label'] for col in column_config]
            table = doc.add_table(rows=1, cols=len(headers))
            table.style = 'Table Grid'
            hdr_cells = table.rows[0].cells
            for i, header_name in enumerate(headers):
                hdr_cells[i].text = header_name

            for item in table_data:
                row_cells = table.add_row().cells
                for i, col_config in enumerate(column_config):
                    cell_value = item.get(col_config['name'], '')
                    row_cells[i].text = str(cell_value if cell_value is not None else '')
            return True
    return False

# --- Public Service Functions ---

def generate_preview_html(project):
    """为指定项目生成Word模板的HTML预览"""
    template = Template.query.filter_by(name=project.procurement_method, is_latest=True).first()
    if not template or not template.word_template_path:
        raise ValueError("未找到或未关联有效的Word模板文件")

    if not os.path.exists(template.word_template_path):
        raise FileNotFoundError(f"Word模板文件不存在: {template.word_template_path}")

    with open(template.word_template_path, "rb") as docx_file:
        result = mammoth.convert_to_html(docx_file)
        html = result.value

        def wrap_placeholder(match):
            placeholder = match.group(1)
            return f'<span data-placeholder-for="{placeholder}">{match.group(0)}</span>'

        html = re.sub(r'\{\{([\w_]+)\}\}', wrap_placeholder, html)
        return html

def generate_word_document(project, template, template_config):
    """为指定项目生成最终的Word文档"""
    doc = Document(template.word_template_path)

    placeholders = {}
    fixed_data = FixedFormData.query.filter_by(project_id=project.id).all()
    for item in fixed_data:
        placeholders[f"{{{{{item.field_name}}}}}"] = item.field_value

    _replace_placeholders_in_doc(doc, placeholders)

    if template_config:
        for section_config in template_config.get("sections", {}).values():
            for form_config in section_config.get("forms", {}).values():
                if form_config.get("type") == "dynamic_table":
                    model_identifier = form_config.get("model_identifier")
                    table_placeholder = f"{{{{table_{model_identifier}}}}}"
                    Model = DYNAMIC_TABLE_MODELS.get(model_identifier)
                    if Model:
                        table_data = Model.query.filter_by(project_id=project.id).all()
                        table_data_dicts = [dict((col, getattr(d, col)) for col in d.__table__.columns.keys()) for d in table_data]
                        _replace_table_placeholder(doc, table_placeholder, table_data_dicts, form_config.get('columns', []))

    file_stream = BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)
    return file_stream
