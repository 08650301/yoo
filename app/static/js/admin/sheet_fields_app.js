// app/static/js/admin/sheet_fields_app.js

import { renderFieldsTable } from './modules/field_renderer.js';
import { initializeModalHandler, openFieldModal } from './modules/modal_handler.js';
import { initializeFieldApi, saveField, deleteField } from './modules/field_api.js';
import { postAPI } from './modules/api_client.js';

document.addEventListener("DOMContentLoaded", function() {
    // 1. 从DOM读取初始配置
    const config = {
        sheetId: document.body.dataset.sheetId,
        isReadonly: document.body.dataset.readonly === 'true',
        isColumnMode: document.body.dataset.isColumnMode === 'true',
        titleText: document.body.dataset.isColumnMode === 'true' ? '列' : '字段',
        allFields: [],
        currentFieldName: ''
    };

    try {
        config.allFields = JSON.parse(document.body.dataset.fields || '[]');
    } catch (e) {
        console.error('JSON解析错误:', e);
    }

    const fieldModeTypes = { text: '单行文本', textarea: '多行文本', number: '数字', date: '日期', select: '下拉单选', radio: '单选按钮', 'checkbox-group': '多选按钮', 'select-multiple': '下拉多选' };
    const columnModeTypes = { text: '单行文本', textarea: '多行文本', number: '数字', date: '日期' };
    config.fieldTypeMap = config.isColumnMode ? columnModeTypes : fieldModeTypes;
    config.FIELD_TYPES_REQUIRING_OPTIONS = ['select', 'select-multiple', 'radio', 'checkbox-group'];

    // 2. 初始化所有模块
    initializeModalHandler({ ...config, saveFieldCallback: saveField });
    initializeFieldApi(config);

    // 3. 初始渲染和设置
    const fieldsTbody = document.getElementById('fields-tbody');
    renderFieldsTable(fieldsTbody, config.allFields, config.fieldTypeMap, config.isReadonly, config.titleText);

    if (!config.isReadonly) {
        initializeSortable(fieldsTbody, config.sheetId, config.titleText);
    }

    // 4. 设置全局事件监听
    // 使用事件委托来处理动态添加的按钮
    document.body.addEventListener('click', function(event) {
        if (event.target.matches('.btn-edit-field')) {
            const fieldData = JSON.parse(event.target.dataset.field);
            openFieldModal(fieldData);
        }
        if (event.target.matches('.btn-delete-field')) {
            const fieldId = event.target.dataset.id;
            const fieldLabel = event.target.dataset.label;
            deleteField(fieldId, fieldLabel);
        }
        if (event.target.matches('#add-field-btn')) {
             openFieldModal();
        }
    });
});


/**
 * 初始化拖拽排序功能。
 */
function initializeSortable(tbody, sheetId, titleText) {
    new Sortable(tbody, {
        handle: '.handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            const order = Array.from(tbody.querySelectorAll('tr')).map(row => row.dataset.id);
            postAPI(`/admin/api/sheets/${sheetId}/fields/reorder`, { order: order }, `${titleText}顺序已更新`, true)
                .catch(() => Swal.fire('错误', `网络错误，${titleText}顺序更新失败！`, 'error'));
        },
    });
}
