// app/static/js/admin/modules/modal_handler.js

let fieldModal = null;

// 从主模块传递过来的配置
let config = {
    isColumnMode: false,
    isReadonly: false,
    titleText: '字段',
    fieldTypeMap: {},
    FIELD_TYPES_REQUIRING_OPTIONS: [],
    currentFieldName: '',
    saveFieldCallback: () => {}
};

/**
 * 初始化模态框处理器。
 * @param {Object} initialConfig - 初始配置对象。
 */
export function initializeModalHandler(initialConfig) {
    config = { ...config, ...initialConfig };

    if (!fieldModal) {
        fieldModal = new bootstrap.Modal(document.getElementById('fieldModal'));
        _setupEventListeners();
    }
}

/**
 * 设置模态框内部的事件监听器。
 */
function _setupEventListeners() {
    const labelsEl = document.getElementById('fieldOptionLabels');
    const valuesEl = document.getElementById('fieldOptionValues');

    // 同步滚动选项的 label 和 value 文本框
    labelsEl.addEventListener('scroll', () => { valuesEl.scrollTop = labelsEl.scrollTop; });
    valuesEl.addEventListener('scroll', () => { labelsEl.scrollTop = valuesEl.scrollTop; });

    // 当 label 变化时，智能地更新 value
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
            // 如果旧值为空，或者旧值是根据旧标签自动生成的，那么就用新标签更新它
            if (oldValue === '' || oldValue === oldLabel) {
                return label;
            }
            return oldValue; // 否则保留用户自定义的值
        });
        valuesEl.value = newValues.join('\n');
        previousLabels = currentLabels.slice();
    });

    // 监听字段类型变化以更新UI
    document.getElementById('fieldType').addEventListener('change', updateModalUI);

    // 自动从标签生成内部名称
    document.getElementById('fieldLabel').addEventListener('input', autoGenerateName);

    // 保存按钮
    document.getElementById('saveFieldBtn').addEventListener('click', () => {
        if(config.saveFieldCallback) {
            config.saveFieldCallback();
        }
    });
}

/**
 * 当字段类型改变时，更新模态框的UI。
 */
export function updateModalUI() {
    const fieldType = document.getElementById('fieldType').value;

    document.getElementById('options-group').style.display = config.FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldType) ? 'block' : 'none';
    document.getElementById('export-options-group').style.display = config.FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldType) ? 'block' : 'none';

    // 动态显示校验规则
    const textRules = document.querySelector('.validation-group.text-rules');
    const numericRules = document.querySelector('.validation-group.numeric-rules');
    if (textRules) textRules.style.display = ['text', 'textarea'].includes(fieldType) ? 'block' : 'none';
    if (numericRules) numericRules.style.display = fieldType === 'number' ? 'block' : 'none';

    const allowSpacesGroup = document.getElementById('allow-spaces-group');
    if (allowSpacesGroup) {
        allowSpacesGroup.style.display = ['text', 'textarea'].includes(fieldType) ? 'block' : 'none';
    }

    // 根据 textarea 类型切换默认值输入框
    const defaultSingle = document.getElementById('fieldDefaultSingle');
    const defaultMulti = document.getElementById('fieldDefaultMulti');
    defaultSingle.classList.toggle('d-none', fieldType === 'textarea');
    defaultMulti.classList.toggle('d-none', fieldType !== 'textarea');
}


/**
 * 打开新增/编辑字段的模态框。
 * @param {Object|null} fieldData - 要编辑的字段数据，如果为 null 则是新增。
 */
export function openFieldModal(fieldData = null) {
    const form = document.getElementById('fieldForm');
    form.reset();
    document.querySelectorAll('[id^="validation"]').forEach(el => {
        if(el.type === 'checkbox') el.checked = false; else el.value = '';
    });
    document.getElementById('fieldOptionLabels').value = '';
    document.getElementById('fieldOptionValues').value = '';

    const fieldTypeSelect = document.getElementById('fieldType');
    fieldTypeSelect.innerHTML = '';
    for (const [value, text] of Object.entries(config.fieldTypeMap)) {
        fieldTypeSelect.innerHTML += `<option value="${value}">${text}</option>`;
    }

    document.getElementById('fieldModalTitle').textContent = `新增${config.titleText}`;
    config.currentFieldName = '';

    if (fieldData) {
        document.getElementById('fieldModalTitle').textContent = config.isReadonly ? `查看${config.titleText}` : `编辑${config.titleText}`;
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

        config.currentFieldName = fieldData.name;

        (fieldData.validation_rules || []).forEach(r => {
            const el = document.getElementById('validation' + r.rule_type.charAt(0).toUpperCase() + r.rule_type.slice(1));
            if (el) {
                if(el.type === 'checkbox') el.checked = (r.rule_value === 'True');
                else el.value = r.rule_value || '';
            }
        });

        if (config.FIELD_TYPES_REQUIRING_OPTIONS.includes(fieldData.field_type)) {
            document.querySelector(`input[name="exportWordAsLabel"][value="${fieldData.export_word_as_label}"]`).checked = true;
            document.querySelector(`input[name="exportExcelAsLabel"][value="${fieldData.export_excel_as_label}"]`).checked = true;
        }

    } else {
        document.getElementById('fieldId').value = '';
        // 默认值
        document.querySelector('input[name="exportWordAsLabel"][value="false"]').checked = true;
        document.querySelector('input[name="exportExcelAsLabel"][value="true"]').checked = true;
    }

    updateModalUI();

    // 根据只读状态禁用表单
    document.querySelectorAll('#fieldForm input, #fieldForm textarea, #fieldForm select').forEach(el => el.disabled = config.isReadonly);
    document.getElementById('saveFieldBtn').style.display = config.isReadonly ? 'none' : 'block';

    fieldModal.show();
}

/**
 * 从标签文本自动生成内部名称。
 */
function autoGenerateName() {
    // 只有在新增字段时才自动生成
    if (!document.getElementById('fieldId').value) {
        const label = document.getElementById('fieldLabel').value;
        document.getElementById('fieldName').value = generateFieldNameFromLabel(label);
    }
}

/**
 * 工具函数：从标签生成一个合法的字段内部名称。
 * @param {string} str - 标签字符串。
 * @returns {string} - 生成的内部名称。
 */
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
