// app/static/js/admin/modules/api_client.js

/**
 * 统一处理 fetch 请求的响应。
 */
function handleApiResponse(response) {
    if (response.ok) {
        return response.json();
    }
    return response.json().then(err => { throw new Error(err.error || '未知服务器错误') });
}

/**
 * 封装的 POST API 请求函数
 */
export function postAPI(url, data, successMessage, noReload = false) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(handleApiResponse)
    .then(result => {
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
        return result;
    })
    .catch(error => {
        Swal.fire('操作失败', error.message, 'error');
        throw error;
    });
}

/**
 * 封装的 PUT API 请求函数
 */
export function putAPI(url, data, successMessage, noReload = false) {
    return fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(handleApiResponse)
    .then(result => {
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
        return result;
    })
    .catch(error => {
        Swal.fire('操作失败', error.message, 'error');
        throw error;
    });
}

/**
 * 封装的 DELETE API 请求函数
 */
export function deleteAPI(url, itemName, noReload = false) {
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
                    Swal.fire('已删除!', data.message, 'success').then(() => {
                        if (!noReload) {
                            window.location.reload();
                        }
                        resolve(data);
                    });
                })
                .catch(error => {
                    Swal.fire('删除失败', error.message, 'error');
                    reject(error);
                });
            } else {
                reject(new Error('删除操作已取消'));
            }
        });
    });
}
