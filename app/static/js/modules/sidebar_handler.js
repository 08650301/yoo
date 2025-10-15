// app/static/js/modules/sidebar_handler.js

export function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    const resizer1 = document.getElementById('resizer-1');
    const toggleButton = document.getElementById('sidebar-toggle');
    const body = document.body;

    // --- Load saved states ---
    const savedWidth = localStorage.getItem('sidebarWidth');
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');

    if (savedCollapsed === 'true') {
        body.classList.add('sidebar-collapsed');
    } else if (savedWidth) {
        sidebar.style.width = savedWidth;
    }

    // --- Resizer Logic ---
    let isResizing = false;
    resizer1.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.userSelect = 'none';
        document.body.style.pointerEvents = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    const onMouseMove = (e) => {
        if (!isResizing) return;
        let newWidth = e.clientX;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > 600) newWidth = 600;
        sidebar.style.width = newWidth + 'px';
    };

    const onMouseUp = () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        localStorage.setItem('sidebarWidth', sidebar.style.width);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    // --- Toggle Logic ---
    toggleButton.addEventListener('click', () => {
        body.classList.toggle('sidebar-collapsed');
        const isCollapsed = body.classList.contains('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);

        if (isCollapsed) {
            sidebar.style.width = '';
        } else {
            const savedWidth = localStorage.getItem('sidebarWidth');
            if (savedWidth) sidebar.style.width = savedWidth;
        }
    });
}
