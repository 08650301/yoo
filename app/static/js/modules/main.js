// app/static/js/modules/main.js

import { initializeSidebar } from './sidebar_handler.js';
import { loadPreview, initializeLivePreview } from './live_preview.js';

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

// ConditionalLogicEngine class and other functions remain the same as in the original project.js
class ConditionalLogicEngine {
    constructor(formId, rules, fields) {
        this.form = document.getElementById(formId);
        this.rules = rules;
        // ... (rest of the class is the same)
    }
    // ... (all methods of the class are the same)
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
    });
}

// Expose the loadForm function to the global scope for Playwright testing
window.loadForm = loadForm;

function renderFixedForm(container, config, data) {
    config.fields.forEach(field => {
        const formGroup = document.createElement('div');
        formGroup.className = 'mb-3';
        formGroup.setAttribute('data-field-name', field.name);

        const label = document.createElement('label');
        label.htmlFor = `field-${field.name}`;
        label.className = 'form-label';
        label.textContent = field.label;

        if (field.validation_rules && field.validation_rules.some(r => r.rule_type === 'required')) {
            const requiredSpan = document.createElement('span');
            requiredSpan.className = 'required-indicator';
            requiredSpan.textContent = '*';
            label.appendChild(requiredSpan);
        }
        formGroup.appendChild(label);

        let inputElement;
        const value = (data && data[field.name]) ? data[field.name] : (field.default_value || '');

        switch (field.type) {
            case 'textarea':
                inputElement = document.createElement('textarea');
                inputElement.className = 'form-control';
                inputElement.rows = 3;
                inputElement.value = value;
                break;
            case 'select':
                inputElement = document.createElement('select');
                inputElement.className = 'form-select';
                const options = field.options ? field.options.split(',') : [];
                // Add a blank option for non-required fields
                if (!field.validation_rules || !field.validation_rules.some(r => r.rule_type === 'required')) {
                    const blankOpt = document.createElement('option');
                    blankOpt.value = '';
                    blankOpt.textContent = '--- 请选择 ---';
                    inputElement.appendChild(blankOpt);
                }
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.trim();
                    option.textContent = opt.trim();
                    if (opt.trim() === value) {
                        option.selected = true;
                    }
                    inputElement.appendChild(option);
                });
                break;
            case 'radio':
                inputElement = document.createElement('div');
                const radioOptions = field.options ? field.options.split(',') : [];
                radioOptions.forEach(opt => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'form-check';
                    const radioInput = document.createElement('input');
                    radioInput.type = 'radio';
                    radioInput.className = 'form-check-input';
                    radioInput.name = field.name;
                    radioInput.value = opt.trim();
                    radioInput.id = `field-${field.name}-${opt.trim().replace(/\s+/g, '-')}`;
                    if (opt.trim() === value) {
                        radioInput.checked = true;
                    }
                    const radioLabel = document.createElement('label');
                    radioLabel.className = 'form-check-label';
                    radioLabel.htmlFor = radioInput.id;
                    radioLabel.textContent = opt.trim();
                    wrapper.appendChild(radioInput);
                    wrapper.appendChild(radioLabel);
                    inputElement.appendChild(wrapper);
                });
                break;
            default: // text, number, date, etc.
                inputElement = document.createElement('input');
                inputElement.type = field.type;
                inputElement.className = 'form-control';
                inputElement.value = value;
                break;
        }

        if (inputElement.tagName !== 'DIV') {
            inputElement.id = `field-${field.name}`;
            inputElement.name = field.name;
        }
        formGroup.appendChild(inputElement);

        const helpTip = document.createElement('div');
        helpTip.className = 'form-text';
        helpTip.textContent = field.help_tip || '';
        formGroup.appendChild(helpTip);

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

// ... (All other helper functions like saveData, manualSave, exportProject, exportWord, etc. remain the same)
