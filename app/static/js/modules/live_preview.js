// app/static/js/modules/live_preview.js

const projectId = document.body.dataset.projectId;

export function loadPreview() {
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

function updatePreviewForField(field) {
    const fieldName = field.name;
    if (!fieldName) return;

    const previewContainer = document.getElementById('preview-content');
    if (!previewContainer) return;

    const placeholders = previewContainer.querySelectorAll(`[data-placeholder-for="${fieldName}"]`);
    if (placeholders.length === 0) return;

    let value = field.value;
    if (field.type === 'checkbox') {
        value = field.checked ? '是' : '否';
    } else if (field.type === 'radio') {
        const checkedRadio = document.querySelector(`[name="${fieldName}"]:checked`);
        value = checkedRadio ? checkedRadio.value : '';
    }

    placeholders.forEach(span => {
        if (value) {
            span.textContent = value;
            span.style.color = 'red';
        } else {
            // Revert to original placeholder text if value is empty
            span.textContent = `{{${fieldName}}}`;
            span.style.color = '';
        }
    });
}

export function initializeLivePreview() {
    const formContainer = document.getElementById('sheet-content');
    if (!formContainer) return;

    const eventHandler = (event) => {
        if (event.target && (event.target.matches('input, textarea, select'))) {
            updatePreviewForField(event.target);
        }
    };

    formContainer.addEventListener('input', eventHandler);
    formContainer.addEventListener('change', eventHandler);
}
