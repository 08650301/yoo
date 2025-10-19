// 从 <body> 标签的 data-* 属性中获取后端传递的数据
const sheetId = document.body.dataset.sheetId;
const isReadonly = document.body.dataset.readonly === 'true';
const isColumnMode = document.body.dataset.isColumnMode === 'true';
const titleText = isColumnMode ? '列' : '字段';

let allFields = []; // 在这个JS中，我们统一称之为 field，无论UI上显示“字段”还是“列”
let currentFieldName = ''; // 当前编辑的字段名称
try {
    allFields = JSON.parse(document.body.dataset.fields || '[]');
} catch (e) {
    console.error('JSON解析错误:', e);
    allFields = [];
}

let fieldModal = null, ruleModal = null;

// 根据当前模式（字段/列）确定可用的类型
const fieldModeTypes = {
    text: '单行文本',
    textarea: '多行文本',
    number: '数字',
    date: '日期',
    select: '下拉单选',
    radio: '单选按钮',
    'checkbox-group': '多选按钮',
    'select-multiple': '下拉多选'
};
const columnModeTypes = {
    text: '单行文本',
    textarea: '多行文本',
    number: '数字',
    date: '日期'
};
const currentFieldTypeMap = isColumnMode ? columnModeTypes : fieldModeTypes;
const FIELD_TYPES_REQUIRING_OPTIONS = ['select', 'select-multiple', 'radio', 'checkbox-group'];

// --- Tab 和按钮管理 ---
function updateActionButtons(activeTab) {
    const container = document.getElementById('action-buttons');
    if (!container) return;
    if (activeTab === 'fields') {
        container.innerHTML = `<button class="btn btn-primary" onclick="openFieldModal()">+ 新增${titleText}</button>`;
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

    // 默认添加一个不可删除的“序号”列
    if (isColumnMode && allFields.length === 0) {
        const seqField = {
            id: -1, // 特殊ID表示不可操作
            name: 'sequence',
            label: '序号',
            field_type: 'number',
            validation_rules: [{ rule_type: 'disabled', rule_value: 'True' }]
        };
        allFields.unshift(seqField);
    }


    updateActionButtons('fields');
    renderFieldsTable();
    if(rulesTabBtn) fetchAndRenderRules();
    if (!isReadonly) initializeSortable();
});

// --- 字段/列列表渲染 ---
function renderFieldsTable() {
    const tbody = document.getElementById('fields-tbody');
    tbody.innerHTML = '';
    if (allFields.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">此Sheet下还没有任何${titleText}。</td></tr>`;
        return;
    }
    allFields.forEach(field => {
        const rules = (field.validation_rules || []).reduce((acc, rule) => ({ ...acc, [rule.rule_type]: rule.rule_value }), {});

        const isRequired = rules.required === 'True' ? '<span class="badge bg-success">是</span>' : '<span class="badge bg-danger">否</span>';
        const isDisabled = rules.disabled === 'True' ? '<span class="badge bg-success">是</span>' : '<span class="badge bg-danger">否</span>';
        const lengthLimit = [rules.minLength, rules.maxLength].filter(Boolean).join(' - ') || '—';
        const valueRange = [rules.minValue, rules.maxValue].filter(Boolean).join(' - ') || '—';
        const fieldTypeText = currentFieldTypeMap[field.field_type] || field.field_type;

        const tr = document.createElement('tr');
        tr.dataset.id = field.id;

        const handleCell = field.id === -1 ? '' : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`;

        const actionButtons = field.id === -1 ? '<span>系统保留</span>' : `
            <button class="btn btn-outline-info btn-sm" onclick='openFieldModal(${JSON.stringify(field)})'>${isReadonly ? '查看' : '编辑'}</button>
            ${!isReadonly ? `<button class="btn btn-outline-danger btn-sm ms-2" onclick="deleteField(${field.id}, '${field.label}')">删除</button>` : ''}
        `;

        tr.innerHTML = `
            <td class="text-center handle ${isReadonly ? 'd-none' : ''}">${handleCell}</td>
            <td class="fw-bold">${field.label}</td>
            <td><code>${field.name}</code></td>
            <td>${fieldTypeText}</td>
            <td class="text-center">${isRequired}</td>
            <td class="text-center">${isDisabled}</td>
            <td class="text-center">${lengthLimit}</td>
            <td class="text-center">${valueRange}</td>
            <td>${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 弹窗与保存逻辑 ---
function generateFieldNameFromLabel(str) {
    const baseName = str.replace(/[\u4e00-\u9fa5]/g, ' ').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
    const isPurelyNumeric = /^\d+$/.test(baseName);
    if (!baseName || baseName === 'field' || isPurelyNumeric) {
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

    // 根据模式显示/隐藏选项
    document.getElementById('fixed-form-only-options').style.display = isColumnMode ? 'none' : 'block';
    document.getElementById('fixed-form-validation-rules').style.display = isColumnMode ? 'none' : 'block';

    // 控制选项区域的可见性
    const optionsGroup = document.getElementById('optionsGroup');
    if (optionsGroup) {
        const shouldBeVisible = FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldType);
        optionsGroup.classList.toggle('d-none', !shouldBeVisible);
    }

    // 对于固定表单，显示/隐藏特定校验规则
    if (!isColumnMode) {
        const textRules = document.querySelector('.validation-group.text-rules');
        const numericRules = document.querySelector('.validation-group.numeric-rules');
        const isTextual = ['text', 'textarea'].includes(fieldType);
        if (textRules) textRules.style.display = isTextual ? 'block' : 'none';
        if (numericRules) numericRules.style.display = fieldType === 'number' ? 'block' : 'none';
    }

    // “允许空格”规则仅对文本类型有意义
    const allowSpacesGroup = document.getElementById('allow-spaces-group');
    if (allowSpacesGroup) {
        allowSpacesGroup.style.display = ['text', 'textarea'].includes(fieldType) ? 'block' : 'none';
    }

    // “必填”和“只读”规则对于列模式无效
    if (isColumnMode) {
        document.getElementById('required-rule-group').style.display = 'none';
        document.getElementById('readonly-rule-group').style.display = 'none';
    } else {
        document.getElementById('required-rule-group').style.display = 'inline-block';
        document.getElementById('readonly-rule-group').style.display = 'inline-block';
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
}

function openFieldModal(fieldData = null) {
    if (!fieldModal) {
        fieldModal = new bootstrap.Modal(document.getElementById('fieldModal'));
        document.getElementById('fieldType').addEventListener('change', updateModalUI);
        const labelsEl = document.getElementById('fieldOptionLabels');
        const valuesEl = document.getElementById('fieldOptionValues');
        labelsEl.addEventListener('scroll', () => { valuesEl.scrollTop = labelsEl.scrollTop; });
        valuesEl.addEventListener('scroll', () => { labelsEl.scrollTop = valuesEl.scrollTop; });
        let previousLabels = [];
        labelsEl.addEventListener('input', () => {
            const currentLabels = labelsEl.value.split('\n');
            const currentValues = valuesEl.value.split('\n');
            while(currentValues.length < currentLabels.length) {
                currentValues.push('');
            }
            const newValues = currentLabels.map((label, index) => {
                const oldValue = currentValues[index] || '';
                const oldLabel = previousLabels[index] || '';
                if (oldValue === '' || oldValue === oldLabel) {
                    return label;
                }
                return oldValue;
            });
            valuesEl.value = newValues.join('\n');
            previousLabels = currentLabels.slice();
        });
    }

    const form = document.getElementById('fieldForm');
    form.reset();
    document.querySelectorAll('[id^="validation"]').forEach(el => {
        if(el.type === 'checkbox') el.checked = false; else el.value = '';
    });
    document.getElementById('fieldOptionLabels').value = '';
    document.getElementById('fieldOptionValues').value = '';

    // 填充类型下拉框
    const fieldTypeSelect = document.getElementById('fieldType');
    fieldTypeSelect.innerHTML = '';
    for (const [value, text] of Object.entries(currentFieldTypeMap)) {
        fieldTypeSelect.innerHTML += `<option value="${value}">${text}</option>`;
    }

    document.getElementById('fieldModalTitle').textContent = `新增${titleText}`;
    document.getElementById('fieldTypeLabel').textContent = `${titleText}类型`;
    currentFieldName = '';

    if (fieldData) {
        document.getElementById('fieldModalTitle').textContent = isReadonly ? `查看${titleText}` : `编辑${titleText}`;
        document.getElementById('fieldId').value = fieldData.id;
        document.getElementById('fieldLabel').value = fieldData.label;
        document.getElementById('fieldName').value = fieldData.name;
        fieldTypeSelect.value = fieldData.field_type;

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
                else el.value = r.rule_value || '';
            }
        });

        if (FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldData.field_type)) {
            document.querySelector(`input[name="exportWordAsLabel"][value="${fieldData.export_word_as_label}"]`).checked = true;
            document.querySelector(`input[name="exportExcelAsLabel"][value="${fieldData.export_excel_as_label}"]`).checked = true;
        }

    } else {
        document.getElementById('fieldId').value = '';
        document.querySelector('input[name="exportWordAsLabel"][value="false"]').checked = true;
        document.querySelector('input[name="exportExcelAsLabel"][value="true"]').checked = true;
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
    const validationCheckboxes = ['validationRequired', 'validationDisabled', 'validationAllowEnglishSpace', 'validationAllowChineseSpace'];
    const validationInputs = ['validationPattern', 'validationMinLength', 'validationMaxLength', 'validationContains', 'validationExcludes', 'validationMinValue', 'validationMaxValue'];

    // 只收集当前模式下可见的校验规则
    validationCheckboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) { // 检查元素是否可见
            const key = id.replace('validation', '').charAt(0).toLowerCase() + id.slice(10);
            if (el.checked) validation[key] = 'True';
        }
    });

    validationInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null && el.value.trim()) {
            const key = id.replace('validation', '').charAt(0).toLowerCase() + id.slice(10);
            let value = el.value.trim();
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
            Swal.fire('输入错误', `${titleText}内部名称 '${fieldName}' 已存在，请使用其他名称！`, 'warning');
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

    if (!isColumnMode && FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldType)) {
        payload.option_labels = document.getElementById('fieldOptionLabels').value.trim().split('\n');
        payload.option_values = document.getElementById('fieldOptionValues').value.trim().split('\n');
        payload.export_word_as_label = document.querySelector('input[name="exportWordAsLabel"]:checked').value === 'true';
        payload.export_excel_as_label = document.querySelector('input[name="exportExcelAsLabel"]:checked').value === 'true';
    }

    if (!payload.label || !payload.name) { Swal.fire('输入错误', '显示名称和内部名称不能为空！', 'warning'); return; }
    (method === 'PUT' ? putAPI : postAPI)(url, payload, fieldId ? `${titleText}更新成功！` : `新${titleText}创建成功！`);
}

function deleteField(fieldId, fieldLabel) {
    deleteAPI(`/admin/api/fields/${fieldId}`, `${titleText} "${fieldLabel}"`);
}

// --- 联动规则管理 (省略，未改动) ---
// ...

// --- 通用 ---
function initializeSortable() {
    const fieldsTbody = document.getElementById('fields-tbody');
    new Sortable(fieldsTbody, {
        filter: 'td:has(span:contains("系统保留"))', // 不允许拖动系统保留项
        handle: '.handle', animation: 150, ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            const order = Array.from(fieldsTbody.querySelectorAll('tr')).map(row => row.dataset.id).filter(id => id !== '-1'); // 过滤掉系统保留项
            postAPI(`/admin/api/sheets/${sheetId}/fields/reorder`, { order: order }, `${titleText}顺序已更新`, true);
        },
    });
}