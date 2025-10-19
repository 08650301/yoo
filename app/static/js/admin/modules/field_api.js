// app/static/js/admin/modules/field_api.js

import { postAPI, putAPI, deleteAPI } from './api_client.js';

let allFields = [];
let sheetId = null;
let currentFieldName = '';
let titleText = '字段';

export function initializeFieldApi(config) {
    allFields = config.allFields;
    sheetId = config.sheetId;
    titleText = config.titleText;
}

export function saveField() {
    const fieldId = document.getElementById('fieldId').value;
    const url = fieldId ? `/admin/api/fields/${fieldId}` : `/admin/api/sheets/${sheetId}/fields`;
    const method = fieldId ? 'PUT' : 'POST';

    const validation = {};
    const validationCheckboxes = ['validationRequired', 'validationDisabled', 'validationAllowEnglishSpace', 'validationAllowChineseSpace'];
    const validationInputs = ['validationPattern', 'validationMinLength', 'validationMaxLength', 'validationContains', 'validationExcludes', 'validationMinValue', 'validationMaxValue'];

    validationCheckboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) {
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

    const fieldTypesRequiringOptions = ['select', 'select-multiple', 'radio', 'checkbox-group'];
    if (fieldTypesRequiringOptions.includes(fieldType)) {
        payload.option_labels = document.getElementById('fieldOptionLabels').value.trim().split('\n');
        payload.option_values = document.getElementById('fieldOptionValues').value.trim().split('\n');
        payload.export_word_as_label = document.querySelector('input[name="exportWordAsLabel"]:checked').value === 'true';
        payload.export_excel_as_label = document.querySelector('input[name="exportExcelAsLabel"]:checked').value === 'true';
    }

    if (!payload.label || !payload.name) { Swal.fire('输入错误', '显示名称和内部名称不能为空！', 'warning'); return; }
    (method === 'PUT' ? putAPI : postAPI)(url, payload, fieldId ? `${titleText}更新成功！` : `新${titleText}创建成功！`);
}

export function deleteField(fieldId, fieldLabel) {
    return deleteAPI(`/admin/api/fields/${fieldId}`, `${titleText} "${fieldLabel}"`);
}
