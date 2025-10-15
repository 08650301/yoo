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

function renderFixedForm(container, config, data) {
    // ... (This function remains exactly the same, with the data-field-name attributes)
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
