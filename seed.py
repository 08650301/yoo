# seed.py
import os
from app import create_app, db
from app.models import Template, Section, SheetDefinition, FieldDefinition

def seed_data():
    app = create_app()
    with app.app_context():
        # 确保 instance 文件夹存在
        if not os.path.exists(app.instance_path):
            os.makedirs(app.instance_path)

        db.drop_all()
        db.create_all()

        template = Template(name="测试模板", status='published', is_latest=True)
        db.session.add(template)
        db.session.flush()

        section = Section(template_id=template.id, name="基本信息")
        db.session.add(section)
        db.session.flush()

        sheet = SheetDefinition(section_id=section.id, name="用户信息", sheet_type='fixed_form')
        db.session.add(sheet)
        db.session.flush()

        field1 = FieldDefinition(sheet_id=sheet.id, name="username", label="用户名", field_type='text')
        field2 = FieldDefinition(sheet_id=sheet.id, name="email", label="邮箱", field_type='text')

        db.session.add_all([field1, field2])
        db.session.commit()
        print("测试数据创建成功！")
        print(f"Sheet ID: {sheet.id}")
        print(f"字段 '用户名' ID: {field1.id}")


if __name__ == "__main__":
    seed_data()
