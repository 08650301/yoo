// 从 <body> 标签的 data-* 属性中获取后端传递的数据
const templateId = document.body.dataset.templateId;
const isReadonly = document.body.dataset.readonly === 'true';

// 初始化所有弹窗实例，以便后续通过 JavaScript 控制
let newSheetModal = null;
let editSectionModal = null;
let newSectionModal = null;

document.addEventListener('DOMContentLoaded', () => {
    // 页面加载完成后，如果不是只读模式，则初始化拖拽排序功能
    if (!isReadonly) {
        initializeSortable();
    }
});

function initializeSortable() {
    const sectionsContainer = document.getElementById('sections-container');
    new Sortable(sectionsContainer, {
        handle: '.section-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            const order = Array.from(sectionsContainer.querySelectorAll('.section-card')).map(card => card.dataset.id);
            fetch('/admin/api/sections/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: order })
            })
            .then(handleApiResponse)
            .then(data => { if (!data.message) { Swal.fire('错误', '分区顺序更新失败！', 'error'); } });
        },
    });

    document.querySelectorAll('.sheets-list').forEach(list => {
        new Sortable(list, {
            handle: '.sheet-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const sectionId = list.dataset.sectionId;
                const order = Array.from(list.querySelectorAll('li[data-id]')).map(item => item.dataset.id);
                fetch('/admin/api/sheets/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: order, section_id: sectionId })
                })
                .then(handleApiResponse)
                .then(data => { if (!data.message) { Swal.fire('错误', 'Sheet顺序更新失败！', 'error'); } });
            }
        });
    });
}

// --- 弹窗与表单操作函数 ---

function openNewSectionModal() {
    if (!newSectionModal) {
        newSectionModal = new bootstrap.Modal(document.getElementById('newSectionModal'));
    }
    document.getElementById('sectionName').value = '';
    newSectionModal.show();
}

function uploadExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    const uploadButton = document.getElementById('uploadButton');
    if (!file) { Swal.fire('提示', '请选择一个文件！', 'warning'); return; }

    uploadButton.disabled = true;
    uploadButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> 正在导入...`;

    const formData = new FormData();
    formData.append('file', file);

    fetch(`/admin/api/templates/${templateId}/import`, { method: 'POST', body: formData })
    .then(handleApiResponse)
    .then(data => { Swal.fire('成功', data.message, 'success').then(() => window.location.reload()); })
    .catch(error => {
        Swal.fire('导入失败', error.message, 'error');
        uploadButton.disabled = false;
        uploadButton.textContent = '开始导入';
    });
}

function toggleModelIdentifier() {
    const sheetType = document.getElementById('sheetType').value;
    const modelGroup = document.getElementById('modelIdentifierGroup');
    modelGroup.classList.toggle('d-none', sheetType !== 'dynamic_table');
}

function addSection() {
    const name = document.getElementById('sectionName').value;
    if (!name.trim()) { Swal.fire('输入错误', '分区名称不能为空！', 'warning'); return; }

    postAPI(`/admin/api/templates/${templateId}/sections`, { name: name }, '新分区创建成功！');
    if(newSectionModal) {
        newSectionModal.hide();
    }
}

function openEditSectionModal(sectionId, currentName) {
    if (!editSectionModal) {
        editSectionModal = new bootstrap.Modal(document.getElementById('editSectionModal'));
    }
    document.getElementById('editSectionId').value = sectionId;
    document.getElementById('editSectionName').value = currentName;
    editSectionModal.show();
}

function updateSection() {
    const sectionId = document.getElementById('editSectionId').value;
    const name = document.getElementById('editSectionName').value;
    if (!name.trim()) { Swal.fire('输入错误', '分区名称不能为空！', 'warning'); return; }
    putAPI(`/admin/api/sections/${sectionId}`, { name: name }, '分区名称更新成功！');
}

function deleteSection(sectionId, sectionName) {
    deleteAPI(`/admin/api/sections/${sectionId}`, `分区 "${sectionName}"`);
}

function openNewSheetModal(sectionId) {
    if (!newSheetModal) {
        newSheetModal = new bootstrap.Modal(document.getElementById('newSheetModal'));
    }
    document.getElementById('currentSectionId').value = sectionId;
    document.getElementById('sheetName').value = '';
    document.getElementById('sheetType').value = 'fixed_form';
    document.getElementById('modelIdentifier').value = '';
    toggleModelIdentifier();
    newSheetModal.show();
}

function addSheet() {
    const sectionId = document.getElementById('currentSectionId').value;
    const name = document.getElementById('sheetName').value;
    const type = document.getElementById('sheetType').value;
    const modelIdentifier = document.getElementById('modelIdentifier').value;
    if (!name.trim()) { Swal.fire('输入错误', 'Sheet名称不能为空！', 'warning'); return; }

    const payload = { name: name, type: type };
    if (type === 'dynamic_table') {
        if (!modelIdentifier) { Swal.fire('选择错误', '动态表格必须选择一个数据模型！', 'warning'); return; }
        payload.model_identifier = modelIdentifier;
    }
    postAPI(`/admin/api/sections/${sectionId}/sheets`, payload, '新Sheet创建成功！');
}

function deleteSheet(sheetId, sheetName) {
    deleteAPI(`/admin/api/sheets/${sheetId}`, `Sheet "${sheetName}"`);
}
