# app/routes/api/templates.py
import os
from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename
from app import db
from app.models import Section, SheetDefinition, WordTemplateChapter

api_templates_bp = Blueprint('api_templates', __name__, url_prefix='/api')

ALLOWED_EXTENSIONS = {'docx'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@api_templates_bp.route('/sections/<int:section_id>/word-templates', methods=['POST'])
def upload_word_template_to_section(section_id):
    """上传Word模板到指定的分区(Section)，并创建一个章节(WordTemplateChapter)记录。"""
    section = Section.query.get_or_404(section_id)

    if 'file' not in request.files:
        return jsonify({"error": "请求中没有文件部分"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "没有选择文件"}), 400

    if file and allowed_file(file.filename):
        # 使用原始文件名，以便支持中文等字符
        filename = file.filename

        # 创建上传目录
        upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'])
        os.makedirs(upload_folder, exist_ok=True)

        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)

        # 检查是否已存在同名文件记录
        existing_chapter = WordTemplateChapter.query.filter_by(
            section_id=section_id,
            filename=filename
        ).first()

        if existing_chapter:
            # 如果存在，则更新路径（覆盖文件）
            existing_chapter.filepath = filepath
            db.session.commit()
            chapter = existing_chapter
        else:
            # 如果不存在，则创建新记录
            # 计算 display_order
            max_order = db.session.query(db.func.max(WordTemplateChapter.display_order)).filter_by(section_id=section_id).scalar() or 0

            chapter = WordTemplateChapter(
                section_id=section_id,
                filename=filename,
                filepath=filepath,
                display_order=max_order + 1
            )
            db.session.add(chapter)
            db.session.commit()

        return jsonify({
            "id": chapter.id,
            "filename": chapter.filename,
            "display_order": chapter.display_order
        }), 201

    return jsonify({"error": "不允许的文件类型"}), 400

@api_templates_bp.route('/sheets/<int:sheet_id>/associate-template', methods=['POST'])
def associate_sheet_to_template(sheet_id):
    """将一个上传的Word模板章节(WordTemplateChapter)关联到一个表单(SheetDefinition)。"""
    sheet = SheetDefinition.query.get_or_404(sheet_id)
    data = request.json

    if not data or 'word_template_chapter_id' not in data:
        return jsonify({"error": "请求体中缺少 'word_template_chapter_id'"}), 400

    chapter_id = data['word_template_chapter_id']

    if chapter_id is None:
        # 如果传入ID为null，则表示解除关联
        sheet.word_template_chapter_id = None
        db.session.commit()
        return jsonify({"message": "已成功解除模板关联"})

    chapter = WordTemplateChapter.query.get_or_404(chapter_id)

    # 确保章节和表单属于同一个模板
    if sheet.section.template_id != chapter.section.template_id:
        return jsonify({"error": "章节和表单不属于同一个主模板，无法关联"}), 400

    sheet.word_template_chapter_id = chapter_id
    db.session.commit()

    return jsonify({"message": f"表单 '{sheet.name}' 已成功关联到模板 '{chapter.filename}'"})
