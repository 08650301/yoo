// app/static/js/modules/live_preview.js

const projectId = document.body.dataset.projectId;

/**
 * 【新】加载并显示单个章节的预览。
 * @param {number} sheetId - 要加载预览的Sheet的ID。
 */
export function loadChapterPreview(sheetId) {
    const previewContainer = document.getElementById('preview-content');
    if (!previewContainer) return;

    if (!sheetId) {
        previewContainer.innerHTML = '<p class="text-muted">选择一个章节以查看预览。</p>';
        return;
    }

    previewContainer.innerHTML = '<p class="text-muted">正在加载预览...</p>';
    fetch(`/api/sheets/${sheetId}/preview`)
        .then(response => response.json())
        .then(data => {
            previewContainer.innerHTML = data.html || `<p class="text-danger">加载预览失败: ${data.error || '未知错误'}</p>`;
        })
        .catch(error => {
            previewContainer.innerHTML = `<p class="text-danger">加载预览时发生网络错误: ${error}</p>`;
        });
}


/**
 * 【已重命名】从服务器加载整个项目的初始HTML预览（作为回退）。
 */
export function loadInitialProjectPreview() {
    const previewContainer = document.getElementById('preview-content');
    if (!previewContainer) return;
    previewContainer.innerHTML = '<p class="text-muted">正在加载预览...</p>';
    fetch(`/api/projects/${projectId}/preview`)
        .then(response => response.json())
        .then(data => {
            if (data.html) {
                previewContainer.innerHTML = data.html;
            } else {
                previewContainer.innerHTML = `<p class="text-danger">加载预览失败: ${data.error || '未知错误'}</p>`;
            }
        })
        .catch(error => {
            previewContainer.innerHTML = `<p class="text-danger">加载预览时发生网络错误: ${error}</p>`;
        });
}

/**
 * 更新单个占位符的显示。
 * @param {string} fieldName - 字段的内部名称。
 * @param {string} value - 字段的当前值。
 */
function updatePlaceholder(fieldName, value) {
    const previewContainer = document.getElementById('preview-content');
    if (!previewContainer) return;

    const placeholders = previewContainer.querySelectorAll(`[data-placeholder-for="${fieldName}"]`);
    if (placeholders.length === 0) return;

    placeholders.forEach(span => {
        // First, escape HTML to prevent XSS, then replace newlines with <br>
        const escapedValue = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const finalHtml = escapedValue.replace(/\n/g, '<br>');

        if (value) {
            span.innerHTML = finalHtml;
        } else {
            span.innerHTML = '**********';
        }
        // Styling is now handled by a dedicated CSS rule in project.html
    });
}


/**
 * 【新函数】在表单加载时，根据后端数据直接更新所有预览。
 * @param {object} data - 从 /api/projects/.../sheets/ GET 请求获取的表单数据。
 * @param {object} config - 当前表单的配置对象。
 */
export function updatePreviewOnLoad(data, config) {
    if (!config || !config.fields) return;

    config.fields.forEach(field => {
        const fieldName = field.name;
        const value = (data && data[fieldName]) ? data[fieldName] : (field.default_value || '');
        updatePlaceholder(fieldName, value);
    });
}


/**
 * 处理实时输入事件，更新单个字段的预览。
 * @param {Event} event - DOM 事件对象。
 */
function handleLiveUpdate(event) {
    const field = event.target;
    if (!field) return;

    const fieldName = field.name;
    let value = field.value;

    if (field.type === 'checkbox') {
        value = field.checked ? '是' : '否';
    } else if (field.type === 'radio') {
        const checkedRadio = document.querySelector(`[name="${fieldName}"]:checked`);
        value = checkedRadio ? checkedRadio.value : '';
    }

    updatePlaceholder(fieldName, value);
}

/**
 * 为表单容器内的所有输入元素初始化实时监听。
 */
export function initializeLivePreview() {
    const formContainer = document.getElementById('sheet-content');
    if (!formContainer) return;

    formContainer.addEventListener('input', handleLiveUpdate);
    formContainer.addEventListener('change', handleLiveUpdate);
}
