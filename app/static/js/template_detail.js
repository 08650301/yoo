const templateId = document.body.dataset.templateId;
const isReadonly = document.body.dataset.readonly === 'true';

let newSheetModal = null;
let editSectionModal = null;
let newSectionModal = null;
let linkChapterModal = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!isReadonly) {
        initializeSortable();
    }
    // 为每个分区加载其章节文档列表
    document.querySelectorAll('.chapters-list-group').forEach(list => {
        const sectionId = list.dataset.sectionId;
        loadChapters(sectionId);
    });
});

function initializeSortable() {
    // 分区排序
    const sectionsContainer = document.getElementById('sections-container');
    new Sortable(sectionsContainer, {
        handle: '.section-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            const order = Array.from(sectionsContainer.querySelectorAll('.section-card')).map(card => card.dataset.id);
            postAPI('/admin/api/sections/reorder', { order: order }, '分区顺序已更新', true);
        },
    });

    // Sheet 排序
    document.querySelectorAll('.sheets-list').forEach(list => {
        new Sortable(list, {
            handle: '.sheet-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const sectionId = list.dataset.sectionId;
                const order = Array.from(list.querySelectorAll('li[data-id]')).map(item => item.dataset.id);
                postAPI('/admin/api/sheets/reorder', { order: order, section_id: sectionId }, 'Sheet顺序已更新', true);
            }
        });
    });

    // 为每个分区的章节列表启用排序
    document.querySelectorAll('.chapters-list-group').forEach(list => {
        new Sortable(list, {
            handle: '.chapter-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const order = Array.from(list.querySelectorAll('li[data-id]')).map(item => item.dataset.id);
                postAPI('/admin/api/chapters/reorder', { order: order }, '章节文档顺序已更新', true);
            }
        });
    });
}

// --- 章节文档管理 (已重构为基于分区) ---

function loadChapters(sectionId) {
    const list = document.getElementById(`chapters-list-${sectionId}`);
    if (!list) return;

    fetch(`/admin/api/sections/${sectionId}/chapters`)
    .then(handleApiResponse)
    .then(chapters => {
        list.innerHTML = '';
        if (chapters.length === 0) {
            list.innerHTML = '<li class="list-group-item text-muted placeholder-item">尚未上传任何章节文档。</li>';
            return;
        }
        chapters.forEach(chapter => {
            const item = document.createElement('li');
            item.className = 'list-group-item list-group-item-sm d-flex justify-content-between align-items-center';
            item.dataset.id = chapter.id;

            const linkedBadge = chapter.is_linked ? `<span class="badge bg-success ms-2">已关联</span>` : '';

            item.innerHTML = `
                <div class="d-flex align-items-center">
                    <span class="chapter-handle me-2 ${isReadonly ? 'd-none' : ''}" style="cursor: grab;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
                    </span>
                    <small>${chapter.filename}</small>
                    ${linkedBadge}
                </div>
                ${!isReadonly ? `<button class="btn btn-outline-danger btn-sm py-0" onclick="deleteChapter(${sectionId}, ${chapter.id}, '${chapter.filename}')">删除</button>` : ''}
            `;
            list.appendChild(item);
        });
    })
    .catch(error => {
        list.innerHTML = `<li class="list-group-item text-danger">加载失败: ${error.message}</li>`;
    });
}

function uploadChapterFile(sectionId, file) {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    Swal.fire({
        title: '正在上传...',
        text: '请稍候',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    fetch(`/admin/api/sections/${sectionId}/chapters`, {
        method: 'POST',
        body: formData
    })
    .then(handleApiResponse)
    .then(data => {
        Swal.fire('成功', data.message, 'success');
        loadChapters(sectionId); // 重新加载该分区的列表
    })
    .catch(error => Swal.fire('上传失败', error.message, 'error'))
    .finally(() => {
        document.getElementById(`chapter-file-input-${sectionId}`).value = '';
    });
}

function deleteChapter(sectionId, chapterId, filename) {
    deleteAPI(`/admin/api/chapters/${chapterId}`, `章节文档 "${filename}"`, true)
        .then(() => {
            loadChapters(sectionId); // 成功删除后重新加载该分区的列表
        })
        .catch(error => {
            if (error.message !== '删除操作已取消') {
                console.error('删除章节时发生错误:', error);
            }
        });
}

async function openLinkChapterModal(sectionId, sheetId, sheetName, currentChapterId) {
    if (!linkChapterModal) {
        linkChapterModal = new bootstrap.Modal(document.getElementById('linkChapterModal'));
    }

    document.getElementById('linkChapterSheetName').textContent = sheetName;
    document.getElementById('linkChapterSheetId').value = sheetId;

    const select = document.getElementById('chapterSelect');
    select.innerHTML = '<option>正在加载...</option>';
    linkChapterModal.show();

    try {
        const response = await fetch(`/admin/api/sections/${sectionId}/chapters`);
        const chapters = await handleApiResponse(response);

        select.innerHTML = '<option value="">--- 无关联 ---</option>';

        chapters.forEach(chapter => {
            if (chapter.id === currentChapterId || !chapter.is_linked) {
                const option = document.createElement('option');
                option.value = chapter.id;
                option.textContent = chapter.filename;
                if (chapter.id === currentChapterId) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
    } catch (error) {
        select.innerHTML = `<option>加载失败: ${error.message}</option>`;
    }
}

function saveChapterLink() {
    const sheetId = document.getElementById('linkChapterSheetId').value;
    const chapterId = document.getElementById('chapterSelect').value;

    postAPI(`/admin/api/sheets/${sheetId}/link_chapter`, { chapter_id: chapterId }, '关联状态已更新！');
}

// --- 弹窗与表单操作函数 (既有函数) ---

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