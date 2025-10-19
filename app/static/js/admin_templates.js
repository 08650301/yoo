// app/static/js/admin_templates.js

import { postAPI, putAPI, deleteAPI } from './admin/modules/api_client.js';

// 将函数附加到 window 对象，以便旧的 HTML onclick 处理器可以找到它们
window.createTemplate = function() {
    const name = document.getElementById('templateName').value;
    if (!name.trim()) {
        Swal.fire('输入错误', '模板名称不能为空！', 'warning');
        return;
    }
    postAPI('/admin/api/templates', { name: name }, '新模板创建成功！');
}

window.cloneTemplate = function(templateId, templateName) {
    Swal.fire({
        title: `您确定要为 "${templateName}" 克隆一个新版本吗？`,
        text: "新版本将作为草稿创建，您可以在其中安全地进行修改。",
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '是的，克隆',
        cancelButtonText: '取消'
    }).then((result) => {
        if (result.isConfirmed) {
            postAPI(`/admin/api/templates/${templateId}/clone`, {}, `模板 '${templateName}' 已成功克隆为新版本！`);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('templates-tbody');
    if (!tbody) return;

    new Sortable(tbody, {
        handle: '.handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            const order = Array.from(tbody.querySelectorAll('tr')).map(row => row.dataset.id);
            // 这里我们直接使用 postAPI
            postAPI('/admin/api/templates/reorder', { order: order }, '顺序更新成功', true)
                .catch(() => Swal.fire('错误', '网络错误，顺序更新失败！', 'error'));
        },
    });
});
