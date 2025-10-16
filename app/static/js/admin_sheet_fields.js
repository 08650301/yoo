// 从 <body> 标签的 data-* 属性中获取后端传递的数据
const sheetId = document.body.dataset.sheetId;
const isReadonly = document.body.dataset.readonly === 'true';

let allFields = [];
let currentFieldName = ''; // 当前编辑的字段名称
try {
    allFields = JSON.parse(document.body.dataset.fields || '[]');
} catch (e) {
    console.error('JSON解析错误:', e);
    allFields = [];
}

let fieldModal = null, ruleModal = null;
const fieldTypeMap = {
    text: '单行文本',
    textarea: '多行文本',
    number: '数字',
    date: '日期',
    select: '下拉单选',
    radio: '单选按钮',
    'checkbox-group': '多选按钮',
    'select-multiple': '下拉多选'
};
const FIELD_TYPES_REQUIRING_OPTIONS = ['select', 'select-multiple', 'radio', 'checkbox-group'];

// --- Tab 和按钮管理 ---
function updateActionButtons(activeTab) {
    const container = document.getElementById('action-buttons');
    if (!container) return;
    if (activeTab === 'fields') {
        container.innerHTML = `<button class="btn btn-primary" onclick="openFieldModal()">+ 新增字段</button>`;
    } else if (activeTab === 'rules') {
        container.innerHTML = `<button class="btn btn-primary" onclick="openRuleModal()">+ 新增规则</button>`;
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const fieldsTabBtn = document.getElementById('fields-tab-btn');
    const rulesTabBtn = document.getElementById('rules-tab-btn');

    if (fieldsTabBtn) {
        fieldsTabBtn.addEventListener('shown.bs.tab', () => updateActionButtons('fields'));
    }
    if (rulesTabBtn) {
        rulesTabBtn.addEventListener('shown.bs.tab', () => updateActionButtons('rules'));
    }

    updateActionButtons('fields');
    renderFieldsTable();
    if(rulesTabBtn) fetchAndRenderRules();
    if (!isReadonly) initializeSortable();
});

// --- 字段列表渲染 ---
function renderFieldsTable() {
    const tbody = document.getElementById('fields-tbody');
    tbody.innerHTML = '';
    if (allFields.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">此Sheet下还没有任何字段。</td></tr>`;
        return;
    }
    allFields.forEach(field => {
        const rules = (field.validation_rules || []).reduce((acc, rule) => ({ ...acc, [rule.rule_type]: rule.rule_value }), {});

        const isRequired = rules.required === 'True' ? '<span class="badge bg-success">是</span>' : '<span class="badge bg-danger">否</span>';
        const isDisabled = rules.disabled === 'True' ? '<span class="badge bg-success">是</span>' : '<span class="badge bg-danger">否</span>';
        const lengthLimit = [rules.minLength, rules.maxLength].filter(Boolean).join(' - ') || '—';
        const valueRange = [rules.minValue, rules.maxValue].filter(Boolean).join(' - ') || '—';
        const fieldTypeText = fieldTypeMap[field.field_type] || field.field_type;

        const tr = document.createElement('tr');
        tr.dataset.id = field.id;
        tr.innerHTML = `
            <td class="text-center handle ${isReadonly ? 'd-none' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg></td>
            <td class="fw-bold">${field.label}</td>
            <td><code>${field.name}</code></td>
            <td>${fieldTypeText}</td>
            <td class="text-center">${isRequired}</td>
            <td class="text-center">${isDisabled}</td>
            <td class="text-center">${lengthLimit}</td>
            <td class="text-center">${valueRange}</td>
            <td>
                <button class="btn btn-outline-info btn-sm" onclick='openFieldModal(${JSON.stringify(field)})'>${isReadonly ? '查看' : '编辑'}</button>
                ${!isReadonly ? `<button class="btn btn-outline-danger btn-sm ms-2" onclick="deleteField(${field.id}, '${field.label}')">删除</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 字段弹窗与保存逻辑 ---
function generateFieldNameFromLabel(str) {
    const baseName = str.replace(/[\u4e00-\u9fa5]/g, ' ').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
    if (!baseName || baseName === 'field') {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `field_${timestamp}_${random}`;
    }
    return baseName;
}

function autoGenerateName() {
    if (!document.getElementById('fieldId').value) {
        document.getElementById('fieldName').value = generateFieldNameFromLabel(document.getElementById('fieldLabel').value);
    }
}

function updateModalUI() {
    const fieldType = document.getElementById('fieldType').value;
    const optionsGroup = document.getElementById('optionsGroup');
    const optionsLabel = optionsGroup.querySelector('label[for="fieldOptionLabels"]');
    const textRules = document.querySelector('.validation-group.text-rules');
    const numericRules = document.querySelector('.validation-group.numeric-rules');

    const needsOptions = FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldType);
    const isTextual = ['text', 'textarea'].includes(fieldType);

    optionsGroup.classList.toggle('d-none', !needsOptions);
    if (optionsLabel.querySelector('.required-indicator')) {
        optionsLabel.querySelector('.required-indicator').remove();
    }
    if (needsOptions) {
        optionsLabel.insertAdjacentHTML('beforeend', '<span class="required-indicator text-danger">*</span>');
    }

    const defaultSingle = document.getElementById('fieldDefaultSingle');
    const defaultMulti = document.getElementById('fieldDefaultMulti');
    defaultSingle.classList.toggle('d-none', fieldType === 'textarea');
    defaultMulti.classList.toggle('d-none', fieldType !== 'textarea');
    if (fieldType === 'textarea' && !defaultSingle.classList.contains('d-none')) {
        defaultMulti.value = defaultSingle.value;
    } else if (fieldType !== 'textarea' && !defaultMulti.classList.contains('d-none')) {
        defaultSingle.value = defaultMulti.value;
    }

    if (textRules) textRules.style.display = isTextual ? 'block' : 'none';
    if (numericRules) numericRules.style.display = fieldType === 'number' ? 'block' : 'none';

    const allowSpacesGroup = document.getElementById('allow-spaces-group');
    if (allowSpacesGroup) {
        allowSpacesGroup.style.display = isTextual ? 'block' : 'none';
    }
}

function openFieldModal(fieldData = null) {
    if (!fieldModal) {
        fieldModal = new bootstrap.Modal(document.getElementById('fieldModal'));
        // 新增：选项框同步滚动和输入的逻辑
        const labelsEl = document.getElementById('fieldOptionLabels');
        const valuesEl = document.getElementById('fieldOptionValues');

        labelsEl.addEventListener('scroll', () => { valuesEl.scrollTop = labelsEl.scrollTop; });
        valuesEl.addEventListener('scroll', () => { labelsEl.scrollTop = valuesEl.scrollTop; });

        let previousLabels = [];
        labelsEl.addEventListener('input', () => {
            const currentLabels = labelsEl.value.split('\n');
            const currentValues = valuesEl.value.split('\n');

            // 确保 values 数组长度至少和 labels 一样长
            while(currentValues.length < currentLabels.length) {
                currentValues.push('');
            }

            const newValues = currentLabels.map((label, index) => {
                const oldValue = currentValues[index] || '';
                const oldLabel = previousLabels[index] || '';
                // 只有当旧值为空，或者旧值和旧标签相同时，才用新标签同步更新
                if (oldValue === '' || oldValue === oldLabel) {
                    return label;
                }
                return oldValue;
            });

            valuesEl.value = newValues.join('\n');
            previousLabels = currentLabels.slice(); // 保存当前状态以备下次比较
        });
    }

    const form = document.getElementById('fieldForm');
    form.reset();
    document.querySelectorAll('[id^="validation"]').forEach(el => {
        if(el.type === 'checkbox') el.checked = false; else el.value = '';
    });
    document.getElementById('fieldOptionLabels').value = '';
    document.getElementById('fieldOptionValues').value = '';

    currentFieldName = '';

    if (fieldData) {
        document.getElementById('fieldModalTitle').textContent = isReadonly ? "查看字段" : "编辑字段";
        document.getElementById('fieldId').value = fieldData.id;
        document.getElementById('fieldLabel').value = fieldData.label;
        document.getElementById('fieldName').value = fieldData.name;
        document.getElementById('fieldType').value = fieldData.field_type;

        if (fieldData.options && Array.isArray(fieldData.options)) {
            document.getElementById('fieldOptionLabels').value = fieldData.options.map(opt => opt.label).join('\n');
            document.getElementById('fieldOptionValues').value = fieldData.options.map(opt => opt.value).join('\n');
        }

        if(fieldData.field_type === 'textarea') document.getElementById('fieldDefaultMulti').value = fieldData.default_value || '';
        else document.getElementById('fieldDefaultSingle').value = fieldData.default_value || '';
        document.getElementById('fieldHelpTip').value = fieldData.help_tip || '';

        currentFieldName = fieldData.name;

        (fieldData.validation_rules || []).forEach(r => {
            const el = document.getElementById('validation' + r.rule_type.charAt(0).toUpperCase() + r.rule_type.slice(1));
            if (el) {
                if(el.type === 'checkbox') el.checked = (r.rule_value === 'True');
                else if (['contains', 'excludes'].includes(r.rule_type)) el.value = (r.rule_value || '').replace(/,/g, '\n');
                else el.value = r.rule_value || '';
            }
        });
    } else {
        document.getElementById('fieldModalTitle').textContent = "新增字段";
        document.getElementById('fieldId').value = '';
    }

    updateModalUI();
    document.querySelectorAll('#fieldForm input, #fieldForm textarea, #fieldForm select').forEach(el => el.disabled = isReadonly);
    document.getElementById('saveFieldBtn').style.display = isReadonly ? 'none' : 'block';
    fieldModal.show();
}

function saveField() {
    const fieldId = document.getElementById('fieldId').value;
    const url = fieldId ? `/admin/api/fields/${fieldId}` : `/admin/api/sheets/${sheetId}/fields`;
    const method = fieldId ? 'PUT' : 'POST';
    const validation = {};
    document.querySelectorAll('[id^="validation"]').forEach(el => {
        const key = el.id.replace('validation', '').charAt(0).toLowerCase() + el.id.slice(11);
        let value = el.type === 'checkbox' ? (el.checked ? 'True' : '') : el.value.trim();
        if (value) {
            if (['contains', 'excludes'].includes(key)) value = value.replace(/\n/g, ',');
            validation[key] = value;
        }
    });

    const fieldType = document.getElementById('fieldType').value;
    const fieldName = document.getElementById('fieldName').value.trim();
    const fieldLabel = document.getElementById('fieldLabel').value.trim();

    if (!fieldId || fieldName !== currentFieldName) {
        const existingField = allFields.find(f => f.name === fieldName);
        if (existingField) {
            Swal.fire('输入错误', `字段内部名称 '${fieldName}' 已存在，请使用其他名称！`, 'warning');
            return;
        }
    }

    const payload = {
        label: fieldLabel,
        name: fieldName,
        field_type: fieldType,
        default_value: fieldType === 'textarea' ? document.getElementById('fieldDefaultMulti').value.trim() : document.getElementById('fieldDefaultSingle').value.trim(),
        help_tip: document.getElementById('fieldHelpTip').value.trim(),
        validation: validation
    };

    if (FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldType)) {
        payload.option_labels = document.getElementById('fieldOptionLabels').value.trim().split('\n');
        payload.option_values = document.getElementById('fieldOptionValues').value.trim().split('\n');
    }

    if (!payload.label || !payload.name) { Swal.fire('输入错误', '显示名称和内部名称不能为空！', 'warning'); return; }
    (method === 'PUT' ? putAPI : postAPI)(url, payload, fieldId ? '字段更新成功！' : '新字段创建成功！');
}

function deleteField(fieldId, fieldLabel) {
    deleteAPI(`/admin/api/fields/${fieldId}`, `字段 "${fieldLabel}"`);
}

// --- 联动规则管理 (省略，未改动) ---
// ...

// --- 通用 ---
function initializeSortable() {
    const fieldsTbody = document.getElementById('fields-tbody');
    new Sortable(fieldsTbody, {
        handle: '.handle', animation: 150, ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            const order = Array.from(fieldsTbody.querySelectorAll('tr')).map(row => row.dataset.id);
            postAPI(`/admin/api/sheets/${sheetId}/fields/reorder`, { order: order }, '字段顺序已更新', true);
        },
    });
}