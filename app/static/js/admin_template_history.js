function setActive(templateId, templateName, version) {
    const message = `您确定要将 V${version} 设为模板 "${templateName}" 的最新版本吗？<br><br>这会影响后续的克隆操作。`;
    postAPI(`/admin/api/templates/${templateId}/set-active`, {}, message);
}

function toggleStatus(templateId, currentStatus) {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    const message = `确定要将此版本状态更改为 "${newStatus}" 吗？`;
    putAPI(`/admin/api/templates/${templateId}/status`, { status: newStatus }, message);
}

function deleteVersion(templateId, version) {
    deleteAPI(`/admin/api/templates/${templateId}/version`, `V${version}`);
}

function deleteAllVersions(templateName) {
    Swal.fire({
        title: `极度危险操作！`,
        html: `您确定要彻底删除模板 "<strong>${templateName}</strong>" 吗？<br><br>此操作将删除其 <strong>所有历史版本</strong>，且 <strong>无法恢复</strong>！`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '是的，我明白风险，删除！',
        cancelButtonText: '取消'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/admin/api/templates/by-name/${templateName}`, { method: 'DELETE' })
            .then(handleApiResponse)
            .then(data => {
                if (data.message) {
                    Swal.fire('已删除!', data.message, 'success').then(() => {
                        window.location.href = '/admin/templates';
                    });
                }
            })
            .catch(error => {
                Swal.fire('删除失败', error.message, 'error');
            });
        }
    });
}

