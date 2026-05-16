/**
 * Modern Admin Dashboard JavaScript
 * Professional SaaS-style interactions with animations, dark mode, and live updates
 */

// ============================================================================
// CONFIGURATION & STATE
// ============================================================================

const AdminConfig = {
    apiBaseUrl: '../backend/admin',
    liveRefreshInterval: 15000, // 15 seconds
    animationDuration: 300,
    debounceWait: 300,
};

const AdminState = {
    currentSection: 'dashboard',
    isRefreshing: false,
    liveRefreshId: null,
    
    // Pagination
    userPage: 1,
    stationPage: 1,
    reportPage: 1,
    auditPage: 1,
    alertPage: 1,
    
    // Action modals
    userActionData: {},
    stationActionData: {},
    reportActionData: {},
    
    // Caching
    charts: {},
    cache: {
        stats: {},
        liveStationsHash: '',
        previousStats: {},
    },
};

// ============================================================================
// API LAYER
// ============================================================================

const AdminAPI = {
    baseUrl: AdminConfig.apiBaseUrl,

    async request(path, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/${path}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    ...options.headers,
                },
            });
            
            if (response.status === 401 || response.status === 403) {
                localStorage.clear();
                window.location.href = 'login.html';
                return { ok: false, message: 'Authentication required' };
            }
            
            return response.json();
        } catch (error) {
            console.error(`API Error: ${path}`, error);
            return { ok: false, message: 'Network error' };
        }
    },

    getStatistics() {
        return this.request('statistics.php');
    },

    getLiveStats() {
        return this.request('live-stats.php');
    },

    getAnalytics() {
        return this.request('analytics.php');
    },

    globalSearch(query, limit = 5) {
        const params = new URLSearchParams({ q: query, limit });
        return this.request(`search.php?${params}`);
    },

    getUsers(page = 1, limit = 20, search = '', role = '', status = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            ...(role && { role }),
            ...(status && { status }),
        });
        return this.request(`users.php?${params}`);
    },

    userAction(action, userId, reason = '') {
        return this.request('user-actions.php', {
            method: 'POST',
            body: new URLSearchParams({ action, user_id: userId, reason }),
        });
    },

    getStations(page = 1, limit = 20, search = '', status = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            ...(status && { approval_status: status }),
        });
        return this.request(`stations.php?${params}`);
    },

    stationAction(action, stationId, reason = '') {
        return this.request('station-actions.php', {
            method: 'POST',
            body: new URLSearchParams({ action, station_id: stationId, reason }),
        });
    },

    getReports(page = 1, limit = 20, search = '', status = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            ...(status && { status }),
        });
        return this.request(`reports.php?${params}`);
    },

    reportAction(action, reportId, notes = '') {
        return this.request('report-actions.php', {
            method: 'POST',
            body: new URLSearchParams({ action, report_id: reportId, notes }),
        });
    },

    getAuditLogs(page = 1, limit = 20, action = '', user = '') {
        const params = new URLSearchParams({
            page,
            limit,
            ...(action && { action }),
            ...(user && { user }),
        });
        return this.request(`audit-logs.php?${params}`);
    },

    getAlerts(page = 1, limit = 20, acknowledged = '') {
        const params = new URLSearchParams({
            page,
            limit,
            ...(acknowledged !== '' && { acknowledged }),
        });
        return this.request(`alerts.php?${params}`);
    },

    alertAction(action, alertId = null) {
        return this.request('alert-actions.php', {
            method: 'POST',
            body: new URLSearchParams({ action, ...(alertId && { alert_id: alertId }) }),
        });
    },

    exportCSV(type) {
        window.location.href = `${this.baseUrl}/export.php?type=${type}`;
    },
};

// ============================================================================
// UTILITIES & HELPERS
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

function debounce(fn, wait = AdminConfig.debounceWait) {
    let timeoutId = null;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), wait);
    };
}

function formatDate(dateString) {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleString();
}

function formatTimeAgo(dateString) {
    if (!dateString) return '--';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function updateLastUpdated() {
    const el = document.getElementById('lastUpdated');
    if (!el) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent = `Last sync: ${time}`;
}

function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.innerHTML = `<div class="toast-content">${escapeHtml(message)}</div>`;
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background-color: var(--color-accent);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function showAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${escapeHtml(message)}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    const main = document.querySelector('.admin-main');
    const firstSection = main?.querySelector('.content-section');
    if (main && firstSection) {
        main.insertBefore(alert, firstSection);
    }
    setTimeout(() => alert.remove(), 5000);
}

// ============================================================================
// ANIMATED COUNTER
// ============================================================================

function animateCounter(element, targetValue, duration = 600) {
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    if (startValue === targetValue) return;
    
    const startTime = Date.now();
    const diff = targetValue - startValue;
    
    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function: easeOutQuad
        const easing = 1 - (1 - progress) * (1 - progress);
        const currentValue = Math.floor(startValue + diff * easing);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = targetValue;
        }
    }
    
    update();
}

function animateNumberChange(element, newValue, oldValue) {
    if (!element) return;
    
    element.textContent = newValue;
    
    // Flash animation
    element.style.animation = 'none';
    setTimeout(() => {
        element.style.animation = 'numberFlash 0.6s ease-out';
    }, 10);
}

// ============================================================================
// DARK MODE
// ============================================================================

function initTheme() {
    const savedTheme = localStorage.getItem('adminTheme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    localStorage.setItem('adminTheme', theme);
    document.documentElement.setAttribute('data-admin-theme', theme);
    
    const themeToggle = document.getElementById('themToggle');
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-admin-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// ============================================================================
// SIDEBAR TOGGLE
// ============================================================================

function initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.admin-sidebar');
    
    if (!toggle || !sidebar) return;
    
    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        sidebar.classList.toggle('open');
        toggle.setAttribute('aria-expanded', sidebar.classList.contains('open'));
    });
    
    // Close sidebar when menu item is clicked
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            sidebar.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
}

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavigation() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            switchSection(section);
        });
    });
}

function switchSection(section) {
    AdminState.currentSection = section;
    
    // Update menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
    document.querySelector(`[data-section="${section}"]`)?.setAttribute('aria-selected', 'true');
    
    // Show section
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}Section`)?.classList.add('active');
    
    // Load section data
    switch (section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'users':
            loadUsers(AdminState.userPage);
            break;
        case 'stations':
            loadStations(AdminState.stationPage);
            break;
        case 'reports':
            loadReports(AdminState.reportPage);
            break;
        case 'alerts':
            loadAlerts(AdminState.alertPage);
            break;
        case 'audit':
            loadAuditLogs(AdminState.auditPage);
            break;
    }
}

// ============================================================================
// DASHBOARD LOADING
// ============================================================================

async function loadDashboard() {
    try {
        const [stats, analytics, live] = await Promise.all([
            AdminAPI.getStatistics(),
            AdminAPI.getAnalytics(),
            AdminAPI.getLiveStats(),
        ]);
        
        if (!stats.ok) {
            showAlert('Failed to load dashboard statistics', 'danger');
            return;
        }
        
        renderDashboardStats(stats);
        if (analytics.ok) renderAnalytics(analytics.data);
        if (live.ok) renderLiveStats(live.data);
        
        updateLastUpdated();
    } catch (error) {
        console.error('Dashboard loading error:', error);
        showAlert('Error loading dashboard', 'danger');
    }
}

function renderDashboardStats(data) {
    // Hero stats with animations
    const stats = [
        { id: 'statActiveStations', value: data.stations?.total || 0 },
        { id: 'statActiveQueues', value: data.active_queues_count || 0 },
        { id: 'statFuelAlerts', value: data.stations?.rejected || 0 },
        { id: 'statPendingReports', value: data.reports?.pending || 0 },
        { id: 'statActiveUsers', value: data.users?.active || 0 },
        { id: 'statAvgWaitTime', value: Math.round(data.active_queues_count * 2) || 0 },
    ];
    
    stats.forEach(({ id, value }) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== String(value)) {
            animateCounter(el, value);
        }
    });
    
    // Update approval status
    updateElementText('stationPending', data.stations?.pending || 0);
    updateElementText('stationApproved', data.stations?.approved || 0);
    updateElementText('stationRejected', data.stations?.rejected || 0);
    
    // Update fuel availability
    renderFuelAvailability(data.fuel_availability || {});
    
    // Update badges
    updateBadge('stationsBadge', data.stations?.pending || 0);
    updateBadge('reportsBadge', data.reports?.pending || 0);
    updateBadge('alertsBadge', data.alerts?.total_unacknowledged || 0);
    
    // Show critical alerts
    if (data.alerts && data.alerts.total_unacknowledged > 0) {
        renderCriticalAlerts(data.alerts);
    }
    
    AdminState.cache.previousStats = data;
}

function updateElementText(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(value)) {
        el.textContent = value;
    }
}

function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderFuelAvailability(fuelData) {
    const container = document.getElementById('fuelAvailability');
    if (!container) return;
    
    const items = Object.entries(fuelData).map(([fuel, info]) => {
        const percentage = Number(info.availability_percentage || 0);
        const available = Number(info.available_stations || 0);
        const total = Number(info.total_stations || 0);
        
        return `
            <div class="fuel-item">
                <div class="fuel-label">
                    <span>${escapeHtml(fuel)}</span>
                </div>
                <div class="fuel-bar">
                    <div class="fuel-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="fuel-percentage">${percentage}%</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = items || '<div class="fuel-empty"><p>No fuel data available</p></div>';
}

function renderCriticalAlerts(alertsData) {
    const container = document.getElementById('alertsContainer');
    if (!container) return;
    
    const items = Object.entries(alertsData.by_severity || {})
        .filter(([, count]) => Number(count) > 0)
        .map(([severity, count]) => {
            const icons = {
                critical: 'fa-exclamation-triangle',
                high: 'fa-exclamation-circle',
                medium: 'fa-info-circle',
                low: 'fa-check-circle',
            };
            
            return `
                <div class="alert-card ${severity}">
                    <div class="alert-icon">
                        <i class="fas ${icons[severity] || 'fa-bell'}"></i>
                    </div>
                    <div class="alert-content">
                        <h6>${escapeHtml(severity.toUpperCase())} Alert</h6>
                        <p>${Number(count)} alert${Number(count) === 1 ? '' : 's'}</p>
                    </div>
                </div>
            `;
        })
        .join('');
    
    container.innerHTML = items;
    container.style.display = items ? 'grid' : 'none';
}

function renderAnalytics(data) {
    renderQueueTrendChart(data.queue_trends || []);
    renderFuelChart(data.fuel_availability || []);
    renderUserChart(data.active_users || []);
    renderPeakHoursChart(data.peak_queue_hours || []);
    renderReportChart(data.reports_overview || []);
}

function renderLiveStats(data) {
    if (!data) return;
    
    updateBadge('stationsBadge', data.badges?.pending_stations || 0);
    updateBadge('reportsBadge', data.badges?.pending_reports || 0);
    updateBadge('alertsBadge', data.badges?.open_alerts || 0);
    
    updateLastUpdated();
    renderLiveStations(data.active_stations || []);
}

function renderLiveStations(stations) {
    const container = document.getElementById('liveStationsList');
    const countEl = document.getElementById('liveStationCount');
    
    if (!container) return;
    
    if (countEl) {
        countEl.textContent = `${stations.length} station${stations.length !== 1 ? 's' : ''}`;
    }
    
    if (stations.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No active stations</p></div>';
        return;
    }
    
    const html = stations.map(station => {
        const petrol = Boolean(station.fuel_availability?.petrol);
        const diesel = Boolean(station.fuel_availability?.diesel);
        
        return `
            <div class="live-station-card">
                <div class="station-name">${escapeHtml(station.station_name)}</div>
                <div class="station-location">${escapeHtml(station.location || 'No location')}</div>
                <div class="station-stats">
                    <span class="station-badge badge-info">${escapeHtml(station.status)}</span>
                    <span class="station-badge badge-warning">${Number(station.queue_length || 0)} queued</span>
                    <span class="station-badge badge-success">${Number(station.waiting_time || 0)}m wait</span>
                    ${petrol ? '<span class="station-badge badge-info">Petrol</span>' : ''}
                    ${diesel ? '<span class="station-badge badge-info">Diesel</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// ============================================================================
// CHART RENDERING
// ============================================================================

function updateChart(chartKey, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (!AdminState.charts[chartKey]) {
        AdminState.charts[chartKey] = new Chart(ctx, config);
    } else {
        const chart = AdminState.charts[chartKey];
        chart.data.labels = config.data.labels;
        chart.data.datasets = config.data.datasets;
        chart.options = { ...chart.options, ...config.options };
        chart.update('none');
    }
}

function renderQueueTrendChart(rows) {
    updateChart('queueTrend', 'queueTrendChart', {
        type: 'line',
        data: {
            labels: rows.map(r => r.label || 'N/A'),
            datasets: [
                {
                    label: 'Avg queue',
                    data: rows.map(r => Number(r.avg_queue || 0)),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                },
                {
                    label: 'Avg wait',
                    data: rows.map(r => Number(r.avg_wait || 0)),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' },
            },
            scales: {
                y: { beginAtZero: true },
            },
        },
    });
}

function renderFuelChart(rows) {
    updateChart('fuel', 'fuelChart', {
        type: 'bar',
        data: {
            labels: rows.map(r => r.fuel || 'N/A'),
            datasets: [
                {
                    label: 'Available',
                    data: rows.map(r => Number(r.available_stations || 0)),
                    backgroundColor: '#10b981',
                },
                {
                    label: 'Unavailable',
                    data: rows.map(r => Number(r.unavailable_stations || 0)),
                    backgroundColor: '#ef4444',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true } },
        },
    });
}

function renderUserChart(rows) {
    const roleMap = { customer: 0, owner: 0, admin: 0 };
    rows.forEach(r => {
        if (roleMap.hasOwnProperty(r.role)) {
            roleMap[r.role] = Number(r.count || 0);
        }
    });
    
    updateChart('users', 'userChart', {
        type: 'doughnut',
        data: {
            labels: ['Customers', 'Owners', 'Admins'],
            datasets: [{
                data: [roleMap.customer, roleMap.owner, roleMap.admin],
                backgroundColor: ['#3b82f6', '#10b981', '#6c757d'],
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } },
        },
    });
}

function renderPeakHoursChart(rows) {
    updateChart('peakHours', 'peakHoursChart', {
        type: 'bar',
        data: {
            labels: rows.map(r => `${String(r.hour || 0).padStart(2, '0')}:00`),
            datasets: [{
                label: 'Avg queue',
                data: rows.map(r => Number(r.avg_queue || 0)),
                backgroundColor: '#f59e0b',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
        },
    });
}

function renderReportChart(rows) {
    const statusMap = { pending: 0, reviewed: 0, resolved: 0, spam: 0 };
    rows.forEach(r => {
        if (statusMap.hasOwnProperty(r.status)) {
            statusMap[r.status] = Number(r.count || 0);
        }
    });
    
    updateChart('reports', 'reportChart', {
        type: 'bar',
        data: {
            labels: ['Pending', 'Reviewed', 'Resolved', 'Spam'],
            datasets: [{
                label: 'Reports',
                data: [statusMap.pending, statusMap.reviewed, statusMap.resolved, statusMap.spam],
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#6c757d'],
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } },
        },
    });
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

function initQuickActions() {
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            handleQuickAction(action);
        });
    });
}

function handleQuickAction(action) {
    switch (action) {
        case 'approve-stations':
            switchSection('stations');
            document.getElementById('stationStatusFilter').value = 'pending';
            loadStations(1);
            break;
        case 'review-reports':
            switchSection('reports');
            document.getElementById('reportStatusFilter').value = 'pending';
            loadReports(1);
            break;
        case 'view-alerts':
            switchSection('alerts');
            loadAlerts(1);
            break;
        case 'export-data':
            showToast('Starting export...');
            AdminAPI.exportCSV('users');
            break;
    }
}

// ============================================================================
// USERS MANAGEMENT
// ============================================================================

async function loadUsers(page = 1) {
    try {
        const search = document.getElementById('userSearch')?.value || '';
        const role = document.getElementById('userRoleFilter')?.value || '';
        const status = document.getElementById('userStatusFilter')?.value || '';
        
        const result = await AdminAPI.getUsers(page, 20, search, role, status);
        
        if (!result.ok) {
            showAlert('Failed to load users', 'danger');
            return;
        }
        
        AdminState.userPage = page;
        // Backend returns 'users' not 'rows' and 'pagination' object
        const users = result.users || [];
        const pagination = result.pagination || {};
        renderUsersTable(users);
        renderPagination('usersPagination', page, pagination.total_pages || 1, loadUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users', 'danger');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (!users.length) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="6">No users found</td></tr>';
        return;
    }
    
    const html = users.map(user => `
        <tr>
            <td><strong>${escapeHtml(user.name)}</strong></td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="badge badge-info">${escapeHtml(user.role)}</span></td>
            <td>
                <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                    ${user.is_active ? 'Active' : 'Suspended'}
                </span>
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                ${user.is_active ? `
                    <button class="btn-action btn-sm" onclick="showUserActionModal('suspend', ${user.user_id})">
                        Suspend
                    </button>
                ` : `
                    <button class="btn-action btn-sm" style="background-color: var(--success-color, #10b981); color: white; border: none;" onclick="showUserActionModal('activate', ${user.user_id})">
                        Re-activate
                    </button>
                `}
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// ============================================================================
// STATIONS MANAGEMENT
// ============================================================================

async function loadStations(page = 1) {
    try {
        const search = document.getElementById('stationSearch')?.value || '';
        const status = document.getElementById('stationStatusFilter')?.value || '';
        
        const result = await AdminAPI.getStations(page, 20, search, status);
        
        if (!result.ok) {
            showAlert('Failed to load stations', 'danger');
            return;
        }
        
        AdminState.stationPage = page;
        // Backend returns 'stations' not 'rows' and 'pagination' object
        const stations = result.stations || [];
        const pagination = result.pagination || {};
        renderStationsTable(stations);
        renderPagination('stationsPagination', page, pagination.total_pages || 1, loadStations);
    } catch (error) {
        console.error('Error loading stations:', error);
        showAlert('Error loading stations', 'danger');
    }
}

function renderStationsTable(stations) {
    const tbody = document.getElementById('stationsTableBody');
    if (!tbody) return;
    
    if (!stations.length) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="7">No stations found</td></tr>';
        return;
    }
    
    const html = stations.map(station => `
        <tr>
            <td><strong>${escapeHtml(station.station_name)}</strong></td>
            <td>${escapeHtml(station.owner_name || 'N/A')}</td>
            <td>${escapeHtml(station.location || 'N/A')}</td>
            <td><span class="badge badge-${station.approval_status === 'approved' ? 'success' : (station.approval_status === 'pending' ? 'warning' : 'danger')}">${escapeHtml(station.approval_status)}</span></td>
            <td>${Number(station.queue_length || 0)}</td>
            <td>${escapeHtml(station.fuel_types || 'N/A')}</td>
            <td>
                ${station.approval_status === 'pending' ? `
                    <button class="btn-action btn-sm" style="background-color: var(--success-color, #10b981); color: white; border: none; margin-bottom: 4px;" onclick="showStationActionModal('approve', ${station.station_id})">Approve</button>
                    <button class="btn-action btn-sm" style="background-color: var(--danger-color, #ef4444); color: white; border: none;" onclick="showStationActionModal('reject', ${station.station_id})">Reject</button>
                ` : station.approval_status === 'rejected' ? `
                    <button class="btn-action btn-sm" style="background-color: var(--success-color, #10b981); color: white; border: none;" onclick="showStationActionModal('approve', ${station.station_id})">Re-approve</button>
                ` : `
                    <button class="btn-action btn-sm" style="background-color: var(--danger-color, #ef4444); color: white; border: none;" onclick="showStationActionModal('reject', ${station.station_id})">Reject</button>
                `}
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// ============================================================================
// REPORTS MANAGEMENT
// ============================================================================

async function loadReports(page = 1) {
    try {
        const search = document.getElementById('reportSearch')?.value || '';
        const status = document.getElementById('reportStatusFilter')?.value || '';
        
        const result = await AdminAPI.getReports(page, 20, search, status);
        
        if (!result.ok) {
            showAlert('Failed to load reports', 'danger');
            return;
        }
        
        AdminState.reportPage = page;
        // Backend returns 'reports' not 'rows' and 'pagination' object
        const reports = result.reports || [];
        const pagination = result.pagination || {};
        renderReportsTable(reports);
        renderPagination('reportsPagination', page, pagination.total_pages || 1, loadReports);
    } catch (error) {
        console.error('Error loading reports:', error);
        showAlert('Error loading reports', 'danger');
    }
}

function renderReportsTable(reports) {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;
    
    if (!reports.length) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="6">No reports found</td></tr>';
        return;
    }
    
    const html = reports.map(report => `
        <tr>
            <td>${escapeHtml(report.reporter_name || 'Anonymous')}</td>
            <td>${escapeHtml(report.station_name || 'N/A')}</td>
            <td>${escapeHtml(report.comment?.substring(0, 50)) || 'N/A'}...</td>
            <td><span class="badge badge-${report.report_status === 'resolved' ? 'success' : 'warning'}">${escapeHtml(report.report_status)}</span></td>
            <td>${formatDate(report.created_at)}</td>
            <td>
                <button class="btn-action btn-sm" onclick="showReportActionModal(${report.report_id})">Review</button>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// ============================================================================
// ALERTS MANAGEMENT
// ============================================================================

async function loadAlerts(page = 1) {
    try {
        const result = await AdminAPI.getAlerts(page, 20, '');
        
        if (!result.ok) {
            showAlert('Failed to load alerts', 'danger');
            return;
        }
        
        AdminState.alertPage = page;
        // Backend returns 'alerts' not 'rows' and 'pagination' object
        const alerts = result.alerts || [];
        const pagination = result.pagination || {};
        renderAlertsTable(alerts);
        renderPagination('alertsPagination', page, pagination.total_pages || 1, loadAlerts);
    } catch (error) {
        console.error('Error loading alerts:', error);
        showAlert('Error loading alerts', 'danger');
    }
}

function renderAlertsTable(alerts) {
    const tbody = document.getElementById('alertsTableBody');
    if (!tbody) return;
    
    if (!alerts.length) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="6">No alerts found</td></tr>';
        return;
    }
    
    const html = alerts.map(alert => `
        <tr>
            <td><span class="badge badge-${alert.severity === 'critical' ? 'danger' : 'warning'}">${escapeHtml(alert.severity)}</span></td>
            <td><strong>${escapeHtml(alert.title)}</strong></td>
            <td>${escapeHtml(alert.message?.substring(0, 50)) || 'N/A'}...</td>
            <td>${formatDate(alert.created_at)}</td>
            <td><span class="badge ${alert.is_acknowledged ? 'badge-success' : 'badge-warning'}">${alert.is_acknowledged ? 'Acknowledged' : 'Open'}</span></td>
            <td>
                ${!alert.is_acknowledged ? `
                    <button class="btn-action btn-sm" onclick="acknowledgeAlert(${alert.alert_id})">Acknowledge</button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

async function loadAuditLogs(page = 1) {
    try {
        const result = await AdminAPI.getAuditLogs(page, 20, '', '');
        
        if (!result.ok) {
            showAlert('Failed to load audit logs', 'danger');
            return;
        }
        
        AdminState.auditPage = page;
        // Backend returns 'logs' not 'rows' and 'pagination' object
        const logs = result.logs || [];
        const pagination = result.pagination || {};
        renderAuditTable(logs);
        renderPagination('auditPagination', page, pagination.total_pages || 1, loadAuditLogs);
    } catch (error) {
        console.error('Error loading audit logs:', error);
        showAlert('Error loading audit logs', 'danger');
    }
}

function renderAuditTable(logs) {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;
    
    if (!logs.length) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="6">No audit logs found</td></tr>';
        return;
    }
    
    const html = logs.map(log => `
        <tr>
            <td>${escapeHtml(log.admin_name || 'System')}</td>
            <td>${escapeHtml(log.action_type)}</td>
            <td>${escapeHtml(log.entity_type)}</td>
            <td>${escapeHtml(log.description?.substring(0, 40)) || 'N/A'}...</td>
            <td>${escapeHtml(log.ip_address || 'N/A')}</td>
            <td>${formatDate(log.created_at)}</td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// ============================================================================
// PAGINATION
// ============================================================================

function renderPagination(containerId, currentPage, totalPages, loadFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '';
    
    if (currentPage > 1) {
        html += `<button class="pagination-btn" onclick="${loadFn.name}(${currentPage - 1})">← Previous</button>`;
    }
    
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        if (i === currentPage) {
            html += `<button class="pagination-btn active">${i}</button>`;
        } else {
            html += `<button class="pagination-btn" onclick="${loadFn.name}(${i})">${i}</button>`;
        }
    }
    
    if (currentPage < totalPages) {
        html += `<button class="pagination-btn" onclick="${loadFn.name}(${currentPage + 1})">Next →</button>`;
    }
    
    container.innerHTML = html || '<p class="text-muted">No pages</p>';
}

// ============================================================================
// MODAL ACTIONS
// ============================================================================

function showUserActionModal(action, userId) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('userActionModal'));
    const titleEl = document.getElementById('userActionTitle');
    const msgEl = document.getElementById('userActionMessage');
    const reasonEl = document.getElementById('userActionReason');
    
    titleEl.textContent = action === 'suspend' ? 'Suspend User' : 'Activate User';
    msgEl.textContent = `Are you sure you want to ${action} this user?`;
    if (reasonEl) reasonEl.value = '';
    
    if (reasonEl) {
        reasonEl.style.display = action === 'suspend' ? 'block' : 'none';
    }
    
    AdminState.userActionData = { action, userId };
    
    const confirmBtn = document.getElementById('confirmUserActionBtn');
    if (action === 'activate') {
        confirmBtn.className = 'btn btn-success';
        confirmBtn.textContent = 'Re-activate';
    } else {
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Suspend';
    }
    
    document.getElementById('confirmUserActionBtn').onclick = async () => {
        const reason = reasonEl ? reasonEl.value.trim() : '';
        if (action === 'suspend' && !reason) {
            alert('Please provide a reason for suspension.');
            return;
        }

        const result = await AdminAPI.userAction(action, userId, reason);
        
        if (result.ok) {
            showToast(`User ${action}ed successfully`);
            modal.hide();
            loadUsers(AdminState.userPage);
        } else {
            alert(result.message || `Failed to ${action} user`);
        }
    };
    
    modal.show();
}

function showStationActionModal(action, stationId) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('stationActionModal'));
    const titleEl = document.getElementById('stationActionTitle');
    const msgEl = document.getElementById('stationActionMessage');
    const reasonEl = document.getElementById('stationActionReason');
    
    titleEl.textContent = action === 'approve' ? 'Approve Station' : 'Reject Station';
    msgEl.textContent = `Are you sure you want to ${action} this station?`;
    if (reasonEl) reasonEl.value = '';
    
    if (reasonEl) {
        reasonEl.style.display = action === 'reject' ? 'block' : 'none';
    }
    
    AdminState.stationActionData = { action, stationId };
    
    const confirmBtn = document.getElementById('confirmStationActionBtn');
    if (action === 'approve') {
        confirmBtn.className = 'btn btn-success';
        confirmBtn.textContent = AdminState.stationActionData.action === 'approve' ? 'Approve' : 'Re-approve';
    } else {
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Reject';
    }

    document.getElementById('confirmStationActionBtn').onclick = async () => {
        const reason = reasonEl ? reasonEl.value.trim() : '';
        if (action === 'reject' && !reason) {
            alert('Please provide a reason for rejection.');
            return;
        }

        const result = await AdminAPI.stationAction(action, stationId, reason);
        
        if (result.ok) {
            showToast(`Station ${action}ed successfully`);
            modal.hide();
            loadStations(AdminState.stationPage);
        } else {
            alert(result.message || `Failed to ${action} station`);
        }
    };
    
    modal.show();
}

function showReportActionModal(reportId) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('reportActionModal'));
    AdminState.reportActionData = { reportId };
    const notesEl = document.getElementById('reportAdminNotes');
    if (notesEl) notesEl.value = '';
    
    document.getElementById('reportSpamBtn').onclick = async () => {
        const result = await AdminAPI.reportAction('spam', reportId);
        if (result.ok) {
            showToast('Report marked as spam');
            modal.hide();
            loadReports(AdminState.reportPage);
        } else {
            alert(result.message || 'Failed to mark report as spam');
        }
    };
    
    document.getElementById('reportResolveBtn').onclick = async () => {
        const notes = notesEl ? notesEl.value.trim() : '';
        const result = await AdminAPI.reportAction('resolve', reportId, notes);
        if (result.ok) {
            showToast('Report resolved');
            modal.hide();
            loadReports(AdminState.reportPage);
        } else {
            alert(result.message || 'Failed to resolve report');
        }
    };
    
    modal.show();
}

async function acknowledgeAlert(alertId) {
    const result = await AdminAPI.alertAction('acknowledge', alertId);
    if (result.ok) {
        showToast('Alert acknowledged');
        loadAlerts(AdminState.alertPage);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    
    // Setup event listeners
    document.getElementById('themToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
    
    // Setup sidebar
    initSidebar();
    
    // Setup navigation
    initNavigation();
    
    // Setup quick actions
    initQuickActions();
    
    // Setup dashboard refresh button
    document.getElementById('dashboardRefreshBtn')?.addEventListener('click', loadDashboard);
    
    // Setup filter handlers with debounce
    const updateFilters = debounce(() => {
        if (AdminState.currentSection === 'users') loadUsers(1);
        if (AdminState.currentSection === 'stations') loadStations(1);
        if (AdminState.currentSection === 'reports') loadReports(1);
    });
    
    document.getElementById('userSearch')?.addEventListener('input', updateFilters);
    document.getElementById('userRoleFilter')?.addEventListener('change', updateFilters);
    document.getElementById('userStatusFilter')?.addEventListener('change', updateFilters);
    document.getElementById('stationSearch')?.addEventListener('input', updateFilters);
    document.getElementById('stationStatusFilter')?.addEventListener('change', updateFilters);
    document.getElementById('reportSearch')?.addEventListener('input', updateFilters);
    document.getElementById('reportStatusFilter')?.addEventListener('change', updateFilters);
    
    // Setup refresh buttons
    document.getElementById('userRefreshBtn')?.addEventListener('click', () => loadUsers(1));
    document.getElementById('stationRefreshBtn')?.addEventListener('click', () => loadStations(1));
    document.getElementById('reportRefreshBtn')?.addEventListener('click', () => loadReports(1));
    document.getElementById('alertRefreshBtn')?.addEventListener('click', () => loadAlerts(1));
    document.getElementById('auditRefreshBtn')?.addEventListener('click', () => loadAuditLogs(1));
    document.getElementById('acknowledgeAllBtn')?.addEventListener('click', () => AdminAPI.alertAction('acknowledge_all'));
    document.getElementById('exportUsersBtn')?.addEventListener('click', () => AdminAPI.exportCSV('users'));
    
    // Load admin name
    const adminName = localStorage.getItem('userName') || 'Admin';
    const adminNameEl = document.getElementById('adminName');
    if (adminNameEl) adminNameEl.textContent = adminName;
    
    // Load dashboard on startup
    switchSection('dashboard');
    
    // Setup live refresh interval
    AdminState.liveRefreshId = setInterval(() => {
        if (AdminState.currentSection === 'dashboard') {
            runLiveRefresh();
        }
    }, AdminConfig.liveRefreshInterval);
});

// Live refresh function
async function runLiveRefresh() {
    if (AdminState.isRefreshing) return;
    AdminState.isRefreshing = true;
    
    try {
        const live = await AdminAPI.getLiveStats();
        if (live.ok) {
            renderLiveStats(live.data);
        }
    } catch (error) {
        console.error('Live refresh error:', error);
    } finally {
        AdminState.isRefreshing = false;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (AdminState.liveRefreshId) {
        clearInterval(AdminState.liveRefreshId);
    }
});
