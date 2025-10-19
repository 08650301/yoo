# app/routes/api/exports.py

from flask import Blueprint, jsonify
from app.models import SheetDefinition, WordTemplateChapter
from app.services.preview_generator import generate_preview_html

api_exports_bp = Blueprint('api_exports', __name__, url_prefix='/api')


# ==============================================================================
# 预览与导出 API
# ==============================================================================

@api_exports_bp.route('/projects/<int:project_id>/export/<string:section_name>')
def export_project_excel(project_id, section_name):
    """导出指定项目、指定分区的Excel文件"""
    return jsonify({"message": "Not implemented"}), 501


@api_exports_bp.route('/projects/<int:project_id>/preview', methods=['GET'])
def get_word_preview(project_id):
    """获取整个项目的Word预览"""
    return jsonify({"error": "此功能尚未实现"}), 501


@api_exports_bp.route('/sheets/<int:sheet_id>/preview', methods=['GET'])
def get_sheet_preview(sheet_id):
    """获取单个Sheet关联章节的HTML预览"""
    sheet = SheetDefinition.query.get_or_404(sheet_id)

    if not sheet.word_template_chapter_id:
        return jsonify({"error": "此表单没有关联任何章节文档。"}), 404

    chapter = WordTemplateChapter.query.get(sheet.word_template_chapter_id)
    if not chapter or not chapter.filepath:
        return jsonify({"error": "关联的章节文档文件不存在或已丢失。"}), 404

    html_content = generate_preview_html(chapter.filepath)

    if html_content is None:
        return jsonify({"error": "转换Word文档为HTML时发生错误。"}), 500

    return jsonify({"html": html_content})


@api_exports_bp.route('/projects/<int:project_id>/export_word', methods=['GET'])
def export_word_document(project_id):
    """导出最终的Word文档"""
    return jsonify({"message": "Not implemented"}), 501
