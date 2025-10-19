# app/routes/admin/rules.py

from flask import Blueprint, jsonify, request
from app import db
from app.models import ConditionalRule

admin_rules_bp = Blueprint('admin_rules', __name__, url_prefix='/admin/api')

# ==============================================================================
# 联动规则 (Conditional Rules) 管理 API
# ==============================================================================

def is_rule_self_referential(definition):
    """
    检查联动规则的触发字段是否也是其目标字段之一，以防止死循环。
    """
    if not isinstance(definition, dict):
        return False
    if_clause = definition.get('if')
    if not isinstance(if_clause, dict):
        return False
    trigger_field = if_clause.get('field')
    if not trigger_field:
        return False
    then_clauses = definition.get('then', [])
    if not isinstance(then_clauses, list):
        return False
    for action in then_clauses:
        if isinstance(action, dict):
            targets = action.get('targets', [])
            if isinstance(targets, list) and trigger_field in targets:
                return True
    return False


@admin_rules_bp.route('/sheets/<int:sheet_id>/conditional_rules', methods=['GET'])
def get_conditional_rules(sheet_id):
    """获取指定表单的所有联动规则"""
    try:
        rules = ConditionalRule.query.filter_by(sheet_id=sheet_id).order_by(ConditionalRule.id).all()
        return jsonify(
            [{"id": r.id, "name": r.name, "sheet_id": r.sheet_id, "definition": r.definition} for r in rules])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_rules_bp.route('/sheets/<int:sheet_id>/conditional_rules', methods=['POST'])
def create_conditional_rule(sheet_id):
    """为指定表单创建一个新的联动规则"""
    try:
        data = request.json
        if not data or not data.get('name') or not data.get('definition'):
            return jsonify({"error": "规则名称和定义为必填项"}), 400

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


@admin_rules_bp.route('/conditional_rules/<int:rule_id>', methods=['PUT'])
def update_conditional_rule(rule_id):
    """更新一个联动规则"""
    try:
        rule = ConditionalRule.query.get_or_404(rule_id)
        data = request.json
        if not data or not data.get('name') or not data.get('definition'):
            return jsonify({"error": "规则名称和定义为必填项"}), 400

        if is_rule_self_referential(data.get('definition')):
            return jsonify({"error": "联动规则配置错误：触发条件的字段不能作为目标字段，这会造成死循环。"}), 400

        rule.name = data['name']
        rule.definition = data['definition']
        db.session.commit()
        return jsonify({"message": f"规则 '{rule.name}' 已更新"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@admin_rules_bp.route('/conditional_rules/<int:rule_id>', methods=['DELETE'])
def delete_conditional_rule(rule_id):
    """删除一个联动规则"""
    try:
        rule = ConditionalRule.query.get_or_404(rule_id)
        db.session.delete(rule)
        db.session.commit()
        return jsonify({"message": "联动规则已删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
