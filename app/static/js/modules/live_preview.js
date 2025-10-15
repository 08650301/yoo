// app/static/js/modules/live_preview.js

const projectId = document.body.dataset.projectId;

// Function to load the initial preview content from the server
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

// Function to handle real-time updates from form inputs to the preview pane
function updatePreview(event) {
    const field = event.target;
    const fieldName = field.dataset.fieldName;
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
            span.textContent = `{{${fieldName}}}`;
            span.style.color = ''; // Revert to default color
        }
    });
}

// Function to initialize the live preview listeners on the form
export function initializeLivePreview() {
    const formContainer = document.getElementById('sheet-content');
    formContainer.addEventListener('input', updatePreview);
    formContainer.addEventListener('change', updatePreview);
}
