// app/static/js/template_detail.js

document.addEventListener('DOMContentLoaded', function() {
    const templateId = document.body.dataset.templateId;
    const isReadonly = document.body.dataset.readonly === 'true';

    loadAllChapters();

    if (!isReadonly) {
        initializeSortable();
    }
});

/**
 * 页面加载时，获取所有分区的章节文档并渲染
 */
async function loadAllChapters() {
    const chapterLists = document.querySelectorAll('.chapters-list');
    for (const list of chapterLists) {
        const sectionId = list.dataset.sectionId;
        try {
            const response = await fetch(`/admin/api/sections/${sectionId}/chapters`);
            if (!response.ok) throw new Error('Network response was not ok');
            const chapters = await response.json();
            renderChapters(sectionId, chapters);
        } catch (error) {
            console.error('获取章节列表失败:', error);
            const listContainer = document.getElementById(`chapters-list-${sectionId}`);
            listContainer.innerHTML = '<div class="list-group-item text-danger">加载失败</div>';
        }
    }
}

/**
 * 将获取到的章节文档渲染到指定的分区
 * @param {number} sectionId
 * @param {Array} chapters
 */
function renderChapters(sectionId, chapters) {
    const listContainer = document.getElementById(`chapters-list-${sectionId}`);
    listContainer.innerHTML = ''; // 清空加载提示

    if (chapters.length === 0) {
        listContainer.innerHTML = '<div class="list-group-item text-muted">此分区无章节文档</div>';
        return;
    }

    chapters.forEach(chapter => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.dataset.chapterId = chapter.id;
        item.innerHTML = `
            <span class="text-truncate" title="${chapter.filename}">
                <i class="bi bi-file-earmark-word me-2"></i>${chapter.filename}
                ${chapter.is_linked ? '<span class="badge bg-success ms-2">已关联</span>' : ''}
            </span>
            <i class="bi bi-trash-fill action-icon text-danger" onclick="deleteChapter(${chapter.id})"></i>
        `;
        listContainer.appendChild(item);
    });
}

/**
 * 上传Word模板文件
 * @param {number} sectionId
 */
async function uploadWordTemplate(sectionId) {
    const fileInput = document.getElementById(`word-template-upload-${sectionId}`);
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await postAPI(`/admin/api/sections/${sectionId}/chapters`, formData, null, '上传成功', true);
        await loadAllChapters(); // 重新加载以显示新文件
    } catch (error) {
        console.error('上传失败:', error);
        Swal.fire('上传失败', '上传过程中发生错误', 'error');
    } finally {
        fileInput.value = ''; // 清空file input
    }
}

/**
 * 删除一个章节文档
 * @param {number} chapterId
 */
function deleteChapter(chapterId) {
    Swal.fire({
        title: '确认删除?',
        text: "您确定要删除这个章节文档吗？如果它已和某个表单关联，关联也将被移除。",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteAPI(`/admin/api/chapters/${chapterId}`, null, '删除成功');
            location.reload(); // 重新加载页面以更新所有状态
        }
    });
}

/**
 * 初始化所有可排序的列表（分区和Sheets）
 */
function initializeSortable() {
    // 排序分区
    const sectionsAccordion = document.getElementById('sections-accordion');
    if (sectionsAccordion) {
        new Sortable(sectionsAccordion, {
            handle: '.handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const sectionIds = Array.from(sectionsAccordion.children).map(item => item.dataset.sectionId);
                postAPI('/admin/api/sections/reorder', { sorted_ids: sectionIds }, null, '分区顺序已更新');
            }
        });
    }

    // 排序各个分区下的 Sheets
    const sheetLists = document.querySelectorAll('.list-group[data-section-id]');
    sheetLists.forEach(list => {
        new Sortable(list, {
            handle: '.handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                const sheetIds = Array.from(list.children).map(item => item.dataset.sheetId);
                postAPI('/admin/api/sheets/reorder', { sorted_ids: sheetIds }, null, 'Sheet顺序已更新');
            }
        });
    });
}

// 全局变量，用于在模态框之间传递数据
let currentSectionId;

/**
 * 打开新增Sheet的模态框
 * @param {number} sectionId - 正在操作的分区ID
 */
function openNewSheetModal(sectionId) {
    currentSectionId = sectionId;
    document.getElementById('sheetName').value = '';
    document.getElementById('sheetType').value = 'fixed_form';
    const modal = new bootstrap.Modal(document.getElementById('newSheetModal'));
    modal.show();
}

/**
 * 处理新增Sheet的逻辑
 */
function addSheet() {
    const name = document.getElementById('sheetName').value.trim();
    const type = document.getElementById('sheetType').value;
    if (!name) {
        Swal.fire('错误', 'Sheet名称不能为空', 'error');
        return;
    }
    const payload = {
        name: name,
        sheet_type: type
    };
    postAPI(`/admin/api/sections/${currentSectionId}/sheets`, payload, () => location.reload());
}

/**
 * 打开编辑分区名称的模态框
 */
function openEditSectionModal(sectionId, currentName) {
    document.getElementById('editSectionId').value = sectionId;
    document.getElementById('editSectionName').value = currentName;
    const modal = new bootstrap.Modal(document.getElementById('editSectionModal'));
    modal.show();
}

/**
 * 更新分区名称
 */
function updateSection() {
    const sectionId = document.getElementById('editSectionId').value;
    const newName = document.getElementById('editSectionName').value.trim();
    if (!newName) {
        Swal.fire('错误', '分区名称不能为空', 'error');
        return;
    }
    putAPI(`/admin/api/sections/${sectionId}`, { name: newName }, () => location.reload());
}

/**
 * 删除分区
 */
function deleteSection(sectionId) {
    Swal.fire({
        title: '确认删除?',
        text: "您确定要删除这个分区及其包含的所有Sheets吗？此操作无法撤销！",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
    }).then((result) => {
        if (result.isConfirmed) {
            deleteAPI(`/admin/api/sections/${sectionId}`, () => location.reload());
        }
    });
}

/**
 * 删除Sheet
 */
function deleteSheet(sheetId) {
    Swal.fire({
        title: '确认删除?',
        text: "您确定要删除这个Sheet吗？此操作无法撤销！",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
    }).then((result) => {
        if (result.isConfirmed) {
            deleteAPI(`/admin/api/sheets/${sheetId}`, () => location.reload());
        }
    });
}

/**
 * 新增分区
 */
function addSection() {
    const name = document.getElementById('sectionName').value.trim();
    if (!name) {
        Swal.fire('错误', '分区名称不能为空', 'error');
        return;
    }
    const templateId = document.body.dataset.templateId;
    postAPI(`/admin/api/templates/${templateId}/sections`, { name: name }, () => location.reload());
}

let currentSheetIdForLink;

/**
 * 打开关联章节文档的模态框
 */
async function openLinkChapterModal(sheetId, sheetName, currentChapterId) {
    currentSheetIdForLink = sheetId;
    document.getElementById('linkChapterSheetName').textContent = sheetName;
    const select = document.getElementById('chapterSelect');
    select.innerHTML = '<option value="">正在加载可用文档...</option>';

    const linkModal = new bootstrap.Modal(document.getElementById('linkChapterModal'));
    linkModal.show();

    // 从 DOM 中找到 sheet 所在的 section-id
    const sheetElement = document.querySelector(`li[data-sheet-id="${sheetId}"]`);
    const sectionId = sheetElement.closest('.sheets-list').dataset.sectionId;

    try {
        const response = await fetch(`/admin/api/sections/${sectionId}/chapters`);
        if (!response.ok) throw new Error('Network response was not ok');
        const chapters = await response.json();

        select.innerHTML = '<option value="null">-- 不关联任何文档 --</option>'; // 添加一个解除关联的选项

        const availableChapters = chapters.filter(c => !c.is_linked || c.id === currentChapterId);

        if (availableChapters.length === 0) {
             select.innerHTML += '<option value="" disabled>没有可用的文档</option>';
        } else {
            availableChapters.forEach(chapter => {
                const option = document.createElement('option');
                option.value = chapter.id;
                option.textContent = chapter.filename;
                if (chapter.id === currentChapterId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('获取可关联文档列表失败:', error);
        select.innerHTML = '<option value="">加载失败</option>';
    }
}


/**
 * 保存表单与章节文档的关联
 */
function saveChapterLink() {
    const chapterId = document.getElementById('chapterSelect').value;
    const payload = {
        chapter_id: chapterId === 'null' ? null : parseInt(chapterId, 10)
    };
    postAPI(`/admin/api/sheets/${currentSheetIdForLink}/link_chapter`, payload, () => location.reload(), '关联已更新');
}

function uploadExcel() {
    Swal.fire('功能开发中', '从Excel导入的功能正在积极开发中。', 'info');
}
