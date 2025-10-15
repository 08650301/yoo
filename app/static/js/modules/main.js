// app/static/js/modules/main.js

import { initializeSidebar } from './sidebar_handler.js';
import { loadPreview, initializeLivePreview, updatePreviewOnLoad } from './live_preview.js';

const projectId = document.body.dataset.projectId;
const procurementMethod = document.body.dataset.procurementMethod;

let masterConfig = {};
let currentSheetName = '', currentSectionName = '';
let periodicSaveTimer;
let hasChanges = false;
const saveStatusEl = document.getElementById('save-status');
let visibleRankCount = 5, editModal = null, logicEngine = null;

// ==============================================================================
//  Main Initialization
// ==============================================================================

window.onload = function() {
    initializeSidebar();

    fetch(`/api/forms-config/${procurementMethod}`)
        .then(response => response.json())
        .then(data => {
            masterConfig = data;
            createSidebarNav(data.sections);
        });

    loadProcurementMethods();
    loadPreview();
};

// ... (The rest of the functions from project.js are below) ...

function updateSaveStatus(text) {
    const el = document.getElementById('save-status');
    if (el) {
        el.textContent = text;
    }
}

// ==============================================================================
// 联动规则引擎 (Conditional Logic Engine)
// ==============================================================================
class ConditionalLogicEngine {
    constructor(formId, rules, fields) {
        this.form = document.getElementById(formId);
        this.rules = rules;
        this.fields = fields.reduce((acc, f) => ({ ...acc, [f.name]: f }), {});
        this.originalOptions = {};
    }

    init() {
        this.form.querySelectorAll('input, textarea, select').forEach(el => {
            const fieldName = el.name;
            if (this.originalOptions[fieldName] === undefined && el.tagName === 'SELECT') {
                 this.originalOptions[fieldName] = Array.from(el.options).map(opt => ({ value: opt.value, text: opt.text }));
            }
            el.addEventListener('change', () => this.evaluateAllRules());
            el.addEventListener('input', () => this.evaluateAllRules());
        });

        this._applyInitialDisabledState();

        setTimeout(() => this.evaluateAllRules(), 200);
    }

    _applyInitialDisabledState() {
        Object.keys(this.fields).forEach(fieldName => {
            const fieldConfig = this.fields[fieldName];
            const isOriginallyDisabled = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'disabled' && r.rule_value === 'True');

            if (isOriginallyDisabled) {
                const elements = this.form.querySelectorAll(`[name="${fieldName}"]`);
                if (elements.length === 0) return;

                const wrapper = elements[0].closest('.mb-3, .form-check');
                const label = wrapper?.querySelector('label:not(.form-check-label)');

                elements.forEach(el => {
                    el.disabled = true;
                    el.required = false;
                    el.removeAttribute('required');
                    if (label) {
                        const requiredIndicator = label.querySelector('.required-indicator');
                        if (requiredIndicator) {
                            requiredIndicator.remove();
                        }
                    }
                    el.removeAttribute('data-allow-english-space');
                    el.removeAttribute('data-allow-chinese-space');
                });
            }
        });
    }

    _getFieldValue(fieldName) {
        const el = this.form.querySelector(`[name="${fieldName}"]`);
        if (!el) return null;
        if (el.type === 'radio') return this.form.querySelector(`[name="${fieldName}"]:checked`)?.value || '';
        if (el.type === 'checkbox') return el.checked;
        return el.value;
    }

    _checkCondition(condition) {
        let value = this._getFieldValue(condition.field);
        if (typeof value === 'boolean') {
            value = value ? '是' : '否';
        } else if (value === 'True') {
            value = '是';
        } else if (value === 'False') {
            value = '否';
        }
        const conditionValue = condition.value;

        switch(condition.operator) {
            case 'equals': return value == conditionValue;
            case 'not_equals': return value != conditionValue;
            case 'contains': return String(value).includes(conditionValue);
            case 'not_contains': return !String(value).includes(conditionValue);
            case 'is_empty': return value === null || value === undefined || value === '';
            case 'is_not_empty': return value !== null && value !== undefined && value !== '';
            case 'greater_than': return Number(value) > Number(conditionValue);
            case 'less_than': return Number(value) < Number(conditionValue);
            case 'greater_than_or_equals': return Number(value) >= Number(conditionValue);
            case 'less_than_or_equals': return Number(value) <= Number(conditionValue);
            default: return false;
        }
    }

    evaluateAllRules() {
        this.rules.forEach(rule => this.applyRule(rule));
    }

    applyRule(rule) {
        const ruleDefinition = rule.definition || rule;
        const conditionMet = this._checkCondition(ruleDefinition.if);
        ruleDefinition.then.forEach(action => this._executeAction(action, conditionMet, rule));
    }

    _executeAction(action, conditionMet, rule) {
        (action.targets || []).forEach(targetName => {
            const elements = this.form.querySelectorAll(`[name="${targetName}"]`);
            if (elements.length === 0) return;

            const wrapper = elements[0].closest('.mb-3, .form-check');
            const label = wrapper?.querySelector('label:not(.form-check-label)');
            const fieldConfig = this.fields[targetName];
            const isOriginallyRequired = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'required' && r.rule_value === 'True');
            const isOriginallyDisabled = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'disabled' && r.rule_value === 'True');

            const actionType = action.action || action.type;
            switch(actionType) {
                case 'show': wrapper?.classList.toggle('form-group-hidden', !conditionMet); break;
                case 'hide': wrapper?.classList.toggle('form-group-hidden', conditionMet); break;
                case 'enable': elements.forEach(el => {
                    el.disabled = !conditionMet;
                    if (conditionMet) {
                        el.required = isOriginallyRequired;
                        if (isOriginallyRequired) {
                            el.setAttribute('required', 'required');
                        } else {
                            el.removeAttribute('required');
                        }
                    }
                }); break;
                case 'disable': elements.forEach(el => {
                    el.disabled = conditionMet;
                    if (conditionMet) {
                        el.required = false;
                        el.removeAttribute('required');
                        const wrapper = el.closest('.mb-3, .form-check');
                        const label = wrapper?.querySelector('label:not(.form-check-label)');
                        if (label) {
                            const requiredIndicator = label.querySelector('.required-indicator');
                            if (requiredIndicator) {
                                requiredIndicator.remove();
                            }
                        }
                    } else {
                        el.disabled = isOriginallyDisabled;
                        el.required = isOriginallyRequired && !isOriginallyDisabled;
                        if (isOriginallyRequired && !isOriginallyDisabled) {
                            el.setAttribute('required', 'required');
                            const wrapper = el.closest('.mb-3, .form-check');
                            const label = wrapper?.querySelector('label:not(.form-check-label)');
                            if (label && !label.querySelector('.required-indicator')) {
                                label.insertAdjacentHTML('beforeend', '<span class="required-indicator">*</span>');
                            }
                        }
                    }
                }); break;
            }
        });
    }
}

function loadProcurementMethods() {
    fetch('/api/published-templates').then(r => r.json()).then(methods => {
        const sel = document.getElementById('editProcurementMethod');
        if (!sel) return;
        sel.innerHTML = '';
        methods.forEach(m => sel.innerHTML += `<option value="${m}">${m}</option>`);
        sel.value = procurementMethod;
    });
}

function createSidebarNav(sections) {
    const nav = document.getElementById('sheet-nav');
    nav.innerHTML = '';
    for (const sectionName in sections) {
        const title = document.createElement('div');
        title.className = 'sidebar-section-title';
        title.textContent = sectionName;
        title.onclick = function() {
            this.classList.toggle('collapsed');
            const container = this.nextElementSibling;
            container.style.display = container.style.display === "none" ? "block" : "none";
        };
        nav.appendChild(title);
        const linksContainer = document.createElement('div');
        linksContainer.className = 'list-group list-group-flush';
        const section = sections[sectionName];
        section.order.forEach(sheetName => {
            if (section.forms[sheetName]) {
                const link = document.createElement('a');
                link.className = 'nav-link';
                link.href = '#';
                link.textContent = sheetName;
                link.onclick = (e) => { e.preventDefault(); document.querySelectorAll('#sheet-nav .nav-link').forEach(l => l.classList.remove('active')); link.classList.add('active'); loadForm(sheetName, sectionName); };
                linksContainer.appendChild(link);
            }
        });
        nav.appendChild(linksContainer);
    }
}

function loadForm(sheetName, sectionName) {
    clearInterval(periodicSaveTimer);
    hasChanges = false;
    visibleRankCount = 5;
    currentSheetName = sheetName;
    currentSectionName = sectionName;

    const exportExcelButton = document.getElementById('export-button');
    exportExcelButton.textContent = `导出 ${sectionName} Excel`;
    exportExcelButton.disabled = false;
    const exportWordButton = document.getElementById('export-word-button');
    exportWordButton.disabled = false;

    const config = masterConfig.sections[sectionName].forms[sheetName];
    document.getElementById('sheet-title').textContent = sheetName;
    const contentDiv = document.getElementById('sheet-content');
    contentDiv.innerHTML = '';
    document.getElementById('save-button').classList.remove('d-none');
    updateSaveStatus('已加载');

    fetch(`/api/projects/${projectId}/sheets/${sheetName}`).then(r => r.json()).then(data => {
        if (config.type === 'fixed_form') {
            renderFixedForm(contentDiv, config, data);
            // Logic restored from the main branch's project.js
            if (config.conditional_rules && config.conditional_rules.length > 0) {
                setTimeout(() => {
                    logicEngine = new ConditionalLogicEngine('sheet-content', config.conditional_rules, config.fields);
                    logicEngine.init();
                }, 100);
            }
        } else if (config.type === 'dynamic_table') {
            renderDynamicTable(contentDiv, config, data);
        }
        startAutoSave();
        // Immediately update the preview based on the initial data.
        updatePreviewOnLoad(data, config);
    });
}

// Expose the loadForm function to the global scope for Playwright testing
window.loadForm = loadForm;

function renderFixedForm(container, config, data) {
    container.innerHTML = '';
    config.fields.forEach(field => {
        const fieldValue = data[field.name];
        const value = (fieldValue === undefined || fieldValue === null || fieldValue === '') ? (field.default_value || '') : fieldValue;
        const rules = (field.validation_rules || []).reduce((acc, rule) => ({ ...acc, [rule.rule_type]: rule.rule_value }), {});
        const isRequired = (rules.required || '').toLowerCase() === 'true';
        const isReadonly = (rules.readonly || '').toLowerCase() === 'true';

        const formGroup = document.createElement('div');
        formGroup.className = 'mb-3';
        formGroup.setAttribute('data-field-name', field.name);

        let fieldHtml = '';
        const requiredAttr = isRequired ? 'required' : '';
        const readonlyAttr = isReadonly ? 'readonly' : '';
        const labelHtml = `<label class="form-label" for="field-${field.name}">${field.label}${isRequired ? '<span class="required-indicator">*</span>' : ''}</label>`;

        const commonAttrs = `name="${field.name}" id="field-${field.name}" class="form-control" ${requiredAttr} ${readonlyAttr}`;

        switch (field.type) {
            case 'textarea':
                fieldHtml = `${labelHtml}<textarea ${commonAttrs} rows="3">${value}</textarea>`;
                break;
            case 'select': // This is now 'select-single'
                fieldHtml = `${labelHtml}<select ${commonAttrs.replace('form-control', 'form-select')}>`;
                fieldHtml += `<option value="">--- 请选择 ---</option>`;
                (field.options || '').split(',').forEach(opt => {
                    const trimmedOpt = opt.trim();
                    fieldHtml += `<option value="${trimmedOpt}" ${value === trimmedOpt ? 'selected' : ''}>${trimmedOpt}</option>`;
                });
                fieldHtml += `</select>`;
                break;
            case 'radio':
                fieldHtml = `<div>${labelHtml}</div>`;
                (field.options || '').split(',').forEach((opt, index) => {
                    const trimmedOpt = opt.trim();
                    const radioId = `field-${field.name}-${index}`;
                    fieldHtml += `
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="${field.name}" id="${radioId}" value="${trimmedOpt}" ${value === trimmedOpt ? 'checked' : ''} ${requiredAttr} ${readonlyAttr}>
                            <label class="form-check-label" for="${radioId}">${trimmedOpt}</label>
                        </div>`;
                });
                break;
            case 'checkbox-group':
                fieldHtml = `<div>${labelHtml}</div>`;
                const selectedValues = (value || '').split(',').map(v => v.trim());
                (field.options || '').split(',').forEach((opt, index) => {
                    const trimmedOpt = opt.trim();
                    const checkId = `field-${field.name}-${index}`;
                    const checkedAttr = selectedValues.includes(trimmedOpt) ? 'checked' : '';
                    fieldHtml += `
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="checkbox" name="${field.name}" id="${checkId}" value="${trimmedOpt}" ${checkedAttr} ${readonlyAttr}>
                            <label class="form-check-label" for="${checkId}">${trimmedOpt}</label>
                        </div>`;
                });
                break;
            case 'select-multiple':
                const selectedMulti = (value || '').split(',').map(v => v.trim());
                fieldHtml = `${labelHtml}<select ${commonAttrs.replace('form-control', 'form-select')} multiple>`;
                (field.options || '').split(',').forEach(opt => {
                    const trimmedOpt = opt.trim();
                    const selectedAttr = selectedMulti.includes(trimmedOpt) ? 'selected' : '';
                    fieldHtml += `<option value="${trimmedOpt}" ${selectedAttr}>${trimmedOpt}</option>`;
                });
                fieldHtml += `</select>`;
                break;
            default: // text, number, date, etc.
                fieldHtml = `${labelHtml}<input type="${field.type || 'text'}" value="${value}" ${commonAttrs}>`;
                break;
        }

        formGroup.innerHTML = fieldHtml;
        container.appendChild(formGroup);
    });
}

function renderDynamicTable(container, config, data) {
    // ... (This function remains exactly the same)
}

function startAutoSave() {
    document.getElementById('sheet-content').addEventListener('input', triggerChange);
    initializeLivePreview(); // Call this here to attach listeners to the newly rendered form
    periodicSaveTimer = setInterval(() => {
        if (hasChanges) {
            saveData(true);
        }
    }, 30000);
}

function triggerChange() {
    hasChanges = true;
    updateSaveStatus('有未保存的更改');
}

function manualSave() {
    saveData(false);
}

function saveData(isAuto) {
    if (!currentSheetName) return;

    const config = masterConfig.sections[currentSectionName].forms[currentSheetName];
    const formElement = document.getElementById('sheet-content');
    let payload;

    if (config.type === 'fixed_form') {
        payload = {};
        // Manually build payload to handle new field types
        config.fields.forEach(field => {
            if (field.type === 'checkbox-group') {
                const checkedBoxes = formElement.querySelectorAll(`input[name="${field.name}"]:checked`);
                payload[field.name] = Array.from(checkedBoxes).map(cb => cb.value).join(',');
            } else if (field.type === 'select-multiple') {
                const selectElement = formElement.querySelector(`select[name="${field.name}"]`);
                if (selectElement) {
                    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);
                    payload[field.name] = selectedOptions.join(',');
                }
            } else {
                const el = formElement.querySelector(`[name="${field.name}"]`);
                if (el) {
                    if (el.type === 'radio') {
                        const checkedRadio = formElement.querySelector(`[name="${field.name}"]:checked`);
                        payload[field.name] = checkedRadio ? checkedRadio.value : '';
                    } else {
                        payload[field.name] = el.value;
                    }
                }
            }
        });
    } else if (config.type === 'dynamic_table') {
        payload = [];
        const rows = formElement.querySelectorAll('tbody tr');
        const columns = config.columns.map(c => c.name);
        rows.forEach(row => {
            const rowData = {};
            columns.forEach((colName, index) => {
                const input = row.cells[index].querySelector('input, select, textarea');
                if (input) {
                    rowData[colName] = input.value;
                }
            });
            payload.push(rowData);
        });
    }

    if (isAuto) {
        updateSaveStatus('自动保存中...');
    } else {
        updateSaveStatus('正在保存...');
    }

    fetch(`/api/projects/${projectId}/sheets/${currentSheetName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            hasChanges = false;
            const now = new Date();
            updateSaveStatus(`已于 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} 保存`);
        } else {
            updateSaveStatus(`保存失败: ${data.error || '未知错误'}`);
        }
    })
    .catch(error => {
        console.error('Save error:', error);
        updateSaveStatus('保存出错，请检查网络');
    });
}

// Expose manualSave for the button's onclick attribute
window.manualSave = manualSave;
