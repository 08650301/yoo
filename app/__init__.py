import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# 1. 在顶层初始化扩展
db = SQLAlchemy()
migrate = Migrate()


def create_app():
    """
    应用工厂函数。
    """
    # 2. 创建 Flask app 实例
    basedir = os.getcwd()
    app = Flask(__name__, instance_relative_config=True,
                template_folder='templates', static_folder='static')

    # 3. 从映射配置应用
    app.config.from_mapping(
        SECRET_KEY='dev',
        SQLALCHEMY_DATABASE_URI='sqlite:///' + os.path.join(basedir, 'site.db'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    # 4. 将扩展与创建的 app 实例关联
    db.init_app(app)
    # 明确指定迁移目录为项目根目录下的 'migrations'
    migrate.init_app(app, db, directory=os.path.join(basedir, 'migrations'))

    # 5. 在应用上下文中执行后续操作
    with app.app_context():
        # 导入模型
        from . import models

        # ==============================================================================
        # 导入并注册蓝图 (Blueprints)
        # ==============================================================================

        # 核心页面路由
        from .routes.main import main_bp
        app.register_blueprint(main_bp)

        # 后台管理 (Admin) 路由 - 已模块化
        from .routes.admin.templates import admin_templates_bp
        from .routes.admin.sections_sheets import admin_sections_sheets_bp
        from .routes.admin.fields import admin_fields_bp
        from .routes.admin.rules import admin_rules_bp
        from .routes.admin.word_templates import admin_word_templates_bp

        # 注册 admin 蓝图 (url_prefix 在各自模块中定义)
        app.register_blueprint(admin_templates_bp)
        app.register_blueprint(admin_sections_sheets_bp)
        app.register_blueprint(admin_fields_bp)
        app.register_blueprint(admin_rules_bp)
        app.register_blueprint(admin_word_templates_bp)

        # 前端 API 路由 - 已模块化
        from .routes.api.projects import api_projects_bp
        from .routes.api.data import api_data_bp
        from .routes.api.exports import api_exports_bp

        # 注册 api 蓝图 (url_prefix 在各自模块中定义)
        app.register_blueprint(api_projects_bp)
        app.register_blueprint(api_data_bp)
        app.register_blueprint(api_exports_bp)

        return app
