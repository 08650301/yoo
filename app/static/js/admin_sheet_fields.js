// 从 <body> 标签的 data-* 属性中获取后端传递的数据
const sheetId = document.body.dataset.sheetId;
const isReadonly = document.body.dataset.readonly === 'true';

// 调试信息
console.log('sheetId:', sheetId);
console.log('isReadonly:', isReadonly);
console.log('raw fields data length:', document.body.dataset.fields ? document.body.dataset.fields.length : 0);

let allFields = [];
let currentFieldName = ''; // 当前编辑的字段名称
try {
    allFields = JSON.parse(document.body.dataset.fields || '[]');
    console.log('成功解析字段数据，数量:', allFields.length);
    if (allFields.length > 0) {
        console.log('第一个字段:', allFields[0]);
    }
} catch (e) {
    console.error('JSON解析错误:', e);
    console.error('原始数据:', document.body.dataset.fields);
    // 使用空数组作为后备
    allFields = [];
}

let fieldModal = null, ruleModal = null;
let conditionalRules = [];
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
    // 检查输入是否为纯数字
    if (/^\d+$/.test(str.trim())) {
        return `field_${str.trim()}`;
    }

    const baseName = str.replace(/[\u4e00-\u9fa5]/g, ' ').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
    // 如果基础名称为空或者是通用名称，添加时间戳和随机数确保唯一性
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
    document.getElementById('optionsGroup').classList.toggle('d-none', !['select', 'radio', 'checkbox-group', 'select-multiple'].includes(fieldType));
    const defaultSingle = document.getElementById('fieldDefaultSingle');
    const defaultMulti = document.getElementById('fieldDefaultMulti');
    defaultSingle.classList.toggle('d-none', fieldType === 'textarea');
    defaultMulti.classList.toggle('d-none', fieldType !== 'textarea');
    if (fieldType === 'textarea' && !defaultSingle.classList.contains('d-none')) { defaultMulti.value = defaultSingle.value; }
    else if (fieldType !== 'textarea' && !defaultMulti.classList.contains('d-none')) { defaultSingle.value = defaultMulti.value; }
    document.querySelector('.validation-group.text-rules').style.display = ['text', 'textarea'].includes(fieldType) ? 'block' : 'none';
    document.querySelector('.validation-group.numeric-rules').style.display = fieldType === 'number' ? 'block' : 'none';

    // 设置基础校验规则（必填和只读不是互斥关系，可以独立设置）
    setupValidationRules();
}

// 设置基础校验规则（必填和只读不是互斥关系，可以独立设置）
function setupValidationRules() {
    const requiredCheckbox = document.getElementById('validationRequired');
    const disabledCheckbox = document.getElementById('validationDisabled');
    const allowEnglishSpaceCheckbox = document.getElementById('validationAllowEnglishSpace');
    const allowChineseSpaceCheckbox = document.getElementById('validationAllowChineseSpace');

    // 必填和只读不是互斥关系，可以独立设置
    // 移除了之前的互斥事件监听器绑定

    // 英文空格和中文空格不是互斥选项，可以同时选择
    // 移除了互斥的事件监听器绑定
}

// 处理必填复选框变化（已移除互斥逻辑）
function handleRequiredChange() {
    // 必填和只读不是互斥关系，可以独立设置
    // 移除了之前的互斥逻辑
}

// 英文空格和中文空格不是互斥选项，可以同时选择
// 移除了互斥的事件处理函数

// 处理只读复选框变化（已移除互斥逻辑）
function handleDisabledChange() {
    // 必填和只读不是互斥关系，可以独立设置
    // 移除了之前的互斥逻辑
}

function openFieldModal(fieldData = null) {
    if (!fieldModal) {
        fieldModal = new bootstrap.Modal(document.getElementById('fieldModal'));
        // 绑定事件监听器，实现 label 到 value 的自动填充
        document.getElementById('fieldOptionsLabel').addEventListener('input', syncOptionsValue);
    }
    const form = document.getElementById('fieldForm');
    form.reset();
    document.querySelectorAll('[id^="validation"]').forEach(el => {
        if (el.type === 'checkbox') el.checked = false; else el.value = '';
    });
    // 重置选项文本域
    document.getElementById('fieldOptionsLabel').value = '';
    document.getElementById('fieldOptionsValue').value = '';


    currentFieldName = ''; // 重置当前字段名称

    if (fieldData) {
        document.getElementById('fieldModalTitle').textContent = isReadonly ? "查看字段" : "编辑字段";
        document.getElementById('fieldId').value = fieldData.id;
        document.getElementById('fieldLabel').value = fieldData.label;
        document.getElementById('fieldName').value = fieldData.name;
        document.getElementById('fieldType').value = fieldData.field_type;

        // 解析并填充选项
        if (Array.isArray(fieldData.options)) {
            const labels = fieldData.options.map(opt => opt.label).join('\n');
            const values = fieldData.options.map(opt => opt.value).join('\n');
            document.getElementById('fieldOptionsLabel').value = labels;
            document.getElementById('fieldOptionsValue').value = values;
        }

        // 加载导出格式配置
        document.getElementById('wordExportAsLabel').checked = fieldData.export_word_as_label;
        document.getElementById('wordExportAsValue').checked = !fieldData.export_word_as_label;
        document.getElementById('excelExportAsLabel').checked = fieldData.export_excel_as_label;
        document.getElementById('excelExportAsValue').checked = !fieldData.export_excel_as_label;

        if (fieldData.field_type === 'textarea') document.getElementById('fieldDefaultMulti').value = fieldData.default_value || '';
        else document.getElementById('fieldDefaultSingle').value = fieldData.default_value || '';
        document.getElementById('fieldHelpTip').value = fieldData.help_tip || '';

        // 保存当前字段名称，用于重复性检查
        currentFieldName = fieldData.name;

        (fieldData.validation_rules || []).forEach(r => {
            const el = document.getElementById('validation' + r.rule_type.charAt(0).toUpperCase() + r.rule_type.slice(1));
            if (el) {
                if (el.type === 'checkbox') el.checked = (r.rule_value === 'True');
                else if (['contains', 'excludes'].includes(r.rule_type)) el.value = (r.rule_value || '').replace(/,/g, '\n');
                else el.value = r.rule_value || '';
            }
            if (r.rule_type === 'allowEnglishSpace') {
                document.getElementById('validationAllowEnglishSpace').checked = (r.rule_value === 'True');
            }
            if (r.rule_type === 'allowChineseSpace') {
                document.getElementById('validationAllowChineseSpace').checked = (r.rule_value === 'True');
            }
        });
    } else {
        document.getElementById('fieldModalTitle').textContent = "新增字段";
        document.getElementById('fieldId').value = '';
        // 设置默认导出选项
        document.getElementById('wordExportAsValue').checked = true;
        document.getElementById('excelExportAsLabel').checked = true;
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
        if (allFields.find(f => f.name === fieldName)) {
            Swal.fire('输入错误', `字段内部名称 '${fieldName}' 已存在，请使用其他名称！`, 'warning');
            return;
        }
    }

    // 组合选项
    const labels = document.getElementById('fieldOptionsLabel').value.trim().split('\n');
    const values = document.getElementById('fieldOptionsValue').value.trim().split('\n');
    const options = labels.map((label, index) => {
        const value = values[index] && values[index].trim() ? values[index].trim() : label;
        return { label, value };
    }).filter(opt => opt.label.trim()); // 过滤掉空的label

    const payload = {
        label: fieldLabel,
        name: fieldName,
        field_type: fieldType,
        options: options,
        default_value: fieldType === 'textarea' ? document.getElementById('fieldDefaultMulti').value.trim() : document.getElementById('fieldDefaultSingle').value.trim(),
        help_tip: document.getElementById('fieldHelpTip').value.trim(),
        validation: validation,
        export_word_as_label: document.getElementById('wordExportAsLabel').checked,
        export_excel_as_label: document.getElementById('excelExportAsLabel').checked
    };

    if (!payload.label || !payload.name) {
        Swal.fire('输入错误', '显示名称和内部名称不能为空！', 'warning');
        return;
    }
    (method === 'PUT' ? putAPI : postAPI)(url, payload, fieldId ? '字段更新成功！' : '新字段创建成功！');
}

// 当用户在“显示值”文本域输入时，自动填充“实际值”
function syncOptionsValue() {
    const labelsText = document.getElementById('fieldOptionsLabel').value;
    const valuesText = document.getElementById('fieldOptionsValue').value;
    const labels = labelsText.split('\n');
    const values = valuesText.split('\n');

    // 只对尚未填写“实际值”的行进行同步
    const newValues = labels.map((label, index) => {
        // 如果当前行已有value，或者label为空，则保持不变
        if ((values[index] && values[index].trim() !== '') || label.trim() === '') {
            return values[index] || '';
        }
        // 否则，根据label生成value
        return generateFieldNameFromLabel(label.trim());
    });

    document.getElementById('fieldOptionsValue').value = newValues.join('\n');
}

function deleteField(fieldId, fieldLabel) {
    deleteAPI(`/admin/api/fields/${fieldId}`, `字段 "${fieldLabel}"`);
}

// --- 联动规则管理 ---
function fetchAndRenderRules() {
     fetch(`/admin/api/sheets/${sheetId}/conditional_rules`)
        .then(handleApiResponse)
        .then(data => {
            conditionalRules = data;
            renderRulesList();
        }).catch(err => console.error("获取联动规则失败:", err));
}

function generateRuleDescription(rule) {
    if (!rule.definition) return '规则定义不完整';
    const findFieldLabel = (fieldName) => allFields.find(f => f.name === fieldName)?.label || fieldName;
    const findOperatorText = (opValue) => [...OPERATORS.all, ...OPERATORS.numeric].find(o => o.value === opValue)?.text || opValue;
    const findActionText = (actionValue) => ACTIONS.find(a => a.value === actionValue)?.text || actionValue;

    const ifDef = rule.definition.if;
    const ifFieldLabel = findFieldLabel(ifDef.field);
    const ifOperatorText = findOperatorText(ifDef.operator);
    let ifPart = `如果 <strong>${ifFieldLabel}</strong> ${ifOperatorText}`;
    if (!['is_empty', 'is_not_empty'].includes(ifDef.operator)) {
        ifPart += ` <strong>'${ifDef.value}'</strong>`;
    }

    const thenParts = rule.definition.then.map(action => {
        const actionText = findActionText(action.action);
        let targetsText = (action.targets || []).map(t => `<strong>'${findFieldLabel(t)}'</strong>`).join(', ');
        if (action.action === 'validate_comparison') {
             return `${actionText} ${targetsText} ${findOperatorText(action.operator)} <strong>'${findFieldLabel(action.comparison_field)}'</strong>`;
        } else if (action.action === 'filter_options') {
             return `当值为 <strong>'${action.filter_value}'</strong> 时, ${actionText} ${targetsText}`;
        }
        return `${actionText} ${targetsText}`;
    }).join('; ');

    return `那么 ${ifPart}, 那么 ${thenParts}`;
}

function renderRulesList() {
    const container = document.getElementById('rules-list');
    container.innerHTML = '';
    if (conditionalRules.length === 0) {
        container.innerHTML = `<div class="list-group-item text-center text-muted">还没有定义任何联动规则。</div>`;
        return;
    }
    conditionalRules.forEach(rule => {
        const description = generateRuleDescription(rule);
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h5 class="mb-1">${rule.name}</h5>
                <div>
                   <button class="btn btn-outline-info btn-sm" onclick='openRuleModal(${JSON.stringify(rule)})'>${isReadonly ? '查看' : '编辑'}</button>
                   ${!isReadonly ? `<button class="btn btn-outline-danger btn-sm ms-2" onclick="deleteRule(${rule.id}, '${rule.name}')">删除</button>` : ''}
                </div>
            </div>
            <p class="mb-1 text-muted"><small>${description}</small></p>
        `;
        container.appendChild(item);
    });
}

// --- 联动规则弹窗逻辑 ---
const OPERATORS = {
    all: [ { value: 'equals', text: '等于' }, { value: 'not_equals', text: '不等于' }, { value: 'contains', text: '包含' }, { value: 'not_contains', text: '不包含' }, { value: 'is_empty', text: '为空' }, { value: 'is_not_empty', text: '不为空' } ],
    numeric: [ { value: 'greater_than', text: '大于' }, { value: 'less_than', text: '小于' }, { value: 'greater_than_or_equals', text: '大于等于' }, { value: 'less_than_or_equals', text: '小于等于' } ]
};
const ACTIONS = [ { value: 'show', text: '显示' }, { value: 'hide', text: '隐藏' }, { value: 'enable', text: '启用' }, { value: 'disable', text: '禁用' }, { value: 'set_required', text: '设为必填' }, { value: 'set_optional', text: '设为选填' }, { value: 'validate_comparison', text: '校验 (跨字段比较)' }, { value: 'filter_options', text: '筛选下拉选项' } ];

function populateSelect(selectEl, options, selectedValue) {
    selectEl.innerHTML = '';
    options.forEach(opt => {
        const option = new Option(opt.label || opt.text, opt.value || opt.name);
        selectEl.add(option);
    });
    if (selectedValue) selectEl.value = selectedValue;
}

function openRuleModal(rule = null) {
    if (!ruleModal) ruleModal = new bootstrap.Modal(document.getElementById('ruleModal'));
    const isEditing = rule !== null;
    document.getElementById('ruleModalTitle').textContent = isReadonly ? '查看规则' : (isEditing ? '编辑联动规则' : '新增联动规则');

    document.getElementById('ruleId').value = isEditing ? rule.id : '';
    document.getElementById('ruleName').value = isEditing ? rule.name : '';
    document.getElementById('then-actions').innerHTML = '';

    const ifFieldSelect = document.getElementById('if-field');
    populateSelect(ifFieldSelect, allFields.map(f => ({ value: f.name, text: f.label })));
    ifFieldSelect.onchange = () => updateIfOperators();

    if (isEditing) { ifFieldSelect.value = rule.definition.if.field; }
    updateIfOperators(isEditing ? rule.definition.if.operator : null);
    document.getElementById('if-value').value = isEditing ? rule.definition.if.value : '';

    if (isEditing) { rule.definition.then.forEach(action => addActionBlock('then', action)); }

    document.querySelectorAll('#ruleModal input, #ruleModal textarea, #ruleModal select, #ruleModal button').forEach(el => el.disabled = isReadonly);
    document.querySelector('#ruleModal .btn-close').disabled = false;
    document.querySelector('#ruleModal .modal-footer .btn-secondary').disabled = false;
    document.getElementById('saveRuleBtn').style.display = isReadonly ? 'none' : 'block';

    ruleModal.show();
}

function updateIfOperators(selectedValue) {
    const fieldName = document.getElementById('if-field').value;
    const field = allFields.find(f => f.name === fieldName);
    let operators = [...OPERATORS.all];
    if (field && ['number', 'date'].includes(field.field_type)) {
        operators.push(...OPERATORS.numeric);
    }
    populateSelect(document.getElementById('if-operator'), operators, selectedValue);
}

function addActionBlock(type, data = {}) {
    const container = document.getElementById(`${type}-actions`);
    const block = document.createElement('div');
    block.className = 'action-block row align-items-center';
    const actionSelectId = `${type}-action-${container.children.length}`;
    block.innerHTML = `<div class="col-md-3"><select id="${actionSelectId}" class="form-select action-type"></select></div><div class="col-md-8 action-config"></div><div class="col-md-1"><button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button></div>`;
    container.appendChild(block);
    const actionSelect = block.querySelector('.action-type');
    populateSelect(actionSelect, ACTIONS, data.action);
    actionSelect.onchange = () => renderActionConfig(block, actionSelect.value);
    renderActionConfig(block, actionSelect.value, data);
}

function renderActionConfig(block, action, data = {}) {
    const configContainer = block.querySelector('.action-config');
    let html = '';
    const multiSelectFields = allFields.map(f => `<option value="${f.name}" ${data.targets?.includes(f.name) ? 'selected' : ''}>${f.label}</option>`).join('');
    switch(action) {
        case 'show': case 'hide': case 'enable': case 'disable': case 'set_required': case 'set_optional':
            html = `<select class="form-select target-fields" multiple>${multiSelectFields}</select>`; break;
        case 'validate_comparison':
            const ops = [...OPERATORS.all, ...OPERATORS.numeric].map(op=>`<option value="${op.value}" ${data.operator === op.value ? 'selected' : ''}>${op.text}</option>`).join('');
            const targets = allFields.map(f => `<option value="${f.name}" ${data.targets?.[0] === f.name ? 'selected' : ''}>${f.label}</option>`).join('');
            const compare = allFields.map(f => `<option value="${f.name}" ${data.comparison_field === f.name ? 'selected' : ''}>${f.label}</option>`).join('');
            html = `<div class="row g-2 align-items-center"><div class="col-auto">校验字段</div><div class="col"><select class="form-select target-fields">${targets}</select></div><div class="col"><select class="form-select comparison-operator">${ops}</select></div><div class="col-auto">于</div><div class="col"><select class="form-select comparison-field">${compare}</select></div></div><input type="text" class="form-control mt-2 custom-message" placeholder="自定义错误信息 (可选)" value="${data.message || ''}">`; break;
        case 'filter_options':
            const selects = allFields.filter(f => f.field_type === 'select').map(f => `<option value="${f.name}" ${data.targets?.[0] === f.name ? 'selected' : ''}>${f.label}</option>`).join('');
            html = `<div class="row g-2 align-items-center"><div class="col-auto">筛选</div><div class="col"><select class="form-select target-fields">${selects}</select></div><div class="col-auto">当触发值为</div><div class="col"><input type="text" class="form-control filter-value" placeholder="例如: 广东省" value="${data.filter_value || ''}"></div><div class="col-auto">显示选项</div><div class="col"><textarea class="form-control filter-options" rows="1" placeholder="每行一个">${data.options ? data.options.join('\n') : ''}</textarea></div></div>`; break;
    }
    configContainer.innerHTML = html;
}

function saveRule() {
    const ruleId = document.getElementById('ruleId').value;
    const url = ruleId ? `/admin/api/conditional_rules/${ruleId}` : `/admin/api/sheets/${sheetId}/conditional_rules`;
    const method = ruleId ? 'PUT' : 'POST';
    const definition = { if: { field: document.getElementById('if-field').value, operator: document.getElementById('if-operator').value, value: document.getElementById('if-value').value }, then: [] };
    document.querySelectorAll('#then-actions .action-block').forEach(block => {
        const action = block.querySelector('.action-type').value;
        const actionData = { action };
        const targetsSelect = block.querySelector('.target-fields');
        if (targetsSelect) { actionData.targets = Array.from(targetsSelect.selectedOptions).map(opt => opt.value); }
        if (action === 'validate_comparison') {
            actionData.operator = block.querySelector('.comparison-operator').value;
            actionData.comparison_field = block.querySelector('.comparison-field').value;
            actionData.message = block.querySelector('.custom-message').value;
        } else if (action === 'filter_options') {
            actionData.filter_value = block.querySelector('.filter-value').value;
            actionData.options = block.querySelector('.filter-options').value.split('\n').filter(Boolean);
        }
        definition.then.push(actionData);
    });
    const payload = { name: document.getElementById('ruleName').value.trim(), definition: definition };
    if (!payload.name) { Swal.fire('输入错误', '规则名称不能为空！', 'warning'); return; }
    const promise = (method === 'PUT' ? putAPI : postAPI)(url, payload, ruleId ? '联动规则更新成功！' : '联动规则创建成功！', true);
    promise.then(() => fetchAndRenderRules()).catch(err => console.error("保存规则失败", err));
    if (ruleModal) ruleModal.hide();
}

function deleteRule(ruleId, ruleName) {
    deleteAPI(`/admin/api/conditional_rules/${ruleId}`, `规则 "${ruleName}"`, true).then(() => fetchAndRenderRules());
}

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
