// static/js/admin_api.js

/**
 * 统一处理 fetch 请求的响应。
 * @param {Response} response - fetch 调用返回的响应对象。
 * @returns {Promise<any>} - 解析后的 JSON 数据，如果失败则 reject 一个包含详细错误信息的 Error。
 */
function handleApiResponse(response) {
    if (response.ok) {
        return response.json();
    }

    // 如果响应状态码不是 2xx，则尝试解析错误信息。
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        // 如果后端返回了 JSON 格式的错误，则提取其中的 error 字段。
        return response.json().then(err => { throw new Error(err.error || '未知服务器错误') });
    } else {
        // 如果后端返回的是 HTML 错误页面（例如 500 内部服务器错误），则构造一个更可读的错误信息。
        return response.text().then(text => {
            const match = text.match(/<title>(.*?)<\/title>/);
            const extractedTitle = match ? match[1] : '服务器错误';
            throw new Error(`服务器错误: ${response.status} ${response.statusText} (${extractedTitle})`);
        });
    }
}

/**
 * 封装的 POST API 请求函数
 * @param {string} url - 请求的URL
 * @param {object} data - 发送的JSON数据
 * @param {string} successMessage - 成功后显示的提示信息
 * @param {boolean} noReload - 如果为 true，则成功后不刷新页面
 * @returns {Promise}
 */
function postAPI(url, data, successMessage, noReload = false) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(handleApiResponse)
    .then(result => {
        if (result.message) {
            Swal.fire({
                title: '操作成功!',
                text: successMessage || result.message,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                if (!noReload) {
                    window.location.reload();
                }
            });
        }
        return result;
    })
    .catch(error => {
        Swal.fire('操作失败', error.message, 'error');
        console.error('操作失败:', error);
        throw error;
    });
}

/**
 * 封装的 PUT API 请求函数
 * @param {string} url - 请求的URL
 * @param {object} data - 发送的JSON数据
 * @param {string} successMessage - 成功后显示的提示信息
 * @param {boolean} noReload - 如果为 true，则成功后不刷新页面
 * @returns {Promise}
 */
function putAPI(url, data, successMessage, noReload = false) {
    return fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(handleApiResponse)
    .then(result => {
        if (result.message) {
            Swal.fire({
                title: '更新成功!',
                text: successMessage || result.message,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                if (!noReload) {
                    window.location.reload();
                }
            });
        }
        return result;
    })
    .catch(error => {
        Swal.fire('操作失败', error.message, 'error');
        console.error('操作失败:', error);
        throw error;
    });
}

/**
 * 封装的 DELETE API 请求函数
 * @param {string} url - 请求的URL
 * @param {string} itemName - 要删除的项目的名称，用于确认提示
 * @param {boolean} noReload - 如果为 true，则成功后不刷新页面
 * @returns {Promise}
 */
function deleteAPI(url, itemName, noReload = false) {
    return new Promise((resolve, reject) => {
        Swal.fire({
            title: `您确定要永久删除 "${itemName}" 吗？`,
            text: "此操作无法撤销！",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '是的，删除它！',
            cancelButtonText: '取消'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch(url, { method: 'DELETE' })
                .then(handleApiResponse)
                .then(data => {
                    if (data.message) {
                        Swal.fire(
                            '已删除!',
                            data.message,
                            'success'
                        ).then(() => {
                            if (!noReload) {
                                window.location.reload();
                            }
                            resolve(data);
                        });
                    }
                })
                .catch(error => {
                    Swal.fire('删除失败', error.message, 'error');
                    console.error('删除失败:', error);
                    reject(error);
                });
            } else {
                // 用户点击了取消，静默地 reject Promise
                reject('删除操作已取消');
            }
        });
    });
}
