# app/routes/api/exports.py

from flask import Blueprint, jsonify

api_exports_bp = Blueprint('api_exports', __name__, url_prefix='/api')


# ==============================================================================
# 预览与导出 API (待实现)
# ==============================================================================

@api_exports_bp.route('/projects/<int:project_id>/export/<string:section_name>')
def export_project_excel(project_id, section_name):
    """导出指定项目、指定分区的Excel文件"""
    # 此功能未来在这里实现
    return jsonify({"message": "Not implemented"}), 501


@api_exports_bp.route('/projects/<int:project_id>/preview', methods=['GET'])
def get_word_preview(project_id):
    """获取整个项目的Word预览"""
    # 此功能未来在这里实现
    return jsonify({"message": "Not implemented"}), 501


@api_exports_bp.route('/sheets/<int:sheet_id>/preview', methods=['GET'])
def get_sheet_preview(sheet_id):
    """获取单个Sheet关联章节的HTML预览"""
    # 此功能未来在这里实现
    return jsonify({"message": "Not implemented"}), 501


@api_exports_bp.route('/projects/<int:project_id>/export_word', methods=['GET'])
def export_word_document(project_id):
    """导出最终的Word文档"""
    # 此功能未来在这里实现
    return jsonify({"message": "Not implemented"}), 501
