# app/routes/admin/chapters.py

import os
from flask import Blueprint, jsonify, request
from app import db
from app.models import Section, SheetDefinition, WordTemplateChapter

admin_chapters_bp = Blueprint('admin_chapters', __name__)

ALLOWED_EXTENSIONS = {'docx'}
CHAPTER_UPLOAD_FOLDER = 'uploads/word_template_chapters'

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@admin_chapters_bp.route('/api/sections/<int:section_id>/chapters', methods=['POST'])
def upload_chapter_template(section_id):
    if 'file' not in request.files:
        return jsonify({"error": "没有找到文件部分"}), 400
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "没有选择文件或文件类型不正确"}), 400

    section = Section.query.get_or_404(section_id)
    filename = file.filename

    upload_path = os.path.join(os.getcwd(), CHAPTER_UPLOAD_FOLDER, str(section.id))
    os.makedirs(upload_path, exist_ok=True)
    filepath = os.path.join(upload_path, filename)

    file.save(filepath)

    max_order = db.session.query(db.func.max(WordTemplateChapter.display_order)).filter_by(section_id=section_id).scalar() or -1

    new_chapter = WordTemplateChapter(
        section_id=section_id,
        filename=filename,
        filepath=filepath,
        display_order=max_order + 1
    )
    db.session.add(new_chapter)
    db.session.commit()

    return jsonify({
        "message": "章节模板上传成功",
        "chapter": {
            "id": new_chapter.id,
            "filename": new_chapter.filename,
            "display_order": new_chapter.display_order
        }
    }), 201

@admin_chapters_bp.route('/api/chapters/<int:chapter_id>', methods=['DELETE'])
def delete_chapter_template(chapter_id):
    chapter = WordTemplateChapter.query.get_or_404(chapter_id)

    if os.path.exists(chapter.filepath):
        os.remove(chapter.filepath)

    db.session.delete(chapter)
    db.session.commit()

    return jsonify({"message": "章节模板已删除"})

@admin_chapters_bp.route('/api/sections/<int:section_id>/chapters', methods=['GET'])
def get_chapter_templates(section_id):
    results = db.session.query(
        WordTemplateChapter,
        SheetDefinition.id.label('linked_sheet_id')
    ).outerjoin(SheetDefinition, WordTemplateChapter.id == SheetDefinition.word_template_chapter_id)\
     .filter(WordTemplateChapter.section_id == section_id)\
     .order_by(WordTemplateChapter.display_order)\
     .all()

    return jsonify([{
        "id": chapter.id,
        "filename": chapter.filename,
        "display_order": chapter.display_order,
        "is_linked": linked_sheet_id is not None,
        "linked_sheet_id": linked_sheet_id
    } for chapter, linked_sheet_id in results])

@admin_chapters_bp.route('/api/chapters/reorder', methods=['POST'])
def reorder_chapters():
    data = request.json
    chapter_ids = data.get('order', [])
    for index, chapter_id in enumerate(chapter_ids):
        chapter = WordTemplateChapter.query.get(chapter_id)
        if chapter:
            chapter.display_order = index
    db.session.commit()
    return jsonify({"message": "章节模板顺序更新成功"})

@admin_chapters_bp.route('/api/sheets/<int:sheet_id>/link_chapter', methods=['POST'])
def link_sheet_to_chapter(sheet_id):
    sheet = SheetDefinition.query.get_or_404(sheet_id)
    data = request.json
    chapter_id = data.get('chapter_id')

    if not chapter_id:
        sheet.word_template_chapter_id = None
        db.session.commit()
        return jsonify({"message": "已取消文档关联"})

    chapter = WordTemplateChapter.query.get_or_404(chapter_id)
    if chapter.section_id != sheet.section_id:
        return jsonify({"error": "无法关联一个不属于此分区的章节文档"}), 400

    existing_link = SheetDefinition.query.filter_by(word_template_chapter_id=chapter_id).first()
    if existing_link and existing_link.id != sheet_id:
        return jsonify({"error": f"此章节文档已被 '{existing_link.name}' 关联，请先解除原有关系"}), 400

    sheet.word_template_chapter_id = chapter_id
    db.session.commit()

    return jsonify({"message": "文档关联成功", "chapter_id": chapter_id})
