import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    basedir = os.getcwd()
    app = Flask(__name__, instance_relative_config=True,
                template_folder='templates', static_folder='static')

    app.config.from_mapping(
        SECRET_KEY='dev',
        SQLALCHEMY_DATABASE_URI='sqlite:///' + os.path.join(basedir, 'site.db'),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_FOLDER=os.path.join(basedir, 'uploads')
    )

    db.init_app(app)
    migrate.init_app(app, db, directory=os.path.join(basedir, 'migrations'))

    with app.app_context():
        from . import models
        from datetime import datetime

        @app.context_processor
        def inject_now():
            return {'now': datetime.utcnow}

        # Core page routes
        from .routes.main import main_bp
        app.register_blueprint(main_bp)

        # Modular Admin blueprints
        from .routes.admin.sections_sheets import admin_sections_sheets_bp
        from .routes.admin.fields import admin_fields_bp
        from .routes.admin.rules import admin_rules_bp
        from .routes.admin.word_templates import admin_word_templates_bp
        from .routes.admin.pages import admin_pages_bp  # 导入新的页面蓝图
        app.register_blueprint(admin_sections_sheets_bp)
        app.register_blueprint(admin_fields_bp)
        app.register_blueprint(admin_rules_bp)
        app.register_blueprint(admin_word_templates_bp)
        app.register_blueprint(admin_pages_bp)  # 注册新的页面蓝图

        # Modular API blueprints
        from .routes.api.projects import api_projects_bp
        from .routes.api.data import api_data_bp
        from .routes.api.exports import api_exports_bp
        from .routes.api.templates import api_templates_bp
        app.register_blueprint(api_projects_bp)
        app.register_blueprint(api_data_bp)
        app.register_blueprint(api_exports_bp)
        app.register_blueprint(api_templates_bp)

        return app
