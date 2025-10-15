// 从 <body> 标签的 data-* 属性中获取后端传递的数据
const projectId = document.body.dataset.projectId;
const procurementMethod = document.body.dataset.procurementMethod;

// 全局变量，用于存储当前状态和配置
let masterConfig = {};
let currentSheetName = '', currentSectionName = '';
let periodicSaveTimer;
let hasChanges = false;
const saveStatusEl = document.getElementById('save-status');
let visibleRankCount = 5, editModal = null, logicEngine = null;

// ==============================================================================
// 联动规则引擎 (Conditional Logic Engine)
// ==============================================================================
class ConditionalLogicEngine {
    constructor(formId, rules, fields) {
        this.form = document.getElementById(formId);
        this.rules = rules;
        // 将字段数组转换为以字段 name 为 key 的对象，方便快速查找
        this.fields = fields.reduce((acc, f) => ({ ...acc, [f.name]: f }), {});
        // 用于存储下拉框的原始选项，以便在筛选后可以恢复
        this.originalOptions = {};
    }

    // 初始化引擎：为表单中的所有元素绑定事件监听
    init() {
        this.form.querySelectorAll('input, textarea, select').forEach(el => {
            const fieldName = el.name;
            // 如果是下拉框，备份其原始选项
            if (this.originalOptions[fieldName] === undefined && el.tagName === 'SELECT') {
                 this.originalOptions[fieldName] = Array.from(el.options).map(opt => ({ value: opt.value, text: opt.text }));
            }
            // 当字段值改变时，重新评估所有规则
            el.addEventListener('change', () => this.evaluateAllRules());
            el.addEventListener('input', () => this.evaluateAllRules());
        });

        // 处理初始disabled状态
        this._applyInitialDisabledState();

        // 页面加载后立即执行一次所有规则，以设置初始状态
        // 使用setTimeout确保在DOM完全渲染后再执行规则评估
        setTimeout(() => this.evaluateAllRules(), 200);
    }

    // 应用初始disabled状态
    _applyInitialDisabledState() {
        Object.keys(this.fields).forEach(fieldName => {
            const fieldConfig = this.fields[fieldName];
            const isOriginallyDisabled = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'disabled' && r.rule_value === 'True');

            if (isOriginallyDisabled) {
                const elements = this.form.querySelectorAll(`[name="${fieldName}"]`);
                if (elements.length === 0) return;

                const wrapper = elements[0].closest('.mb-3, .form-check');
                const label = wrapper?.querySelector('label:not(.form-check-label)');
                const isOriginallyRequired = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'required' && r.rule_value === 'True');

                elements.forEach(el => {
                    el.disabled = true;
                    // 当字段被禁用时，移除必填验证和必填标识
                    el.required = false;
                    el.removeAttribute('required');
                    // 移除必填标识（星号*）
                    if (label) {
                        const requiredIndicator = label.querySelector('.required-indicator');
                        if (requiredIndicator) {
                            requiredIndicator.remove();
                        }
                    }
                    // 禁用时移除空格验证属性
                    el.removeAttribute('data-allow-english-space');
                    el.removeAttribute('data-allow-chinese-space');
                });
            }
        });
    }

    // 获取指定字段的当前值
    _getFieldValue(fieldName) {
        const el = this.form.querySelector(`[name="${fieldName}"]`);
        if (!el) return null;
        if (el.type === 'radio') return this.form.querySelector(`[name="${fieldName}"]:checked`)?.value || '';
        if (el.type === 'checkbox') return el.checked;
        return el.value;
    }

    // 检查单个 "if" 条件是否满足
    _checkCondition(condition) {
        let value = this._getFieldValue(condition.field);
        // 对布尔值（来自复选框）进行特殊处理，转换为 "是"/"否" 以匹配规则
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

    // 评估所有规则
    evaluateAllRules() {
        this.rules.forEach(rule => this.applyRule(rule));
    }

    // 应用单条规则
    applyRule(rule) {
        // 处理嵌套的definition结构（从后端API获取的规则数据）
        const ruleDefinition = rule.definition || rule;
        const conditionMet = this._checkCondition(ruleDefinition.if);
        // 遍历该规则下的所有 "then" 动作并执行
        ruleDefinition.then.forEach(action => this._executeAction(action, conditionMet, rule));
    }

    // 执行单个 "then" 动作
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
                    // 当条件满足时（conditionMet为true），恢复原来的必填状态
                    if (conditionMet) {
                        const fieldConfig = this.fields[targetName];
                        const isOriginallyRequired = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'required' && r.rule_value === 'True');
                        el.required = isOriginallyRequired;
                        if (isOriginallyRequired) {
                            el.setAttribute('required', 'required');
                        } else {
                            el.removeAttribute('required');
                        }
                        // 设置空格验证属性
                        if (fieldConfig && fieldConfig.validation_rules) {
                            const allowEnglishSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowEnglishSpace' && r.rule_value === 'True');
                            const allowChineseSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowChineseSpace' && r.rule_value === 'True');
                            if (allowEnglishSpace) el.setAttribute('data-allow-english-space', 'true');
                            if (allowChineseSpace) el.setAttribute('data-allow-chinese-space', 'true');
                        }
                    }
                }); break;
                case 'disable': elements.forEach(el => {
                    el.disabled = conditionMet;
                    // 当字段被禁用时，移除必填验证和必填标识
                    if (conditionMet) {
                        el.required = false;
                        el.removeAttribute('required');
                        // 移除必填标识（星号*）
                        const wrapper = el.closest('.mb-3, .form-check');
                        const label = wrapper?.querySelector('label:not(.form-check-label)');
                        if (label) {
                            const requiredIndicator = label.querySelector('.required-indicator');
                            if (requiredIndicator) {
                                requiredIndicator.remove();
                            }
                        }
                        // 禁用时移除空格验证属性
                        el.removeAttribute('data-allow-english-space');
                        el.removeAttribute('data-allow-chinese-space');
                    } else {
                        // 当条件不满足时（从禁用状态恢复），恢复原来的必填状态和disabled状态
                        const fieldConfig = this.fields[targetName];
                        const isOriginallyRequired = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'required' && r.rule_value === 'True');
                        const isOriginallyDisabled = (fieldConfig.validation_rules || []).some(r => r.rule_type === 'disabled' && r.rule_value === 'True');

                        // 恢复disabled状态（如果原始状态是disabled，则保持disabled）
                        el.disabled = isOriginallyDisabled;

                        // 恢复必填状态
                        el.required = isOriginallyRequired && !isOriginallyDisabled;
                        if (isOriginallyRequired && !isOriginallyDisabled) {
                            el.setAttribute('required', 'required');
                            // 恢复必填标识（星号*）
                            const wrapper = el.closest('.mb-3, .form-check');
                            const label = wrapper?.querySelector('label:not(.form-check-label)');
                            if (label && !label.querySelector('.required-indicator')) {
                                label.insertAdjacentHTML('beforeend', '<span class="required-indicator">*</span>');
                            }
                        }
                        // 恢复空格验证属性
                        if (fieldConfig && fieldConfig.validation_rules) {
                            const allowEnglishSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowEnglishSpace' && r.rule_value === 'True');
                            const allowChineseSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowChineseSpace' && r.rule_value === 'True');
                            if (allowEnglishSpace) el.setAttribute('data-allow-english-space', 'true');
                            if (allowChineseSpace) el.setAttribute('data-allow-chinese-space', 'true');
                        }
                    }
                }); break;
                case 'set_required': {
                    const isRequired = conditionMet;
                    elements.forEach(el => {
                        el.required = isRequired;
                        // 设置空格验证属性
                        const fieldConfig = this.fields[targetName];
                        if (fieldConfig && fieldConfig.validation_rules) {
                            const allowEnglishSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowEnglishSpace' && r.rule_value === 'True');
                            const allowChineseSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowChineseSpace' && r.rule_value === 'True');
                            if (allowEnglishSpace) el.setAttribute('data-allow-english-space', 'true');
                            if (allowChineseSpace) el.setAttribute('data-allow-chinese-space', 'true');
                        }
                    });
                    label?.querySelector('.required-indicator')?.remove();
                    if (isRequired && label) label.insertAdjacentHTML('beforeend', '<span class="required-indicator">*</span>');
                    break;
                }
                case 'set_optional': {
                    // 当条件满足时（conditionMet为true），将字段设为选填
                    const isRequired = conditionMet ? false : isOriginallyRequired;
                    elements.forEach(el => {
                        el.required = isRequired;
                        // 设置空格验证属性
                        const fieldConfig = this.fields[targetName];
                        if (fieldConfig && fieldConfig.validation_rules) {
                            const allowEnglishSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowEnglishSpace' && r.rule_value === 'True');
                            const allowChineseSpace = fieldConfig.validation_rules.some(r => r.rule_type === 'allowChineseSpace' && r.rule_value === 'True');
                            if (allowEnglishSpace) el.setAttribute('data-allow-english-space', 'true');
                            if (allowChineseSpace) el.setAttribute('data-allow-chinese-space', 'true');
                        }
                    });
                    label?.querySelector('.required-indicator')?.remove();
                    if (isRequired && label) label.insertAdjacentHTML('beforeend', '<span class="required-indicator">*</span>');
                    break;
                }
            }
        });

        // 如果是跨字段比较，则执行比较
        const actionType = action.action || action.type;
        if (actionType === 'validate_comparison' && conditionMet) {
            this._performComparison(action);
        }

        // 如果是筛选选项，则执行筛选
        if (actionType === 'filter_options') {
            const ruleDefinition = rule.definition || rule;
            const triggerValue = this._getFieldValue(ruleDefinition.if.field);
            this._filterOptions(action, triggerValue);
        }
    }

    // 执行跨字段比较校验
     _performComparison(action) {
        const targetEl = this.form.querySelector(`[name="${action.targets[0]}"]`);
        const comparisonEl = this.form.querySelector(`[name="${action.comparison_field}"]`);
        if (!targetEl || !comparisonEl || !targetEl.value || !comparisonEl.value) {
            targetEl?.setCustomValidity('');
            return;
        };

        const comparisonCondition = { field: action.targets[0], operator: action.operator, value: comparisonEl.value };
        const isValid = this._checkCondition(comparisonCondition);

        let message = '';
        if (!isValid) {
            message = action.message || `与'${this.fields[action.comparison_field].label}'的逻辑关系不正确`;
            message = message.replace(/\${(.*?)}/g, (match, fieldName) => this._getFieldValue(fieldName.trim()));
        }
        targetEl.setCustomValidity(message);
        targetEl.reportValidity();
    }

    // 执行下拉框选项筛选
    _filterOptions(action, triggerValue) {
        const targetEl = this.form.querySelector(`[name="${action.targets[0]}"]`);
        if (!targetEl) return;

        const original = this.originalOptions[targetEl.name];
        if (!original) return;

        const currentVal = targetEl.value;
        targetEl.innerHTML = '';
        original.forEach(opt => targetEl.add(new Option(opt.text, opt.value)));

        if (triggerValue === action.filter_value) {
            const filteredOptions = action.options;
            Array.from(targetEl.options).forEach(opt => {
                if (opt.value && !filteredOptions.includes(opt.value)) {
                    opt.remove();
                }
            });
        }

        if (Array.from(targetEl.options).some(opt => opt.value === currentVal)) {
            targetEl.value = currentVal;
        } else {
            targetEl.value = '';
        }
    }
}

// ==============================================================================
// 页面初始化与核心功能
// ==============================================================================

window.onload = function() {
    fetch(`/api/forms-config/${procurementMethod}`)
        .then(response => response.json()).then(data => { masterConfig = data; createSidebarNav(data.sections); });
    loadProcurementMethods();
    loadPreview();
};

function loadPreview() {
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

function loadProcurementMethods() {
    fetch('/api/published-templates').then(r => r.json()).then(methods => {
        const sel = document.getElementById('editProcurementMethod');
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

    // Enable both export buttons
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
            // 使用setTimeout确保条件规则引擎在表单完全渲染后再初始化
            if (config.conditional_rules && config.conditional_rules.length > 0) {
                setTimeout(() => {
                    logicEngine = new ConditionalLogicEngine('sheet-content', config.conditional_rules, config.fields);
                    logicEngine.init();
                    // 初始化后立即执行一次规则评估，确保初始状态正确
                    setTimeout(() => {
                        logicEngine.evaluateAllRules();
                    }, 50);
                }, 100);
            }
        } else if (config.type === 'dynamic_table') {
            renderDynamicTable(contentDiv, config, data);
        }
        startAutoSave();
    });
}

// --- 表单渲染函数 ---
function renderFixedForm(container, config, data) {
    container.innerHTML = '';
    config.fields.forEach(field => {
            const fieldValue = data[field.name];
            const value = (fieldValue === undefined || fieldValue === null || fieldValue === '') ? (field.default_value || '') : fieldValue;
            const rules = (field.validation_rules || []).reduce((acc, rule) => ({ ...acc, [rule.rule_type]: rule.rule_value }), {});
            const isRequired = rules.required === 'True';
            const isDisabled = rules.disabled === 'True';
            const allowEnglishSpace = rules.allowEnglishSpace === 'True';
            const allowChineseSpace = rules.allowChineseSpace === 'True';
            const formGroup = document.createElement('div');
            formGroup.className = 'mb-3';
            let fieldHtml = '';
            const requiredAttr = isRequired ? 'required' : '';
            const disabledAttr = isDisabled ? 'disabled' : '';
            const spaceValidationAttr = (allowEnglishSpace || allowChineseSpace) ? `data-allow-english-space="${allowEnglishSpace}" data-allow-chinese-space="${allowChineseSpace}"` : '';
            const labelHtml = `<label class="form-label">${field.label}${isRequired ? '<span class="required-indicator">*</span>' : ''}</label>`;

        // 为所有字段添加 data-field-name 属性，用于实时预览
        if (field.type === 'textarea') {
            fieldHtml = `${labelHtml}<textarea class="form-control" name="${field.name}" data-field-name="${field.name}" rows="3" ${requiredAttr} ${disabledAttr} ${spaceValidationAttr}>${value}</textarea>`;
        } else if (field.type === 'select') {
             fieldHtml = `${labelHtml}<select class="form-select" name="${field.name}" data-field-name="${field.name}" ${requiredAttr} ${disabledAttr} ${spaceValidationAttr}>`;
            const options = field.options ? field.options.split(',') : [];
            fieldHtml += `<option value="">请选择...</option>`;
            options.forEach(opt => fieldHtml += `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`);
            fieldHtml += `</select>`;
        } else if (field.type === 'radio') {
            fieldHtml = `<div>${labelHtml}</div>`;
            const options = field.options ? field.options.split(',') : [];
            options.forEach((opt, index) => {
                const radioId = `${field.name}-${index}`;
                fieldHtml += `
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="${field.name}" data-field-name="${field.name}" id="${radioId}" value="${opt}" ${value === opt ? 'checked' : ''} ${requiredAttr} ${disabledAttr}>
                        <label class="form-check-label" for="${radioId}">${opt}</label>
                    </div>
                `;
            });
        } else if (field.type === 'checkbox') {
            // 检查是否有选项配置，如果有则渲染为下拉选择框
            if (field.options && field.options.trim()) {
                fieldHtml = `${labelHtml}<select class="form-select" name="${field.name}" data-field-name="${field.name}" ${requiredAttr} ${disabledAttr}>`;
                const options = field.options.split(',');
                fieldHtml += `<option value="">请选择...</option>`;
                options.forEach(opt => {
                    const trimmedOpt = opt.trim();
                    const selectedAttr = value === trimmedOpt ? 'selected' : '';
                    fieldHtml += `<option value="${trimmedOpt}" ${selectedAttr}>${trimmedOpt}</option>`;
                });
                fieldHtml += `</select>`;
            } else {
                // 没有选项配置时渲染为普通复选框
                const checkedAttr = value === 'True' || value === true ? 'checked' : '';
                fieldHtml = `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="${field.name}" data-field-name="${field.name}" id="${field.name}" ${checkedAttr} ${disabledAttr}>
                        <label class="form-check-label" for="${field.name}">${field.label}${isRequired ? '<span class="required-indicator">*</span>' : ''}</label>
                    </div>
                `;
            }
        } else {
             fieldHtml = `${labelHtml}<input type="${field.type || 'text'}" class="form-control" name="${field.name}" data-field-name="${field.name}" value="${value}" ${requiredAttr} ${disabledAttr} ${spaceValidationAttr}>`;
        }
        formGroup.innerHTML = fieldHtml;
        container.appendChild(formGroup);
    });
}

function renderDynamicTable(container, config, data) {
    const isSpecialTable = currentSheetName === '份额分配原则（多种有效参选人数量）';
    const table = document.createElement('table');
    table.className = 'table table-bordered table-responsive'; table.id = 'dynamic-table';
    const thead = document.createElement('thead');
    let headerHtml = '<tr>';
    config.columns.forEach((col, index) => {
        const isRankCol = isSpecialTable && index >= 2 && index <= 51;
        const rankNum = index - 1;
        const isHidden = isRankCol && rankNum > visibleRankCount;
        headerHtml += `<th class="${isRankCol ? 'rank-col' : ''} ${isHidden ? 'hidden' : ''}" data-rank="${rankNum}">${col.label}</th>`;
    });
    headerHtml += '<th>操作</th></tr>';
    thead.innerHTML = headerHtml;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    if (data && data.length > 0) {
        data.forEach(row => addRow(tbody, config, row));
    }
    table.appendChild(tbody);
    container.appendChild(table);
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'mt-2';
    const addButton = document.createElement('button');
    addButton.className = 'btn btn-secondary';
    addButton.textContent = '+ 增加一行';
    addButton.onclick = () => { addRow(tbody, config); triggerChange(); };
    buttonGroup.appendChild(addButton);
    if (isSpecialTable) {
        const showMoreButton = document.createElement('button');
        showMoreButton.className = 'btn btn-info ms-2';
        showMoreButton.textContent = '显示更多 »';
        showMoreButton.id = 'show-more-btn';
        showMoreButton.onclick = () => updateVisibleRanks(5);
        buttonGroup.appendChild(showMoreButton);
        const hideMoreButton = document.createElement('button');
        hideMoreButton.className = 'btn btn-warning ms-2';
        hideMoreButton.textContent = '« 隐藏更多';
        hideMoreButton.id = 'hide-more-btn';
        hideMoreButton.onclick = () => updateVisibleRanks(-5);
        buttonGroup.appendChild(hideMoreButton);
    }
    container.appendChild(buttonGroup);
    updateColumnButtons();
}

// --- 辅助与事件处理函数 ---
function saveData(skipValidation = false) {
    if (!currentSheetName) return;
    const form = document.getElementById('sheet-content');
    // 只有在非自动保存模式下才进行表单验证
    if (!skipValidation && !form.checkValidity()) {
        form.reportValidity();
        Swal.fire('输入错误', '请检查表单中标红的必填项或无效项。', 'warning');
        return;
    }

    // 空格验证
    if (!skipValidation) {
        const inputs = form.querySelectorAll('input[type="text"], input[type="text"], textarea');
        for (let input of inputs) {
            const allowEnglishSpace = input.getAttribute('data-allow-english-space') === 'true';
            const allowChineseSpace = input.getAttribute('data-allow-chinese-space') === 'true';

            if (input.value) {
                // 检查英文空格
                if (!allowEnglishSpace && input.value.includes(' ')) {
                    Swal.fire('输入错误', `${input.name}字段不允许包含英文空格`, 'warning');
                    input.focus();
                    return;
                }

                // 检查中文空格
                if (!allowChineseSpace && input.value.includes('　')) {
                    Swal.fire('输入错误', `${input.name}字段不允许包含中文空格`, 'warning');
                    input.focus();
                    return;
                }
            }
        }
    }
    updateSaveStatus('正在保存...');
    const config = masterConfig.sections[currentSectionName].forms[currentSheetName];
    let payload;
    if (config.type === 'fixed_form') {
        payload = {};
        config.fields.forEach(field => {
            const el = form.querySelector(`[name="${field.name}"]`);
            if (el) {
                if (el.type === 'checkbox') {
                    payload[field.name] = el.checked ? 'True' : 'False';
                } else if (el.type === 'select-one' && field.type === 'checkbox' && field.options && field.options.trim()) {
                    // 处理有选项的复选框字段（渲染为下拉选择框）
                    payload[field.name] = el.value;
                } else if(el.type === 'radio') {
                    const checkedRadio = form.querySelector(`[name="${field.name}"]:checked`);
                    payload[field.name] = checkedRadio ? checkedRadio.value : '';
                } else {
                    payload[field.name] = el.value;
                }
            }
        });
    } else if (config.type === 'dynamic_table') {
        payload = [];
        // 动态表格空格验证
        if (!skipValidation) {
            const rows = document.querySelectorAll('#dynamic-table tbody tr');
            for (let row of rows) {
                const inputs = row.querySelectorAll('input[type="text"], textarea');
                for (let input of inputs) {
                    const allowEnglishSpace = input.getAttribute('data-allow-english-space') === 'true';
                    const allowChineseSpace = input.getAttribute('data-allow-chinese-space') === 'true';

                    if (input.value) {
                        // 检查英文空格
                        if (!allowEnglishSpace && input.value.includes(' ')) {
                            Swal.fire('输入错误', `${input.dataset.name}字段不允许包含英文空格`, 'warning');
                            input.focus();
                            return;
                        }

                        // 检查中文空格
                        if (!allowChineseSpace && input.value.includes('　')) {
                            Swal.fire('输入错误', `${input.dataset.name}字段不允许包含中文空格`, 'warning');
                            input.focus();
                            return;
                        }
                    }
                }
            }
        }

        document.querySelectorAll('#dynamic-table tbody tr').forEach(row => {
            const rowData = {};
            row.querySelectorAll('input, textarea').forEach(input => {
                rowData[input.dataset.name] = input.value;
            });
            payload.push(rowData);
        });
    }
    fetch(`/api/projects/${projectId}/sheets/${currentSheetName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(response => response.json()).then(result => {
        if (result.message) {
            hasChanges = false;
            updateSaveStatus('所有更改已保存');
        } else {
            updateSaveStatus('保存失败！');
            Swal.fire('保存失败', result.error || '未知错误', 'error');
        }
    }).catch(error => {
        updateSaveStatus('保存失败！');
        Swal.fire('保存失败', error.message || '网络错误', 'error');
    });
}
function manualSave() { saveData(false); } // 手动保存时进行验证

function exportWord() {
    const button = document.getElementById('export-word-button');
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> 正在生成...`;
    button.disabled = true;
    // Redirect to the new word export API endpoint
    window.location.href = `/api/projects/${projectId}/export_word`;
    // Reset button state after a delay
    setTimeout(() => { button.innerHTML = `导出为Word`; button.disabled = false; }, 5000);
}

function exportProject() {
    if (!currentSectionName) { Swal.fire('提示', '请先选择一个模块下的表单！', 'info'); return; }
    const button = document.getElementById('export-button');
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> 正在生成...`;
    button.disabled = true;
    window.location.href = `/api/projects/${projectId}/export/${currentSectionName}`;
    setTimeout(() => { button.innerHTML = `导出 ${currentSectionName} excel`; button.disabled = false; }, 5000);
}
function openEditModal() {
    document.getElementById('editProjectName').value = document.getElementById('project-name-display').innerText.replace('编辑','').trim();
    document.getElementById('editProjectNumber').value = document.getElementById('project-number-display').innerText;
    document.getElementById('editProcurementMethod').value = document.getElementById('project-method-display').innerText;
    if (!editModal) { editModal = new bootstrap.Modal(document.getElementById('editProjectModal')); }
    editModal.show();
}
function updateProject() {
    const newName = document.getElementById('editProjectName').value;
    const newNumber = document.getElementById('editProjectNumber').value;
    const newMethod = document.getElementById('editProcurementMethod').value;
    if (!newName.trim()) { Swal.fire('输入错误', '项目名称不能为空！', 'warning'); return; }
    if (!newNumber.trim()) { Swal.fire('输入错误', '项目编号不能为空！', 'warning'); return; }
    fetch(`/api/projects/${projectId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, number: newNumber, procurement_method: newMethod }) })
    .then(response => response.json()).then(data => {
        if (data.message) {
            Swal.fire({ title: '更新成功!', text: '页面将刷新以应用更改。', icon: 'success', timer: 2000, showConfirmButton: false }).then(() => window.location.reload());
        } else { Swal.fire('更新失败', data.error || '未知错误', 'error'); }
    }).catch(error => console.error('更新项目失败:', error));
}
function addRow(tbody, config, rowData = {}) {
    const isSpecialTable = currentSheetName === '份额分配原则（多种有效参选人数量）';
    const row = document.createElement('tr');
    let rowHtml = '';
    const newSeqNum = tbody.rows.length + 1;
    config.columns.forEach((col, index) => {
        let value = rowData[col.name] || '';
        if (Object.keys(rowData).length === 0 && col.name === 'seq_num') { value = newSeqNum; }
        const isRankCol = isSpecialTable && index >= 2 && index <= 51;
        const rankNum = index - 1;
        const isHidden = isRankCol && rankNum > visibleRankCount;
        const tdClass = `${isRankCol ? 'rank-col' : ''} ${isHidden ? 'hidden' : ''}`;
        const readonlyAttr = col.name === 'seq_num' ? 'readonly' : '';
        const rules = (col.validation_rules || []).reduce((acc, rule) => ({ ...acc, [rule.rule_type]: rule.rule_value }), {});
        const allowEnglishSpace = rules.allowEnglishSpace === 'True';
        const allowChineseSpace = rules.allowChineseSpace === 'True';
        const spaceValidationAttr = (allowEnglishSpace || allowChineseSpace) ? `data-allow-english-space="${allowEnglishSpace}" data-allow-chinese-space="${allowChineseSpace}"` : '';
        rowHtml += `<td class="${tdClass}" data-rank="${rankNum}"><input type="${col.type}" class="form-control" data-name="${col.name}" value="${value}" ${readonlyAttr} ${spaceValidationAttr}></td>`;
    });
    rowHtml += `<td><button class="btn btn-danger btn-sm" onclick="deleteRow(this)">删除</button></td>`;
    row.innerHTML = rowHtml;
    tbody.appendChild(row);
}
function deleteRow(btn) {
    btn.closest('tr').remove();
    const tbody = document.querySelector('#dynamic-table tbody');
    if (tbody) {
        tbody.querySelectorAll('tr').forEach((row, index) => {
            const seqInput = row.querySelector('[data-name="seq_num"]');
            if (seqInput) { seqInput.value = index + 1; }
        });
    }
    triggerChange();
}
function updateVisibleRanks(increment) {
    visibleRankCount += increment;
    if (visibleRankCount > 50) visibleRankCount = 50;
    if (visibleRankCount < 5) visibleRankCount = 5;
    document.querySelectorAll('.rank-col').forEach(col => {
        const rankNum = parseInt(col.dataset.rank, 10);
        col.classList.toggle('hidden', rankNum > visibleRankCount);
    });
    updateColumnButtons();
}
function updateColumnButtons() {
    const showMoreBtn = document.getElementById('show-more-btn');
    const hideMoreBtn = document.getElementById('hide-more-btn');
    if (showMoreBtn && hideMoreBtn) {
        showMoreBtn.disabled = visibleRankCount >= 50;
        hideMoreBtn.disabled = visibleRankCount <= 5;
    }
}
function triggerChange() {
    hasChanges = true;
    updateSaveStatus('有未保存的更改...');
}
function startAutoSave() {
    document.getElementById('sheet-content').addEventListener('input', triggerChange);
    initializeLivePreview(); // 在这里启动实时预览的监听
    periodicSaveTimer = setInterval(() => {
        if (hasChanges) {
            saveData(true); // 自动保存时跳过验证
        }
    }, 30000);
}

function initializeLivePreview() {
    const formContainer = document.getElementById('sheet-content');
    formContainer.addEventListener('input', updatePreview);
    formContainer.addEventListener('change', updatePreview);
}

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
            // 如果值为空，恢复原始占位符文本和默认颜色
            span.textContent = `{{${fieldName}}}`;
            span.style.color = ''; // 恢复默认颜色
        }
    });
}
function updateSaveStatus(status) {
    saveStatusEl.textContent = status;
    saveStatusEl.style.opacity = '1';
    if (status === '所有更改已保存') {
        setTimeout(() => { saveStatusEl.style.opacity = '0'; }, 2000);
    }
}
