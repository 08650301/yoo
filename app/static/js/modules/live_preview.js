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
function updatePlaceholder(fieldName, value, valueToLabelMaps) {
    const previewContainer = document.getElementById('preview-content');
    if (!previewContainer) return;

    let displayValue = value;
    // 如果有映射表，则尝试转换值
    if (valueToLabelMaps && valueToLabelMaps[fieldName]) {
        const map = valueToLabelMaps[fieldName];
        // 处理多选情况（值是逗号分隔的字符串）
        if (typeof value === 'string' && value.includes(',')) {
            displayValue = value.split(',').map(v => map[v.trim()] || v.trim()).join(', ');
        } else {
            // 处理单选或普通情况
            displayValue = map[value] || value;
        }
    }

    const placeholders = previewContainer.querySelectorAll(`[data-placeholder-for="${fieldName}"]`);
    if (placeholders.length === 0) return;

    placeholders.forEach(span => {
        const valueToDisplay = displayValue || value; // Fallback to original value if displayValue is empty
        // First, escape HTML to prevent XSS, then replace newlines with <br>
        const escapedValue = String(valueToDisplay).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const finalHtml = escapedValue.replace(/\n/g, '<br>');

        if (valueToDisplay) {
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
 * @param {object} valueToLabelMaps - 值到标签的映射表。
 */
export function updatePreviewOnLoad(data, config, valueToLabelMaps) {
    if (!config || !config.fields) return;

    config.fields.forEach(field => {
        const fieldName = field.name;
        const value = (data && data[fieldName]) ? data[fieldName] : (field.default_value || '');
        updatePlaceholder(fieldName, value, valueToLabelMaps);
    });
}


let valueMapsForLiveUpdate = {}; // 模块级变量，用于存储映射

/**
 * 处理实时输入事件，更新单个字段的预览。
 * @param {Event} event - DOM 事件对象。
 */
function handleLiveUpdate(event) {
    const field = event.target;
    if (!field) return;

    const fieldName = field.name;
    let value;

    if (field.type === 'checkbox') {
        // 对于 checkbox-group，收集所有选中的值
        const checkedBoxes = document.querySelectorAll(`input[name="${fieldName}"]:checked`);
        value = Array.from(checkedBoxes).map(cb => cb.value).join(',');
    } else if (field.closest('.custom-select-multiple')) {
        // 对于自定义的 select-multiple，从其隐藏输入中获取值
        const wrapper = field.closest('.custom-select-multiple');
        const hiddenInput = wrapper.querySelector('input[type="hidden"]');
        value = hiddenInput ? hiddenInput.value : '';
    } else {
        // 对于所有其他标准输入 (text, textarea, select, radio)
        value = field.value;
    }

    updatePlaceholder(fieldName, value, valueMapsForLiveUpdate);
}

/**
 * 为表单容器内的所有输入元素初始化实时监听。
 * @param {object} valueToLabelMaps - 从 main.js 传入的映射表。
 */
export function initializeLivePreview(valueToLabelMaps) {
    valueMapsForLiveUpdate = valueToLabelMaps || {};
    const formContainer = document.getElementById('sheet-content');
    if (!formContainer) return;

    // 移除旧的监听器，以防重复绑定
    formContainer.removeEventListener('input', handleLiveUpdate);
    formContainer.removeEventListener('change', handleLiveUpdate);

    formContainer.addEventListener('input', handleLiveUpdate);
    formContainer.addEventListener('change', handleLiveUpdate);
}
