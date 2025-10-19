// app/static/js/admin/modules/field_renderer.js

/**
 * 渲染字段/列的表格。
 * @param {HTMLElement} tbody - 表格的 tbody 元素。
 * @param {Array} fields - 所有字段的数据数组。
 * @param {Object} fieldTypeMap - 字段类型到中文名称的映射。
 * @param {boolean} isReadonly - 是否为只读模式。
 * @param {string} titleText - 标题文本 ('字段' 或 '列')。
 */
export function renderFieldsTable(tbody, fields, fieldTypeMap, isReadonly, titleText) {
    tbody.innerHTML = '';
    if (fields.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">此Sheet下还没有任何${titleText}。</td></tr>`;
        return;
    }

    fields.forEach(field => {
        const rules = (field.validation_rules || []).reduce((acc, rule) => ({ ...acc, [rule.rule_type]: rule.rule_value }), {});

        const isRequired = rules.required === 'True' ? '<span class="badge bg-success">是</span>' : '<span class="badge bg-danger">否</span>';
        const isDisabled = rules.disabled === 'True' ? '<span class="badge bg-success">是</span>' : '<span class="badge bg-danger">否</span>';
        const lengthLimit = [rules.minLength, rules.maxLength].filter(Boolean).join(' - ') || '—';
        const valueRange = [rules.minValue, rules.maxValue].filter(Boolean).join(' - ') || '—';
        const fieldTypeText = fieldTypeMap[field.field_type] || field.field_type;

        const tr = document.createElement('tr');
        tr.dataset.id = field.id;

        const handleCell = field.id === -1 ? '' : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`;

        const actionButtons = field.id === -1 ? '<span>系统保留</span>' : `
            <button class="btn btn-outline-info btn-sm btn-edit-field" data-field='${JSON.stringify(field)}'>${isReadonly ? '查看' : '编辑'}</button>
            ${!isReadonly ? `<button class="btn btn-outline-danger btn-sm ms-2 btn-delete-field" data-id="${field.id}" data-label="${field.label}">删除</button>` : ''}
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
