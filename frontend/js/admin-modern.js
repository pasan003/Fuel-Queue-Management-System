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
    },exportCSV(type) {
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
// DETAIL PANEL (OFFCANVAS) - CARD INTERACTIONS
// ============================================================================

/** Current detail panel state */
const DetailPanel = {
    offcanvas: null,
    currentType: null, // 'stations' | 'users' | 'reports' | 'alerts' | 'queues' | 'wait-time'
    currentData: null,
    refreshHandler: null,
};

/** Map stat card IDs to detail panel types */
const CARD_TO_DETAIL_TYPE = {
    'stat-active-stations': 'stations',
    'stat-active-queues': 'queues',
    'stat-fuel-alerts': 'alerts',
    'stat-pending-reports': 'reports',
    'stat-active-users': 'users',
    'stat-avg-wait-time': 'wait-time',
};

/** Card display metadata */
const CARD_META = {
    stations: {
        title: 'Active Stations',
        subtitle: 'Complete list of active fuel stations with status and queue info',
        icon: 'fa-gas-pump',
    },
    users: {
        title: 'Active Users',
        subtitle: 'All registered users with roles, status and activity info',
        icon: 'fa-users',
    },
    reports: {
        title: 'Pending Reports',
        subtitle: 'User-submitted reports awaiting review and moderation',
        icon: 'fa-file-alt',
    },
    alerts: {
        title: 'System Alerts',
        subtitle: 'Critical, warning and informational system notifications',
        icon: 'fa-bell',
    },
    queues: {
        title: 'Queue Statistics',
        subtitle: 'Real-time queue lengths, busiest stations and trends',
        icon: 'fa-traffic-light',
    },
    'wait-time': {
        title: 'Average Wait Time',
        subtitle: 'Waiting time breakdown by station with live updates',
        icon: 'fa-hourglass-half',
    },
};

/**
 * Initialize the offcanvas panel.
 */
function initDetailPanel() {
    const offcanvasEl = document.getElementById('detailPanel');
    if (!offcanvasEl) return;
    
    DetailPanel.offcanvas = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl, {
        backdrop: true,
        scroll: true,
    });
    
    // Refresh button
    document.getElementById('detailPanelRefresh')?.addEventListener('click', () => {
        if (DetailPanel.refreshHandler) {
            DetailPanel.refreshHandler();
        }
    });
    
    // Error retry button
    document.getElementById('detailErrorRetry')?.addEventListener('click', () => {
        if (DetailPanel.refreshHandler) {
            DetailPanel.refreshHandler();
        }
    });
}

/**
 * Make all stat cards clickable.
 */
function initStatCardClicks() {
    document.querySelectorAll('.stat-card').forEach(card => {
        const statType = CARD_TO_DETAIL_TYPE[card.id];
        if (!statType) return;
        
        card.classList.add('clickable');
        card.style.cursor = 'pointer';
        
        card.addEventListener('click', (e) => {
            // Don't open if clicking the menu button
            if (e.target.closest('.stat-menu')) return;
            openDetailPanel(statType);
        });
    });
}

/**
 * Open the detail panel for a specific card type.
 */
function openDetailPanel(type) {
    if (!DetailPanel.offcanvas) return;
    
    const meta = CARD_META[type];
    if (!meta) return;
    
    DetailPanel.currentType = type;
    
    // Set header
    document.getElementById('detailPanelTitle').innerHTML = `<i class="fas ${meta.icon} me-2"></i>${escapeHtml(meta.title)}`;
    document.getElementById('detailPanelSubtitle').textContent = meta.subtitle;
    
    // Show loading state first
    showDetailState('loading');
    
    // Set up refresh handler
    DetailPanel.refreshHandler = () => loadDetailPanelData(type);
    
    // Show the offcanvas
    DetailPanel.offcanvas.show();
    
    // Load data
    loadDetailPanelData(type);
}

/**
 * Show a specific state in the detail panel.
 */
function showDetailState(state, message = '') {
    document.getElementById('detailLoading').style.display = state === 'loading' ? 'flex' : 'none';
    document.getElementById('detailError').style.display = state === 'error' ? 'flex' : 'none';
    document.getElementById('detailEmpty').style.display = state === 'empty' ? 'flex' : 'none';
    document.getElementById('detailContent').style.display = state === 'content' ? 'block' : 'none';
    
    if (state === 'error' && message) {
        document.getElementById('detailErrorMessage').textContent = message;
    }
    if (state === 'empty' && message) {
        document.getElementById('detailEmptyMessage').textContent = message;
    }
}

/**
 * Load data for the detail panel based on type.
 */
async function loadDetailPanelData(type) {
    showDetailState('loading');
    
    try {
        switch (type) {
            case 'stations':
                await loadStationsDetail();
                break;
            case 'users':
                await loadUsersDetail();
                break;
            case 'reports':
                await loadReportsDetail();
                break;
            case 'alerts':
                await loadAlertsDetail();
                break;
            case 'queues':
                await loadQueuesDetail();
                break;
            case 'wait-time':
                await loadWaitTimeDetail();
                break;
            default:
                showDetailState('empty', 'No data available for this section');
        }
    } catch (error) {
        console.error('Detail panel error:', error);
        showDetailState('error', 'Failed to load data. Please try again.');
    }
}

// ============================================================================
// DETAIL PANEL: STATIONS — Professional Management Table
// ============================================================================

/** Station sort state */
let StationSortState = {
    field: 'name',
    direction: 'asc',
};

/** Currently rendered full stations array */
let _allStationsCache = [];

/** Currently expanded station ID (for progressive disclosure) */
let _expandedStationId = null;

async function loadStationsDetail() {
    const result = await AdminAPI.getStations(1, 500, '', '');
    
    if (!result.ok) {
        showDetailState('error', result.message || 'Failed to load stations');
        return;
    }
    
    const stations = result.stations || [];
    
    if (!stations.length) {
        showDetailState('empty', 'No stations found in the system');
        return;
    }
    
    _allStationsCache = stations;
    _expandedStationId = null;
    
    renderStationsPanel(stations);
}

/**
 * Render the full stations panel: summary stats, filters, and table.
 */
function renderStationsPanel(stations) {
    // Compute summary metrics
    const total = stations.length;
    const approved = stations.filter(s => s.approval_status === 'approved');
    const online = approved.filter(s => s.status === 'available').length;
    const busy = approved.filter(s => Number(s.queue_length || 0) >= 10).length;
    const noFuel = stations.filter(s => !s.fuel_availability?.petrol && !s.fuel_availability?.diesel).length;
    const pendingCount = stations.filter(s => s.approval_status === 'pending').length;
    const rejectedCount = stations.filter(s => s.approval_status === 'rejected').length;

    const html = `
        <!-- Summary stats banner -->
        <div class="station-summary-bar">
            <div class="summary-item">
                <span class="summary-value">${total}</span>
                <span class="summary-label">Total</span>
            </div>
            <div class="summary-item">
                <span class="summary-value summary-online">${online}</span>
                <span class="summary-label">Online</span>
            </div>
            <div class="summary-item">
                <span class="summary-value summary-busy">${busy}</span>
                <span class="summary-label">Busy</span>
            </div>
            <div class="summary-item">
                <span class="summary-value summary-nofuel">${noFuel}</span>
                <span class="summary-label">No Fuel</span>
            </div>
            <div class="summary-item">
                <span class="summary-value summary-pending">${pendingCount}</span>
                <span class="summary-label">Pending</span>
            </div>
            <div class="summary-item">
                <span class="summary-value summary-rejected">${rejectedCount}</span>
                <span class="summary-label">Rejected</span>
            </div>
        </div>

        <!-- Search, filters and sort toolbar -->
        <div class="station-toolbar">
            <div class="toolbar-group">
                <div class="toolbar-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="detailStationSearch" placeholder="Search by name or location..." />
                </div>
                <select class="toolbar-select" id="detailStationFilter">
                    <option value="">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                </select>
                <select class="toolbar-select" id="detailStationFuelFilter">
                    <option value="">All Fuel</option>
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="both">Both</option>
                    <option value="none">No Fuel</option>
                </select>
            </div>
            <div class="toolbar-group">
                <span class="sort-label">Sort:</span>
                <select class="toolbar-select" id="detailStationSort">
                    <option value="name">Name</option>
                    <option value="queue">Queue Length</option>
                    <option value="wait">Wait Time</option>
                    <option value="updated">Last Updated</option>
                </select>
                <button class="sort-direction-btn" id="detailStationSortDir" title="Toggle sort direction">
                    <i class="fas fa-arrow-up"></i>
                </button>
            </div>
        </div>

        <!-- Station table -->
        <div class="station-table-container">
            <table class="station-table" id="detailStationTable">
                <thead>
                    <tr>
                        <th class="th-status" style="width: 32px;"></th>
                        <th class="th-name sortable" data-sort="name">Station Name</th>
                        <th class="th-queue sortable" data-sort="queue">Queue</th>
                        <th class="th-wait sortable" data-sort="wait">Wait Time</th>
                        <th class="th-fuel">Fuel</th>
                        <th class="th-updated sortable" data-sort="updated">Last Updated</th>
                        <th class="th-status-badge">Status</th>
                        <th class="th-actions">Actions</th>
                    </tr>
                </thead>
                <tbody id="detailStationTableBody">
                    ${buildStationRows(stations)}
                </tbody>
            </table>
        </div>

        <!-- Results count -->
        <div class="station-table-footer">
            <span id="detailStationCount">${stations.length} station${stations.length !== 1 ? 's' : ''}</span>
        </div>
    `;

    document.getElementById('detailContent').innerHTML = html;
    showDetailState('content');

    // Wire up interactions
    wireStationInteractions(stations);
}

/**
 * Build all station table rows (including expanded detail row if one is open).
 */
function buildStationRows(stations) {
    return stations.map((s, i) => {
        const isExpanded = _expandedStationId === s.station_id;
        return renderStationRow(s, i, isExpanded);
    }).join('');
}

/**
 * Render a single station table row + optional expanded detail row.
 */
function renderStationRow(s, index, isExpanded) {
    const statusDotClass = s.status || (s.fuel_availability?.petrol || s.fuel_availability?.diesel ? 'limited' : 'no_fuel');
    const queueLen = Number(s.queue_length || 0);
    const waitTime = Number(s.waiting_time || 0);
    
    const fuelBadges = [];
    if (s.fuel_availability?.petrol) fuelBadges.push('<span class="fuel-badge fuel-petrol">P</span>');
    if (s.fuel_availability?.diesel) fuelBadges.push('<span class="fuel-badge fuel-diesel">D</span>');
    if (!fuelBadges.length) fuelBadges.push('<span class="fuel-badge fuel-none">—</span>');
    
    const approvalBadge = s.approval_status === 'approved'
        ? '<span class="st-badge st-approved">Active</span>'
        : s.approval_status === 'pending'
        ? '<span class="st-badge st-pending">Pending</span>'
        : '<span class="st-badge st-rejected">Rejected</span>';
    
    const lastUpdated = s.queue_updated_at ? formatTimeAgo(s.queue_updated_at) : '—';
    
    const waitBadge = s.wait_badge === 'quick'
        ? '<span class="wait-badge wb-quick">Quick</span>'
        : s.wait_badge === 'long'
        ? '<span class="wait-badge wb-long">Long</span>'
        : '<span class="wait-badge wb-normal">Normal</span>';

    // Main row
    const mainRow = `
        <tr class="station-row ${isExpanded ? 'expanded' : ''}" data-station-id="${s.station_id}">
            <td><span class="status-dot ${statusDotClass}" title="${escapeHtml(s.status || 'unknown')}"></span></td>
            <td class="td-name">
                <span class="station-name-link">${escapeHtml(s.station_name)}</span>
                <span class="station-loc-sub">${escapeHtml(s.location || '')}</span>
            </td>
            <td class="td-queue">
                <span class="queue-value ${queueLen >= 10 ? 'queue-high' : queueLen > 0 ? 'queue-med' : ''}">${queueLen}</span>
            </td>
            <td class="td-wait">${waitTime}<span class="wait-unit">m</span></td>
            <td class="td-fuel">${fuelBadges.join(' ')} ${s.wait_badge ? waitBadge : ''}</td>
            <td class="td-updated">${lastUpdated}</td>
            <td class="td-status">${approvalBadge}</td>
            <td class="td-actions">
                <div class="row-actions">
                    ${s.approval_status === 'pending' ? `
                        <button class="row-action-btn action-approve" onclick="event.stopPropagation(); showStationActionModal('approve', ${s.station_id})" title="Approve station">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="row-action-btn action-reject" onclick="event.stopPropagation(); showStationActionModal('reject', ${s.station_id})" title="Reject station">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : s.approval_status === 'rejected' ? `
                        <button class="row-action-btn action-approve" onclick="event.stopPropagation(); showStationActionModal('approve', ${s.station_id})" title="Re-approve station">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : `
                        <button class="row-action-btn action-view" onclick="event.stopPropagation(); switchSection('stations')" title="View in stations section">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                        <button class="row-action-btn action-danger" onclick="event.stopPropagation(); showStationActionModal('reject', ${s.station_id})" title="Reject station">
                            <i class="fas fa-ban"></i>
                        </button>
                    `}
                    <button class="row-action-btn action-expand" onclick="event.stopPropagation(); toggleStationExpand(${s.station_id})" title="${isExpanded ? 'Collapse' : 'Expand'} details">
                        <i class="fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;

    // Expanded detail row
    let detailRow = '';
    if (isExpanded) {
        detailRow = `
            <tr class="station-detail-row">
                <td colspan="8">
                    <div class="station-detail-panel">
                        <div class="detail-grid">
                            <div class="detail-info-section">
                                <h6 class="detail-section-label"><i class="fas fa-info-circle"></i> Station Information</h6>
                                <div class="info-rows">
                                    <div class="info-row">
                                        <span class="info-key">Station ID</span>
                                        <span class="info-val">#${s.station_id}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Name</span>
                                        <span class="info-val">${escapeHtml(s.station_name)}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Location</span>
                                        <span class="info-val">${escapeHtml(s.location || 'Not specified')}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Created</span>
                                        <span class="info-val">${formatDate(s.created_at)}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Approved</span>
                                        <span class="info-val">${s.approved_at ? formatDate(s.approved_at) : '—'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="detail-info-section">
                                <h6 class="detail-section-label"><i class="fas fa-user"></i> Owner</h6>
                                <div class="info-rows">
                                    <div class="info-row">
                                        <span class="info-key">Name</span>
                                        <span class="info-val">${escapeHtml(s.owner?.name || 'N/A')}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Email</span>
                                        <span class="info-val">${escapeHtml(s.owner?.email || 'N/A')}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="detail-info-section">
                                <h6 class="detail-section-label"><i class="fas fa-chart-bar"></i> Queue & Fuel</h6>
                                <div class="info-rows">
                                    <div class="info-row">
                                        <span class="info-key">Queue Length</span>
                                        <span class="info-val"><strong>${queueLen}</strong> vehicles</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Wait Time</span>
                                        <span class="info-val"><strong>${waitTime}</strong> min</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Status</span>
                                        <span class="info-val">${statusDotClass === 'available' ? '<span class="st-badge st-approved">Available</span>' : statusDotClass === 'limited' ? '<span class="st-badge st-pending">Limited</span>' : '<span class="st-badge st-rejected">No Fuel</span>'}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Petrol</span>
                                        <span class="info-val">${s.fuel_availability?.petrol ? '<span class="fuel-badge fuel-petrol">Available</span>' : '<span class="fuel-badge fuel-none">Unavailable</span>'}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Diesel</span>
                                        <span class="info-val">${s.fuel_availability?.diesel ? '<span class="fuel-badge fuel-diesel">Available</span>' : '<span class="fuel-badge fuel-none">Unavailable</span>'}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-key">Last Updated</span>
                                        <span class="info-val">${s.queue_updated_at ? formatDate(s.queue_updated_at) : '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="detail-actions-bar">
                            <button class="da-btn da-primary" onclick="alert('Map view - coming soon')" title="View on map">
                                <i class="fas fa-map-marker-alt"></i> Map
                            </button>
                            <button class="da-btn da-secondary" onclick="alert('Edit station - coming soon')" title="Edit station details">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="da-btn da-danger" onclick="event.stopPropagation(); showStationActionModal('reject', ${s.station_id})" title="Disable station">
                                <i class="fas fa-power-off"></i> Disable
                            </button>
                            <button class="da-btn da-secondary" onclick="alert('View history - coming soon')" title="View station history">
                                <i class="fas fa-history"></i> History
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    return mainRow + detailRow;
}

/**
 * Toggle the expanded state for a station row.
 */
function toggleStationExpand(stationId) {
    if (_expandedStationId === stationId) {
        _expandedStationId = null;
    } else {
        _expandedStationId = stationId;
    }
    // Re-render the table with current filters/sorts
    applyStationFiltersAndSort();
}

/**
 * Apply current filters, search, and sort to the cached stations list.
 */
function applyStationFiltersAndSort() {
    let stations = [..._allStationsCache];
    
    const searchEl = document.getElementById('detailStationSearch');
    const statusEl = document.getElementById('detailStationFilter');
    const fuelEl = document.getElementById('detailStationFuelFilter');
    const sortEl = document.getElementById('detailStationSort');
    
    const q = searchEl ? searchEl.value.toLowerCase() : '';
    const status = statusEl ? statusEl.value : '';
    const fuelFilter = fuelEl ? fuelEl.value : '';
    const sortField = sortEl ? sortEl.value : 'name';
    
    // Filter: search
    if (q) {
        stations = stations.filter(s =>
            s.station_name.toLowerCase().includes(q) ||
            (s.location || '').toLowerCase().includes(q)
        );
    }
    
    // Filter: approval status
    if (status) {
        stations = stations.filter(s => s.approval_status === status);
    }
    
    // Filter: fuel type
    if (fuelFilter) {
        stations = stations.filter(s => {
            if (fuelFilter === 'petrol') return s.fuel_availability?.petrol;
            if (fuelFilter === 'diesel') return s.fuel_availability?.diesel;
            if (fuelFilter === 'both') return s.fuel_availability?.petrol && s.fuel_availability?.diesel;
            if (fuelFilter === 'none') return !s.fuel_availability?.petrol && !s.fuel_availability?.diesel;
            return true;
        });
    }
    
    // Sort
    const dir = StationSortState.direction === 'asc' ? 1 : -1;
    stations.sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
            case 'name':
                cmp = (a.station_name || '').localeCompare(b.station_name || '');
                break;
            case 'queue':
                cmp = (Number(a.queue_length || 0)) - (Number(b.queue_length || 0));
                break;
            case 'wait':
                cmp = (Number(a.waiting_time || 0)) - (Number(b.waiting_time || 0));
                break;
            case 'updated':
                cmp = (a.queue_updated_at || '').localeCompare(b.queue_updated_at || '');
                break;
        }
        return cmp * dir;
    });
    
    StationSortState.field = sortField;
    
    // Re-render table body
    const tbody = document.getElementById('detailStationTableBody');
    const countEl = document.getElementById('detailStationCount');
    if (tbody) {
        tbody.innerHTML = buildStationRows(stations);
    }
    if (countEl) {
        countEl.textContent = `${stations.length} station${stations.length !== 1 ? 's' : ''}`;
    }
    
    // Re-wire row clicks
    wireStationRowClicks();
}

/**
 * Wire click events: row expand and sort header clicks.
 */
function wireStationInteractions(stations) {
    // Row clicks for expand
    wireStationRowClicks();
    
    // Search input
    const searchEl = document.getElementById('detailStationSearch');
    if (searchEl) {
        searchEl.addEventListener('input', debounce(applyStationFiltersAndSort, 250));
    }
    
    // Filter selects
    ['detailStationFilter', 'detailStationFuelFilter', 'detailStationSort'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyStationFiltersAndSort);
    });
    
    // Sort direction toggle
    const dirBtn = document.getElementById('detailStationSortDir');
    if (dirBtn) {
        dirBtn.addEventListener('click', () => {
            StationSortState.direction = StationSortState.direction === 'asc' ? 'desc' : 'asc';
            dirBtn.innerHTML = `<i class="fas fa-arrow-${StationSortState.direction === 'asc' ? 'up' : 'down'}"></i>`;
            applyStationFiltersAndSort();
        });
    }
}

/**
 * Wire row click toggles for expandable rows.
 */
function wireStationRowClicks() {
    document.querySelectorAll('.station-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't expand if clicking action buttons
            if (e.target.closest('.row-action-btn') || e.target.closest('.row-actions')) return;
            const stationId = parseInt(row.dataset.stationId);
            toggleStationExpand(stationId);
        });
    });
}

// ============================================================================
// DETAIL PANEL: USERS
// ============================================================================

async function loadUsersDetail() {
    const result = await AdminAPI.getUsers(1, 50, '', '', '');
    
    if (!result.ok) {
        showDetailState('error', result.message || 'Failed to load users');
        return;
    }
    
    const users = result.users || [];
    
    if (!users.length) {
        showDetailState('empty', 'No users found');
        return;
    }
    
    // Summary
    const activeCount = users.filter(u => u.is_active).length;
    const suspendedCount = users.filter(u => !u.is_active).length;
    const customerCount = users.filter(u => u.role === 'customer').length;
    const ownerCount = users.filter(u => u.role === 'owner').length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    
    const html = `
        <div class="detail-stats-grid">
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-success);">${activeCount}</div>
                <div class="detail-stat-label">Active</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-danger);">${suspendedCount}</div>
                <div class="detail-stat-label">Suspended</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-accent);">${customerCount}</div>
                <div class="detail-stat-label">Customers</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-warning);">${ownerCount}</div>
                <div class="detail-stat-label">Owners</div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-search-bar">
                <input type="text" class="detail-search-input" id="detailUserSearch" placeholder="Search by name, email..." />
                <select class="detail-filter-select" id="detailUserRoleFilter">
                    <option value="">All Roles</option>
                    <option value="customer">Customer</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                </select>
                <select class="detail-filter-select" id="detailUserStatusFilter">
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>
            <div class="detail-list" id="detailUserList">
                ${users.map((u, i) => renderUserItem(u, i)).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('detailContent').innerHTML = html;
    showDetailState('content');
    
    // Wire up search/filter
    const searchInput = document.getElementById('detailUserSearch');
    const roleFilter = document.getElementById('detailUserRoleFilter');
    const statusFilter = document.getElementById('detailUserStatusFilter');
    
    const filterUsers = () => {
        const q = (searchInput?.value || '').toLowerCase();
        const role = roleFilter?.value || '';
        const status = statusFilter?.value || '';
        
        const filtered = users.filter(u => {
            const matchSearch = !q || u.name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
            const matchRole = !role || u.role === role;
            const matchStatus = !status || (status === 'active' ? u.is_active : !u.is_active);
            return matchSearch && matchRole && matchStatus;
        });
        const listEl = document.getElementById('detailUserList');
        if (listEl) {
            listEl.innerHTML = filtered.length
                ? filtered.map((u, i) => renderUserItem(u, i)).join('')
                : '<div class="empty-state"><p>No users match your criteria</p></div>';
        }
    };
    
    if (searchInput) searchInput.addEventListener('input', debounce(filterUsers, 250));
    if (roleFilter) roleFilter.addEventListener('change', filterUsers);
    if (statusFilter) statusFilter.addEventListener('change', filterUsers);
}

function renderUserItem(u, index) {
    const statusBadge = u.is_active
        ? '<span class="badge bg-success">Active</span>'
        : '<span class="badge bg-danger">Suspended</span>';
    
    const roleBadge = u.role === 'admin' 
        ? '<span class="badge bg-secondary">Admin</span>'
        : u.role === 'owner'
        ? '<span class="badge bg-warning">Owner</span>'
        : '<span class="badge bg-info">Customer</span>';
    
    const actions = `
        <div class="detail-actions">
            ${u.is_active
                ? `<button class="btn btn-sm btn-outline-danger" onclick="showUserActionModal('suspend', ${u.user_id})" title="Suspend user"><i class="fas fa-ban"></i></button>`
                : `<button class="btn btn-sm btn-outline-success" onclick="showUserActionModal('activate', ${u.user_id})" title="Activate user"><i class="fas fa-check"></i></button>`
            }
            <button class="btn btn-sm btn-outline-danger" onclick="showUserActionModal('delete', ${u.user_id})" title="Delete user"><i class="fas fa-trash"></i></button>
        </div>
    `;
    
    return `
        <div class="detail-list-item" style="animation-delay: ${index * 0.03}s;">
            <div class="item-main">
                <div class="item-title">${escapeHtml(u.name)}</div>
                <div class="item-subtitle">${escapeHtml(u.email)}</div>
            </div>
            <div class="item-meta">
                ${roleBadge}
                ${statusBadge}
            </div>
            <div class="item-action">
                ${actions}
            </div>
        </div>
    `;
}

// ============================================================================
// DETAIL PANEL: REPORTS
// ============================================================================

async function loadReportsDetail() {
    const result = await AdminAPI.getReports(1, 50, '', '');
    
    if (!result.ok) {
        showDetailState('error', result.message || 'Failed to load reports');
        return;
    }
    
    const reports = result.reports || [];
    
    if (!reports.length) {
        showDetailState('empty', 'No reports found in the system');
        return;
    }
    
    // Summary
    const pendingCount = reports.filter(r => r.status === 'pending').length;
    const resolvedCount = reports.filter(r => r.status === 'resolved').length;
    const spamCount = reports.filter(r => r.status === 'spam').length;
    
    const html = `
        <div class="detail-stats-grid">
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-warning);">${pendingCount}</div>
                <div class="detail-stat-label">Pending</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-success);">${resolvedCount}</div>
                <div class="detail-stat-label">Resolved</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-text-secondary);">${spamCount}</div>
                <div class="detail-stat-label">Spam</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value">${reports.length}</div>
                <div class="detail-stat-label">Total</div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-search-bar">
                <input type="text" class="detail-search-input" id="detailReportSearch" placeholder="Search reports..." />
                <select class="detail-filter-select" id="detailReportFilter">
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="spam">Spam</option>
                </select>
            </div>
            <div class="detail-list" id="detailReportList">
                ${reports.map((r, i) => renderReportItem(r, i)).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('detailContent').innerHTML = html;
    showDetailState('content');
    
    // Wire up search/filter
    const searchInput = document.getElementById('detailReportSearch');
    const filterSelect = document.getElementById('detailReportFilter');
    
    const filterReports = () => {
        const q = (searchInput?.value || '').toLowerCase();
        const status = filterSelect?.value || '';
        
        const filtered = reports.filter(r => {
            const comment = (r.comment || '').toLowerCase();
            const reporterName = (r.reporter?.name || '').toLowerCase();
            const stationName = (r.station?.station_name || '').toLowerCase();
            const matchSearch = !q || comment.includes(q) || reporterName.includes(q) || stationName.includes(q);
            const matchStatus = !status || r.status === status;
            return matchSearch && matchStatus;
        });
        const listEl = document.getElementById('detailReportList');
        if (listEl) {
            listEl.innerHTML = filtered.length
                ? filtered.map((r, i) => renderReportItem(r, i)).join('')
                : '<div class="empty-state"><p>No reports match your criteria</p></div>';
        }
    };
    
    if (searchInput) searchInput.addEventListener('input', debounce(filterReports, 250));
    if (filterSelect) filterSelect.addEventListener('change', filterReports);
}

function renderReportItem(r, index) {
    const statusColors = { pending: 'warning', reviewed: 'info', resolved: 'success', spam: 'secondary' };
    const statusBadge = `<span class="badge bg-${statusColors[r.status] || 'secondary'}">${escapeHtml(r.status)}</span>`;
    const commentPreview = (r.comment || '').substring(0, 60);
    
    const actions = r.status === 'pending' ? `
        <div class="detail-actions">
            <button class="btn btn-sm btn-success" onclick="handleReportFromDetail(${r.report_id}, 'resolve')" title="Resolve report">
                <i class="fas fa-check"></i> Resolve
            </button>
            <button class="btn btn-sm btn-secondary" onclick="handleReportFromDetail(${r.report_id}, 'spam')" title="Mark as spam">
                <i class="fas fa-flag"></i> Spam
            </button>
        </div>
    ` : '';
    
    return `
        <div class="detail-list-item" style="animation-delay: ${index * 0.03}s;">
            <div class="item-main">
                <div class="item-title">
                    <i class="fas fa-file-alt me-1" style="color: var(--color-text-tertiary);"></i>
                    Report #${r.report_id}
                </div>
                <div class="item-subtitle">
                    ${escapeHtml(r.reporter?.name || 'Anonymous')} @ ${escapeHtml(r.station?.station_name || 'Unknown station')}
                    ${commentPreview ? `&mdash; ${escapeHtml(commentPreview)}${(r.comment || '').length > 60 ? '...' : ''}` : ''}
                </div>
            </div>
            <div class="item-meta">
                ${statusBadge}
            </div>
            <div class="item-action">
                ${actions}
            </div>
        </div>
    `;
}

/** Handle report action from detail panel and refresh */
async function handleReportFromDetail(reportId, action) {
    const result = await AdminAPI.reportAction(action, reportId, '');
    if (result.ok) {
        showToast(action === 'spam' ? 'Report marked as spam' : 'Report resolved');
        // Reload the detail panel
        if (DetailPanel.refreshHandler) DetailPanel.refreshHandler();
    } else {
        showAlert(result.message, 'danger');
    }
}

// ============================================================================
// DETAIL PANEL: ALERTS
// ============================================================================

async function loadAlertsDetail() {
    const result = await AdminAPI.getAlerts(1, 50, '');
    
    if (!result.ok) {
        showDetailState('error', result.message || 'Failed to load alerts');
        return;
    }
    
    const alerts = result.alerts || [];
    
    if (!alerts.length) {
        showDetailState('empty', 'No system alerts at this time');
        return;
    }
    
    // Summary
    const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_acknowledged).length;
    const warningCount = alerts.filter(a => a.severity === 'high' && !a.is_acknowledged).length;
    const infoCount = alerts.filter(a => (a.severity === 'medium' || a.severity === 'low') && !a.is_acknowledged).length;
    const resolvedCount = alerts.filter(a => a.is_acknowledged).length;
    
    const html = `
        <div class="detail-stats-grid">
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-danger);">${criticalCount}</div>
                <div class="detail-stat-label">Critical</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-warning);">${warningCount}</div>
                <div class="detail-stat-label">Warning</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-info);">${infoCount}</div>
                <div class="detail-stat-label">Info</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-success);">${resolvedCount}</div>
                <div class="detail-stat-label">Resolved</div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-search-bar">
                <select class="detail-filter-select" id="detailAlertFilter">
                    <option value="">All Alerts</option>
                    <option value="unacknowledged">Unacknowledged</option>
                    <option value="acknowledged">Acknowledged</option>
                </select>
                <button class="btn btn-sm btn-success" id="detailAckAllBtn" ${criticalCount + warningCount + infoCount === 0 ? 'disabled' : ''}>
                    <i class="fas fa-check-double"></i> Ack All
                </button>
            </div>
            <div class="detail-list" id="detailAlertList">
                ${alerts.map((a, i) => renderAlertItem(a, i)).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('detailContent').innerHTML = html;
    showDetailState('content');
    
    // Wire up filter
    const filterSelect = document.getElementById('detailAlertFilter');
    const ackAllBtn = document.getElementById('detailAckAllBtn');
    
    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            const filter = filterSelect.value;
            const filtered = alerts.filter(a => {
                if (!filter) return true;
                if (filter === 'unacknowledged') return !a.is_acknowledged;
                if (filter === 'acknowledged') return a.is_acknowledged;
                return true;
            });
            const listEl = document.getElementById('detailAlertList');
            if (listEl) {
                listEl.innerHTML = filtered.length
                    ? filtered.map((a, i) => renderAlertItem(a, i)).join('')
                    : '<div class="empty-state"><p>No alerts match this filter</p></div>';
            }
        });
    }
    
    if (ackAllBtn) {
        ackAllBtn.addEventListener('click', async () => {
            const res = await AdminAPI.alertAction('acknowledge_all');
            if (res.ok) {
                showToast('All alerts acknowledged');
                if (DetailPanel.refreshHandler) DetailPanel.refreshHandler();
            }
        });
    }
}

function renderAlertItem(a, index) {
    const severityMap = { critical: 'danger', high: 'danger', medium: 'warning', low: 'info' };
    const severityBadge = `<span class="badge bg-${severityMap[a.severity] || 'secondary'}">${escapeHtml(a.severity)}</span>`;
    const statusBadge = a.is_acknowledged
        ? '<span class="badge bg-success">Acknowledged</span>'
        : '<span class="badge bg-warning">Open</span>';
    
    const actions = !a.is_acknowledged ? `
        <button class="btn btn-sm btn-outline-success" onclick="handleAckFromDetail(${a.alert_id})" title="Acknowledge">
            <i class="fas fa-check"></i>
        </button>
    ` : '';
    
    const severityClass = `severity-${a.severity}`;
    
    return `
        <div class="detail-list-item detail-alert-item ${severityClass}" style="animation-delay: ${index * 0.03}s;">
            <div class="item-main">
                <div class="item-title">${escapeHtml(a.title)}</div>
                <div class="item-subtitle">${escapeHtml(a.message || '')}</div>
            </div>
            <div class="item-meta">
                ${severityBadge}
                ${statusBadge}
            </div>
            <div class="item-action">
                ${actions}
            </div>
        </div>
    `;
}

async function handleAckFromDetail(alertId) {
    const result = await AdminAPI.alertAction('acknowledge', alertId);
    if (result.ok) {
        showToast('Alert acknowledged');
        if (DetailPanel.refreshHandler) DetailPanel.refreshHandler();
    } else {
        showAlert(result.message, 'danger');
    }
}

// ============================================================================
// DETAIL PANEL: QUEUE STATISTICS
// ============================================================================

async function loadQueuesDetail() {
    // Load live stations data for queue info
    const [liveResult, statsResult] = await Promise.all([
        AdminAPI.getLiveStats(),
        AdminAPI.getStatistics(),
    ]);
    
    if (!liveResult.ok) {
        showDetailState('error', liveResult.message || 'Failed to load queue data');
        return;
    }
    
    const stations = liveResult.data?.active_stations || [];
    const queueStats = statsResult.ok ? statsResult.queues : {};
    
    // Sort stations by queue length
    const sortedByQueue = [...stations].sort((a, b) => (b.queue_length || 0) - (a.queue_length || 0));
    const busiest = sortedByQueue.slice(0, 5);
    const shortest = [...sortedByQueue].reverse().slice(0, 5);
    const longestQueues = sortedByQueue.filter(s => (s.queue_length || 0) > 10);
    
    const avgQueue = queueStats.average_queue_length || 0;
    const maxQueue = queueStats.max_queue_length || 0;
    const avgWait = queueStats.average_wait_time_minutes || 0;
    
    const html = `
        <div class="detail-stats-grid">
            <div class="detail-stat">
                <div class="detail-stat-value">${avgQueue}</div>
                <div class="detail-stat-label">Avg Queue</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-danger);">${maxQueue}</div>
                <div class="detail-stat-label">Max Queue</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value">${avgWait}<small style="font-size:0.6em;">m</small></div>
                <div class="detail-stat-label">Avg Wait</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value">${stations.length}</div>
                <div class="detail-stat-label">Stations</div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-fire me-1" style="color: var(--color-danger);"></i> Busiest Stations (Top 5)</div>
            <div class="detail-list">
                ${busiest.length ? busiest.map((s, i) => `
                    <div class="detail-list-item" style="animation-delay: ${i * 0.05}s;">
                        <div class="item-main">
                            <div class="item-title">${escapeHtml(s.station_name)}</div>
                            <div class="item-subtitle">${escapeHtml(s.location || 'No location')}</div>
                        </div>
                        <div class="item-meta">
                            <span class="badge bg-danger">${Number(s.queue_length || 0)} in queue</span>
                            <span class="badge bg-warning">${Number(s.waiting_time || 0)} min</span>
                        </div>
                    </div>
                `).join('') : '<p class="text-muted">No stations with active queues</p>'}
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-fast-forward me-1" style="color: var(--color-success);"></i> Shortest Queues (Top 5)</div>
            <div class="detail-list">
                ${shortest.length ? shortest.map((s, i) => `
                    <div class="detail-list-item" style="animation-delay: ${i * 0.05}s;">
                        <div class="item-main">
                            <div class="item-title">${escapeHtml(s.station_name)}</div>
                            <div class="item-subtitle">${escapeHtml(s.location || 'No location')}</div>
                        </div>
                        <div class="item-meta">
                            <span class="badge bg-success">${Number(s.queue_length || 0)} in queue</span>
                            <span class="badge bg-info">${Number(s.waiting_time || 0)} min</span>
                        </div>
                    </div>
                `).join('') : '<p class="text-muted">No stations with active queues</p>'}
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-chart-line me-1"></i> Queue Overview</div>
            <div class="detail-list">
                <div class="detail-list-item">
                    <span class="item-title">Stations with long queues (&gt;10 vehicles)</span>
                    <span class="badge bg-danger">${longestQueues.length}</span>
                </div>
                <div class="detail-list-item">
                    <span class="item-title">Average queue length</span>
                    <span class="badge bg-info">${avgQueue}</span>
                </div>
                <div class="detail-list-item">
                    <span class="item-title">Average waiting time</span>
                    <span class="badge bg-warning">${avgWait} min</span>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('detailContent').innerHTML = html;
    showDetailState('content');
}

// ============================================================================
// DETAIL PANEL: AVERAGE WAIT TIME
// ============================================================================

async function loadWaitTimeDetail() {
    const [liveResult, statsResult] = await Promise.all([
        AdminAPI.getLiveStats(),
        AdminAPI.getStatistics(),
    ]);
    
    if (!liveResult.ok && !statsResult.ok) {
        showDetailState('error', 'Failed to load waiting time data');
        return;
    }
    
    const stations = liveResult.ok ? (liveResult.data?.active_stations || []) : [];
    const queueStats = statsResult.ok ? statsResult.queues : {};
    
    // Sort by waiting time
    const sortedByWait = [...stations].sort((a, b) => (b.waiting_time || 0) - (a.waiting_time || 0));
    const fastest = [...sortedByWait].filter(s => (s.waiting_time || 0) > 0).reverse().slice(0, 5);
    const slowest = sortedByWait.filter(s => (s.waiting_time || 0) > 0).slice(0, 5);
    
    const avgWait = queueStats.average_wait_time_minutes || 0;
    
    const html = `
        <div class="detail-stats-grid">
            <div class="detail-stat">
                <div class="detail-stat-value">${avgWait}<small style="font-size:0.6em;">m</small></div>
                <div class="detail-stat-label">Avg Wait Time</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-success);">${fastest.length ? Math.min(...fastest.map(s => s.waiting_time || 0)) : '-'}<small style="font-size:0.6em;">m</small></div>
                <div class="detail-stat-label">Fastest</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value" style="color: var(--color-danger);">${slowest.length ? Math.max(...slowest.map(s => s.waiting_time || 0)) : '-'}<small style="font-size:0.6em;">m</small></div>
                <div class="detail-stat-label">Slowest</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value">${stations.length}</div>
                <div class="detail-stat-label">Stations</div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-rocket me-1" style="color: var(--color-success);"></i> Fastest Stations (Shortest Wait)</div>
            <div class="detail-list">
                ${fastest.length ? fastest.map((s, i) => `
                    <div class="detail-list-item" style="animation-delay: ${i * 0.05}s;">
                        <div class="item-main">
                            <div class="item-title">${escapeHtml(s.station_name)}</div>
                            <div class="item-subtitle">${escapeHtml(s.location || 'No location')} | Queue: ${Number(s.queue_length || 0)}</div>
                        </div>
                        <div class="item-meta">
                            <span class="badge bg-success">${Number(s.waiting_time || 0)} min</span>
                            <span class="badge wait-badge-quick">Quick</span>
                        </div>
                    </div>
                `).join('') : '<p class="text-muted">No station data available</p>'}
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title"><i class="fas fa-hourglass-end me-1" style="color: var(--color-danger);"></i> Slowest Stations (Longest Wait)</div>
            <div class="detail-list">
                ${slowest.length ? slowest.map((s, i) => `
                    <div class="detail-list-item" style="animation-delay: ${i * 0.05}s;">
                        <div class="item-main">
                            <div class="item-title">${escapeHtml(s.station_name)}</div>
                            <div class="item-subtitle">${escapeHtml(s.location || 'No location')} | Queue: ${Number(s.queue_length || 0)}</div>
                        </div>
                        <div class="item-meta">
                            <span class="badge bg-danger">${Number(s.waiting_time || 0)} min</span>
                            <span class="badge wait-badge-long">Long</span>
                        </div>
                    </div>
                `).join('') : '<p class="text-muted">No station data available</p>'}
            </div>
        </div>
    `;
    
    document.getElementById('detailContent').innerHTML = html;
    showDetailState('content');
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
    
    // Setup stat card clicks for detail panel
    initDetailPanel();
    initStatCardClicks();
    
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
