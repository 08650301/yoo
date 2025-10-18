# app/services/preview_generator.py

import os
import re
import mammoth
from app.models import SheetDefinition

def _replace_placeholder(match):
    """正则表达式替换函数，将 {{field_name}} 转换为 span 标签"""
    field_name = match.group(1).strip()
    return f'<span data-placeholder-for="{field_name}">**********</span>'

def generate_sheet_preview_html(sheet_id):
    """
    【新】根据与Sheet关联的Word文档生成HTML预览。
    """
    sheet = SheetDefinition.query.get_or_404(sheet_id)

    # 1. 检查是否有关联的Word文档
    if not sheet.word_template_chapter:
        return "<p class='text-muted'>此表单没有关联任何Word文档模板，无法生成预览。</p>"

    # 2. 获取Word文档路径并检查文件是否存在
    doc_path = sheet.word_template_chapter.filepath
    if not os.path.exists(doc_path):
        return f"<p class='text-danger'>错误：找不到关联的Word文档文件：{os.path.basename(doc_path)}</p>"

    # 3. 读取.docx文件并转换为HTML
    try:
        with open(doc_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html = result.value
    except Exception as e:
        return f"<p class='text-danger'>转换Word文档时出错：{e}</p>"

    # 4. 使用正则表达式替换占位符
    # 正则表达式匹配 {{...}}，并捕获括号内的内容
    placeholder_regex = re.compile(r"\{\{([^}]+)\}\}")
    processed_html = placeholder_regex.sub(_replace_placeholder, html)

    return processed_html
