import os
import sys

# 将项目根目录添加到 PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models import Project, Template, Section, SheetDefinition, FieldDefinition, ValidationRule

def setup_comprehensive_test():
    """为全面的 Playwright 测试准备所有需要的数据。"""
    app = create_app()
    with app.app_context():
        template_name = "综合测试模板"

        # 1. 清理旧数据
        old_template = Template.query.filter_by(name=template_name).first()
        if old_template:
            db.session.delete(old_template)
        old_project = Project.query.filter_by(name="综合测试项目").first()
        if old_project:
            db.session.delete(old_project)
        db.session.commit()
        print("已清理旧的测试数据。")

        # 2. 创建新模板、分区
        template = Template(name=template_name, status='published', version=1, is_latest=True)
        db.session.add(template)
        db.session.flush()
        section = Section(template_id=template.id, name="综合测试分区")
        db.session.add(section)
        db.session.flush()
        print(f"已创建模板 '{template_name}' 和分区。")

        # 3. 创建固定表单及其字段
        fixed_sheet = SheetDefinition(section_id=section.id, name="我的固定表单", sheet_type='fixed_form', display_order=1)
        db.session.add(fixed_sheet)
        db.session.flush()

        # - 下拉单选字段
        select_field = FieldDefinition(sheet_id=fixed_sheet.id, name="test_select", label="测试下拉单选", field_type='select', options=[{"label": "选项A", "value": "A"}, {"label": "选项B", "value": "B"}])
        db.session.add(select_field)

        # - 只读文本字段
        readonly_field = FieldDefinition(sheet_id=fixed_sheet.id, name="test_readonly_fixed", label="固定表单只读字段", field_type='text')
        db.session.add(readonly_field)
        db.session.flush()
        db.session.add(ValidationRule(field_id=readonly_field.id, rule_type="disabled", rule_value="True"))
        print("已为'我的固定表单'创建字段。")

        # 4. 创建动态表格及其列
        dynamic_sheet = SheetDefinition(section_id=section.id, name="我的动态表格", sheet_type='dynamic_table', display_order=2)
        db.session.add(dynamic_sheet)
        db.session.flush()

        # - 必填列
        required_col = FieldDefinition(sheet_id=dynamic_sheet.id, name="test_required_col", label="动态表格必填列", field_type="text")
        db.session.add(required_col)
        db.session.flush()
        db.session.add(ValidationRule(field_id=required_col.id, rule_type="required", rule_value="True"))

        # - 只读列
        readonly_col = FieldDefinition(sheet_id=dynamic_sheet.id, name="test_readonly_dynamic", label="动态表格只读列", field_type="text")
        db.session.add(readonly_col)
        db.session.flush()
        db.session.add(ValidationRule(field_id=readonly_col.id, rule_type="disabled", rule_value="True"))
        print("已为'我的动态表格'创建列。")

        # 5. 创建项目
        project = Project(name="综合测试项目", number="COMP-TEST-001", procurement_method=template_name)
        db.session.add(project)
        db.session.commit()
        print(f"已创建项目 '{project.name}'。")

        # 将需要的信息写入文件
        test_info = {
            "project_id": project.id,
            "fixed_sheet_id": fixed_sheet.id,
            "fixed_sheet_name": fixed_sheet.name,
            "select_field_id": select_field.id,
            "dynamic_sheet_name": dynamic_sheet.name
        }

        return test_info

if __name__ == "__main__":
    info = setup_comprehensive_test()
    import json
    # 确保目录存在
    os.makedirs("jules-scratch/verification", exist_ok=True)
    with open("jules-scratch/verification/comprehensive_test_info.json", "w") as f:
        json.dump(info, f)
    print("全面的测试数据已成功设置！")
