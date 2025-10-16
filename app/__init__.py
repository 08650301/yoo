import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# 1. 在顶层初始化扩展，但此时不关联任何具体的 app 实例
# 这种模式允许我们在之后创建多个 app 实例（例如，用于测试）
db = SQLAlchemy()
migrate = Migrate()


def create_app():
    """
    应用工厂函数。
    Flask 会自动检测并调用这个函数来创建应用实例。
    """
    # 2. 创建 Flask app 实例
    # instance_relative_config=True 表示配置文件可以位于 instance 文件夹中，与应用代码分离
    basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    app = Flask(__name__, instance_relative_config=True,
                template_folder='templates', static_folder='static')

    # 3. 从映射配置应用
    # 这里是应用的基础配置
    app.config.from_mapping(
        SECRET_KEY='dev',  # 在生产环境中必须替换为一个长而随机的值，用于保护 session 等
        SQLALCHEMY_DATABASE_URI='sqlite:///' + os.path.join(basedir, 'site.db'),  # 数据库文件路径
        SQLALCHEMY_TRACK_MODIFICATIONS=False,  # 关闭 SQLAlchemy 的事件通知系统，以提高性能
    )

    # 4. 将扩展与创建的 app 实例关联起来
    db.init_app(app)
    migrate.init_app(app, db)

    # 5. 在应用上下文中执行后续操作
    with app.app_context():
        # 导入模型，确保在进行任何数据库操作前，SQLAlchemy 都知道这些模型
        from . import models

        # 导入并注册蓝图 (Blueprints)
        # 蓝图是组织一组相关路由的方式，使我们的应用模块化
        from .routes.main import main_bp
        from .routes.api import api_bp
        from .routes.admin import admin_bp

        # 将蓝图注册到主应用上
        app.register_blueprint(main_bp)
        app.register_blueprint(api_bp)
        # 为后台管理蓝图添加 /admin 前缀，所有此蓝图下的路由都会自动带上这个前缀
        app.register_blueprint(admin_bp, url_prefix='/admin')

        # 返回配置完成的应用实例
        return app

