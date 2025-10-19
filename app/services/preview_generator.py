# app/services/preview_generator.py

import mammoth
import re
import os

def generate_preview_html(docx_path):
    """
    将指定的 .docx 文件转换为 HTML，并处理其中的占位符。

    Args:
        docx_path (str): .docx 文件的路径。

    Returns:
        str: 经过处理的 HTML 字符串。
        None: 如果文件不存在或转换失败。
    """
    if not os.path.exists(docx_path):
        return None

    try:
        with open(docx_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            html = result.value

            # 使用正则表达式将 {{field_name}} 替换为 <span data-placeholder-for="field_name">**********</span>
            # 正则表达式解释:
            # \{\{      - 匹配两个左大括号
            # \s*       - 匹配零个或多个空白字符
            # ([\w\d_]+) - 捕获组1: 匹配一个或多个单词字符、数字或下划线 (即字段名)
            # \s*       - 匹配零个或多个空白字符
            # \}\}      - 匹配两个右大括号
            placeholder_pattern = re.compile(r"\{\{\s*([\w\d_]+)\s*\}\}")

            # 使用一个函数作为替换参数，这样可以从匹配对象中提取字段名
            def replace_with_span(match):
                field_name = match.group(1)
                # 初始显示内容设为星号，稍后由JS填充
                return f'<span data-placeholder-for="{field_name}">**********</span>'

            processed_html = placeholder_pattern.sub(replace_with_span, html)

            return processed_html

    except Exception as e:
        print(f"Error converting docx to html: {e}")
        return None
