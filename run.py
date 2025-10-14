# 从 app 包中导入 create_app 工厂函数
from app import create_app

# 创建 Flask 应用实例
# 这是我们应用的单一入口点。
app = create_app()

# 当直接运行此脚本时，启动开发服务器
if __name__ == '__main__':
    # host='0.0.0.0' 让服务器可以从网络中的任何计算机访问
    # debug=True 启用调试模式，这将在代码更改时自动重载服务器并提供详细的错误页面
    app.run(host='0.0.0.0', port=28080, debug=True)