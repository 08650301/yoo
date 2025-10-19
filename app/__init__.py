import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    """
    应用工厂函数。
    """
    basedir = os.getcwd()
    app = Flask(__name__, instance_relative_config=True,
                template_folder='templates', static_folder='static') # 修正路径

    app.config.from_mapping(
        SECRET_KEY='dev',
        SQLALCHEMY_DATABASE_URI='sqlite:///' + os.path.join(basedir, 'site.db'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    db.init_app(app)
    migrate.init_app(app, db, directory=os.path.join(basedir, 'migrations'))

    with app.app_context():
        from . import models

        # 导入并注册蓝图
        from .routes.main import main_bp
        from .routes.api import api_bp

        # 导入新的后台管理蓝图
        from .routes.admin.main import admin_main_bp
        from .routes.admin.templates import admin_templates_bp
        from .routes.admin.sections import admin_sections_bp
        from .routes.admin.sheets import admin_sheets_bp
        from .routes.admin.fields import admin_fields_bp
        from .routes.admin.rules import admin_rules_bp
        from .routes.admin.chapters import admin_chapters_bp

        app.register_blueprint(main_bp)
        app.register_blueprint(api_bp)

        # 注册所有后台管理的蓝图，并统一添加 /admin 前缀
        app.register_blueprint(admin_main_bp, url_prefix='/admin')
        app.register_blueprint(admin_templates_bp, url_prefix='/admin')
        app.register_blueprint(admin_sections_bp, url_prefix='/admin')
        app.register_blueprint(admin_sheets_bp, url_prefix='/admin')
        app.register_blueprint(admin_fields_bp, url_prefix='/admin')
        app.register_blueprint(admin_rules_bp, url_prefix='/admin')
        app.register_blueprint(admin_chapters_bp, url_prefix='/admin')

        return app
