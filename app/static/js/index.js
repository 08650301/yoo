// 页面加载完成后执行的函数
window.onload = function() {
    // 加载采购方式用于下拉筛选框
    loadProcurementMethods();
    // 首次加载项目列表
    fetchProjects();
    // 为筛选框添加事件监听，实现实时筛选
    document.getElementById('filterName').addEventListener('input', fetchProjects);
    document.getElementById('filterNumber').addEventListener('input', fetchProjects);
    document.getElementById('filterMethod').addEventListener('change', fetchProjects);
};

// 从后端 API 获取所有已发布的采购方式（模板）
function loadProcurementMethods() {
    fetch('/api/published-templates')
        .then(response => response.json())
        .then(methods => {
            const filterSelect = document.getElementById('filterMethod');
            const modalSelect = document.getElementById('procurementMethod');
            methods.forEach(method => {
                filterSelect.innerHTML += `<option value="${method}">${method}</option>`;
                modalSelect.innerHTML += `<option value="${method}">${method}</option>`;
            });
        })
        .catch(error => console.error('加载采购方式失败:', error));
}

// 根据筛选条件从后端 API 获取项目列表并渲染到表格中
function fetchProjects() {
    const name = document.getElementById('filterName').value;
    const number = document.getElementById('filterNumber').value;
    const method = document.getElementById('filterMethod').value;

    const url = new URL('/api/projects', window.location.origin);
    if (name) url.searchParams.append('name', name);
    if (number) url.searchParams.append('number', number);
    if (method) url.searchParams.append('method', method);

    fetch(url)
        .then(response => response.json())
        .then(projects => {
            const projectListBody = document.getElementById('project-list-body');
            const noProjectsMessage = document.getElementById('no-projects-message');
            projectListBody.innerHTML = '';

            if (projects.length === 0) {
                noProjectsMessage.classList.remove('d-none');
            } else {
                noProjectsMessage.classList.add('d-none');
                projects.forEach((project, index) => {
                    const projectName = project.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const badgeClass = project.procurement_method === '公开招标' ? 'bg-zhaobiao' : 'bg-xunbi';
                    const projectRow = `
                        <tr>
                            <th scope="row" class="text-center-cell">${index + 1}</th>
                            <td class="project-name-cell">
                                <div>${project.name}</div>
                                <small class="text-muted">${project.number}</small>
                            </td>
                            <td class="text-center-cell"><span class="badge ${badgeClass}">${project.procurement_method}</span></td>
                            <td class="text-center-cell">${project.created_at}</td>
                            <td class="text-center-cell">
                                <a href="/projects/${project.id}" class="btn btn-outline-primary btn-sm">填报</a>
                                <button class="btn btn-outline-danger btn-sm ms-2" onclick="deleteProject(${project.id}, '${projectName}', event)">删除</button>
                            </td>
                        </tr>`;
                    projectListBody.innerHTML += projectRow;
                });
            }
        })
        .catch(error => console.error('获取项目列表失败:', error));
}

// 重置所有筛选条件并重新加载项目列表
function resetFilters() {
    document.getElementById('filterName').value = '';
    document.getElementById('filterNumber').value = '';
    document.getElementById('filterMethod').value = '';
    fetchProjects();
}

// 创建新项目
function createProject() {
    const name = document.getElementById('projectName').value;
    const number = document.getElementById('projectNumber').value;
    const method = document.getElementById('procurementMethod').value;
    if (!name.trim()) { Swal.fire('输入错误', '项目名称不能为空！', 'warning'); return; }
    if (!number.trim()) { Swal.fire('输入错误', '项目编号不能为空！', 'warning'); return; }
    if (!method) { Swal.fire('输入错误', '请选择采购方式！', 'warning'); return; }

    fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, number: number, procurement_method: method }),
    }).then(response => response.json()).then(data => {
        if (data.id) {
            bootstrap.Modal.getInstance(document.getElementById('newProjectModal')).hide();
            document.getElementById('projectName').value = '';
            document.getElementById('projectNumber').value = '';
            document.getElementById('procurementMethod').value = '';
            Swal.fire('成功', '新项目已创建！', 'success');
            fetchProjects();
        } else { Swal.fire('创建失败', data.error || '未知错误', 'error'); }
    }).catch(error => console.error('创建项目失败:', error));
}

// 删除项目
function deleteProject(projectId, projectName, event) {
    event.stopPropagation();
    Swal.fire({
        title: `您确定要永久删除项目 "${projectName}" 吗？`,
        text: "此操作无法撤销！",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '是的，删除它！',
        cancelButtonText: '取消'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    Swal.fire('已删除!', data.message, 'success');
                    fetchProjects();
                } else { Swal.fire('删除失败', data.error || '未知错误', 'error'); }
            }).catch(error => {
                console.error('删除项目失败:', error);
                Swal.fire('网络错误', '删除过程中发生网络错误。', 'error');
            });
        }
    });
}

