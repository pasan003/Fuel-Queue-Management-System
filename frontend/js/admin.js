/**
 * Admin Dashboard JavaScript
 * Handles admin APIs, live polling, analytics charts, search, and UI rendering.
 */

const AdminAPI = {
    baseUrl: '../backend/admin',

    async request(path, options = {}) {
        const response = await fetch(`${this.baseUrl}/${path}`, options);
        if (response.status === 401 || response.status === 403) {
            localStorage.clear();
            window.location.href = 'login.html';
            return { ok: false, message: 'Authentication required' };
        }
        return response.json();
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, ...(alertId && { alert_id: alertId }) }),
        });
    },

    exportCSV(type) {
        window.location.href = `${this.baseUrl}/export.php?type=${type}`;
    },
};

const UIState = {
    currentSection: 'dashboard',
    userPage: 1,
    stationPage: 1,
    reportPage: 1,
    auditPage: 1,
    alertPage: 1,
    userActionData: {},
    stationActionData: {},
    reportActionData: {},
    charts: {},
    cache: {
        stats: {},
        liveStationsHash: '',
        reportsCount: 0,
        alertsCount: 0,
    },
    liveRefresh: {
        intervalId: null,
        isRefreshing: false,
        intervalMs: 15000,
    },
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    }[char]));
}

function escapeInline(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function formatDate(dateString) {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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

function debounce(fn, wait = 300) {
    let timer = null;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), wait);
    };
}

function setTextWithFlash(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const next = String(value ?? '0');
    if (el.textContent !== next) {
        el.textContent = next;
        const flashTarget = el.closest('.stat-card') || el.closest('.stat-row') || el;
        flashTarget.classList.remove('stat-updated');
        void flashTarget.offsetWidth;
        flashTarget.classList.add('stat-updated');
    }
}

function setBadge(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const count = Number(value || 0);
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-block' : 'none';
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    const main = document.querySelector('.admin-main');
    const firstSection = main?.querySelector('.content-section');
    main?.insertBefore(alertDiv, firstSection || null);
    setTimeout(() => alertDiv.remove(), 5000);
}

function showToast(message) {
    let container = document.getElementById('adminToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'adminToastContainer';
        container.className = 'toast-container-admin';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3800);
}

function updateLastUpdated(isoString) {
    const el = document.getElementById('lastUpdated');
    if (!el) return;
    const date = isoString ? new Date(isoString) : new Date();
    el.textContent = `Last updated: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function markLiveRefreshing(isRefreshing) {
    document.getElementById('liveIndicator')?.classList.toggle('refreshing', isRefreshing);
}

function updateChart(key, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    if (!UIState.charts[key]) {
        UIState.charts[key] = new Chart(canvas.getContext('2d'), config);
        return;
    }

    const chart = UIState.charts[key];
    chart.data.labels = config.data.labels;
    chart.data.datasets = config.data.datasets;
    chart.options = { ...chart.options, ...config.options };
    chart.update('none');
}

function statusLabel(status) {
    const labels = {
        available: 'Available',
        limited: 'Limited',
        no_fuel: 'No Fuel',
        nofuel: 'No Fuel',
    };
    return labels[status] || status || 'Unknown';
}

function waitLabel(waitBadge) {
    const labels = { quick: 'Quick', normal: 'Normal', long: 'Long' };
    return labels[waitBadge] || 'Normal';
}

function switchSection(section) {
    UIState.currentSection = section;

    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

    document.querySelectorAll('.content-section').forEach(sec => {
        sec.style.display = 'none';
    });
    document.getElementById(`${section}Section`).style.display = 'block';
    document.querySelector('.admin-sidebar')?.classList.remove('open');

    if (section === 'dashboard') loadDashboard();
    else if (section === 'users') loadUsers(UIState.userPage);
    else if (section === 'stations') loadStations(UIState.stationPage);
    else if (section === 'reports') loadReports(UIState.reportPage);
    else if (section === 'audit') loadAuditLogs(UIState.auditPage);
    else if (section === 'alerts') loadAlerts(UIState.alertPage);
}

async function loadDashboard() {
    try {
        const [stats, analytics, live] = await Promise.all([
            AdminAPI.getStatistics(),
            AdminAPI.getAnalytics(),
            AdminAPI.getLiveStats(),
        ]);

        if (!stats.ok) {
            showAlert(stats.message || 'Failed to load statistics', 'danger');
            return;
        }

        renderDashboardStats(stats);
        if (analytics.ok) renderAnalytics(analytics.data);
        if (live.ok) renderLiveStats(live.data);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Error loading dashboard', 'danger');
    }
}

function renderDashboardStats(data) {
    setTextWithFlash('statTotalUsers', data.users.total);
    setTextWithFlash('statTotalStations', data.stations.total);
    setTextWithFlash('statTotalReports', data.reports.total);
    setTextWithFlash('statActiveQueues', data.active_queues_count);
    setTextWithFlash('stationPending', data.stations.pending);
    setTextWithFlash('stationApproved', data.stations.approved);
    setTextWithFlash('stationRejected', data.stations.rejected);

    const fuelHtml = Object.entries(data.fuel_availability || {}).map(([fuel, info]) => `
        <div class="stat-row">
            <span>${escapeHtml(fuel)}</span>
            <strong>${Number(info.availability_percentage || 0)}%</strong>
            <small>(${Number(info.available_stations || 0)}/${Number(info.total_stations || 0)})</small>
        </div>
    `).join('');
    document.getElementById('fuelAvailability').innerHTML = fuelHtml || '<p class="text-muted mb-0">No fuel data yet.</p>';

    setBadge('stationsBadge', data.stations.pending);
    setBadge('reportsBadge', data.reports.pending);
    setBadge('alertsBadge', data.alerts.total_unacknowledged);

    if (data.alerts.total_unacknowledged > 0) renderAlertCards(data.alerts);
    else document.getElementById('alertsContainer').style.display = 'none';
}

function renderAnalytics(data) {
    renderQueueTrendChart(data.queue_trends || []);
    renderFuelChart(data.fuel_availability || []);
    renderUserChartFromRows(data.active_users || []);
    renderPeakHoursChart(data.peak_queue_hours || []);
    renderReportChartFromRows(data.reports_overview || []);
}

function renderQueueTrendChart(rows) {
    updateChart('queueTrend', 'queueTrendChart', {
        type: 'line',
        data: {
            labels: rows.map(row => row.label),
            datasets: [
                {
                    label: 'Avg queue',
                    data: rows.map(row => Number(row.avg_queue || 0)),
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.12)',
                    tension: 0.35,
                    fill: true,
                },
                {
                    label: 'Avg wait',
                    data: rows.map(row => Number(row.avg_wait || 0)),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.08)',
                    tension: 0.35,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true } },
        },
    });
}

function renderFuelChart(rows) {
    updateChart('fuel', 'fuelChart', {
        type: 'bar',
        data: {
            labels: rows.map(row => row.fuel),
            datasets: [
                {
                    label: 'Available',
                    data: rows.map(row => Number(row.available_stations || 0)),
                    backgroundColor: '#198754',
                },
                {
                    label: 'Unavailable',
                    data: rows.map(row => Number(row.unavailable_stations || 0)),
                    backgroundColor: '#dc3545',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, precision: 0 } },
        },
    });
}

function renderUserChartFromRows(rows) {
    const roleMap = { customer: 0, owner: 0, admin: 0 };
    rows.forEach(row => {
        if (Object.prototype.hasOwnProperty.call(roleMap, row.role)) {
            roleMap[row.role] = Number(row.count || 0);
        }
    });
    renderUserChart({ by_role: roleMap });
}

function renderUserChart(data) {
    updateChart('users', 'userChart', {
        type: 'doughnut',
        data: {
            labels: ['Customers', 'Owners', 'Admins'],
            datasets: [{
                data: [
                    Number(data.by_role?.customer || 0),
                    Number(data.by_role?.owner || 0),
                    Number(data.by_role?.admin || 0),
                ],
                backgroundColor: ['#0d6efd', '#198754', '#6c757d'],
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
        },
    });
}

function renderPeakHoursChart(rows) {
    updateChart('peakHours', 'peakHoursChart', {
        type: 'bar',
        data: {
            labels: rows.map(row => `${String(row.hour).padStart(2, '0')}:00`),
            datasets: [{
                label: 'Avg queue',
                data: rows.map(row => Number(row.avg_queue || 0)),
                backgroundColor: '#ffc107',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
        },
    });
}

function renderReportChartFromRows(rows) {
    const statusMap = { pending: 0, reviewed: 0, resolved: 0, spam: 0 };
    rows.forEach(row => {
        if (Object.prototype.hasOwnProperty.call(statusMap, row.status)) {
            statusMap[row.status] = Number(row.count || 0);
        }
    });
    renderReportChart(statusMap);
}

function renderReportChart(data) {
    updateChart('reports', 'reportChart', {
        type: 'bar',
        data: {
            labels: ['Pending', 'Reviewed', 'Resolved', 'Spam'],
            datasets: [{
                label: 'Reports',
                data: [
                    Number(data.pending || 0),
                    Number(data.reviewed || 0),
                    Number(data.resolved || 0),
                    Number(data.spam || 0),
                ],
                backgroundColor: ['#ffc107', '#0d6efd', '#198754', '#6c757d'],
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, precision: 0 } },
        },
    });
}

function renderAlertCards(alerts) {
    const severityIcons = {
        critical: 'fa-exclamation-triangle',
        high: 'fa-exclamation-circle',
        medium: 'fa-info-circle',
        low: 'fa-check-circle',
    };
    const html = Object.entries(alerts.by_type || {}).filter(([, count]) => Number(count) > 0).map(([type, count]) => {
        const severity = Object.keys(alerts.by_severity || {}).find(s => Number(alerts.by_severity[s]) > 0) || 'medium';
        return `
            <div class="alert-card ${escapeHtml(severity)}">
                <div class="alert-icon"><i class="fas ${severityIcons[severity] || severityIcons.medium}"></i></div>
                <div class="alert-content">
                    <h6>${escapeHtml(type.replace(/_/g, ' '))}</h6>
                    <p>${Number(count)} alert${Number(count) === 1 ? '' : 's'}</p>
                </div>
            </div>
        `;
    }).join('');

    const container = document.getElementById('alertsContainer');
    container.innerHTML = html;
    container.style.display = html ? 'grid' : 'none';
}

function renderLiveStats(data) {
    if (!data) return;
    setBadge('stationsBadge', data.badges?.pending_stations || 0);
    setBadge('reportsBadge', data.badges?.pending_reports || 0);
    setBadge('alertsBadge', data.badges?.open_alerts || 0);
    updateLastUpdated(data.generated_at);
    renderLiveStations(data.active_stations || []);

    const previousReports = UIState.cache.reportsCount;
    const previousAlerts = UIState.cache.alertsCount;
    const nextReports = Number(data.badges?.pending_reports || 0);
    const nextAlerts = Number(data.badges?.open_alerts || 0);
    if (previousReports && nextReports > previousReports) showToast('New report received');
    if (previousAlerts && nextAlerts > previousAlerts) showToast('New system alert');
    UIState.cache.reportsCount = nextReports;
    UIState.cache.alertsCount = nextAlerts;
}

function renderLiveStations(stations) {
    const countEl = document.getElementById('liveStationCount');
    if (countEl) countEl.textContent = `${stations.length} active`;

    const nextHash = JSON.stringify(stations.map(s => [
        s.station_id,
        s.queue_length,
        s.waiting_time,
        s.status,
        s.fuel_availability?.petrol,
        s.fuel_availability?.diesel,
    ]));
    const changed = UIState.cache.liveStationsHash && UIState.cache.liveStationsHash !== nextHash;
    UIState.cache.liveStationsHash = nextHash;

    const html = stations.map(station => `
        <div class="live-station-item ${changed ? 'stat-updated' : ''}">
            <h6>${escapeHtml(station.station_name)}</h6>
            <div class="live-station-meta">${escapeHtml(station.location || 'No location')}</div>
            <div class="live-station-stats">
                <span class="badge status-${escapeHtml(station.status)}">${statusLabel(station.status)}</span>
                <span class="wait-badge wait-${escapeHtml(station.wait_badge)}">${waitLabel(station.wait_badge)}</span>
                <span class="badge bg-light text-dark">${Number(station.queue_length || 0)} in queue</span>
                <span class="badge bg-light text-dark">${Number(station.waiting_time || 0)} min</span>
            </div>
        </div>
    `).join('');
    document.getElementById('liveStationsList').innerHTML = html || '<p class="text-muted p-3 mb-0">No active stations yet.</p>';
}

async function runLiveRefresh() {
    if (UIState.liveRefresh.isRefreshing) return;
    UIState.liveRefresh.isRefreshing = true;
    markLiveRefreshing(true);
    const scrollTop = document.querySelector('.admin-main')?.scrollTop ?? 0;

    try {
        const [live, analytics] = await Promise.all([
            AdminAPI.getLiveStats(),
            UIState.currentSection === 'dashboard' ? AdminAPI.getAnalytics() : Promise.resolve(null),
        ]);
        if (live.ok) renderLiveStats(live.data);
        if (analytics?.ok) renderAnalytics(analytics.data);

        if (UIState.currentSection === 'dashboard' && live.ok) {
            setTextWithFlash('statTotalUsers', live.data.summary.total_users);
            setTextWithFlash('statTotalStations', live.data.summary.total_stations);
            setTextWithFlash('statTotalReports', live.data.summary.total_reports);
            setTextWithFlash('statActiveQueues', live.data.summary.active_queues);
        } else if (UIState.currentSection === 'stations') {
            await loadStations(UIState.stationPage, true);
        } else if (UIState.currentSection === 'reports') {
            await loadReports(UIState.reportPage, true);
        } else if (UIState.currentSection === 'alerts') {
            await loadAlerts(UIState.alertPage, true);
        }
    } catch (error) {
        console.warn('Live refresh failed:', error);
    } finally {
        const main = document.querySelector('.admin-main');
        if (main) main.scrollTop = scrollTop;
        UIState.liveRefresh.isRefreshing = false;
        markLiveRefreshing(false);
    }
}

function startLiveRefresh() {
    if (UIState.liveRefresh.intervalId) return;
    UIState.liveRefresh.intervalId = window.setInterval(runLiveRefresh, UIState.liveRefresh.intervalMs);
}

async function loadUsers(page = 1) {
    try {
        UIState.userPage = page;
        const search = document.getElementById('userSearch')?.value || '';
        const role = document.getElementById('userRoleFilter')?.value || '';
        const status = document.getElementById('userStatusFilter')?.value || '';
        const data = await AdminAPI.getUsers(page, 20, search, role, status);
        if (!data.ok) return showAlert(data.message || 'Failed to load users', 'danger');
        renderUsersTable(data.users);
        renderPagination(data.pagination, 'users', 'user');
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users', 'danger');
    }
}

function renderUsersTable(users) {
    const html = users.map(user => {
        const name = escapeHtml(user.name);
        const inlineName = escapeInline(user.name);
        const statusBadge = user.is_active
            ? '<span class="badge status-active">Active</span>'
            : '<span class="badge status-suspended">Suspended</span>';
        return `
            <tr>
                <td data-label="Name"><strong>${name}</strong></td>
                <td data-label="Email">${escapeHtml(user.email)}</td>
                <td data-label="Role"><span class="badge bg-secondary">${escapeHtml(user.role)}</span></td>
                <td data-label="Status">${statusBadge}</td>
                <td data-label="Stations">${Number(user.station_count || 0)}</td>
                <td data-label="Joined">${formatDate(user.created_at)}</td>
                <td data-label="Actions">
                    ${user.is_active
                        ? `<button class="btn btn-sm btn-outline-danger btn-action" onclick="openUserActionModal('suspend', ${Number(user.user_id)}, '${inlineName}')">Suspend</button>`
                        : `<button class="btn btn-sm btn-outline-success btn-action" onclick="openUserActionModal('activate', ${Number(user.user_id)}, '${inlineName}')">Activate</button>`}
                    <button class="btn btn-sm btn-outline-danger btn-action" onclick="openUserActionModal('delete', ${Number(user.user_id)}, '${inlineName}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    document.getElementById('usersTableBody').innerHTML = html || '<tr><td colspan="7" class="text-center text-muted">No users found.</td></tr>';
}

function renderPagination(pagination, section, type) {
    if (!pagination) return;
    const functionName = type === 'audit'
        ? 'loadAuditLogs'
        : `load${type.charAt(0).toUpperCase() + type.slice(1)}s`;
    let html = '';
    if (pagination.has_prev) html += `<button onclick="${functionName}(${pagination.page - 1})">Prev</button>`;
    const maxPages = Math.min(Number(pagination.total_pages || 1), 5);
    for (let i = 1; i <= maxPages; i++) {
        html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="${functionName}(${i})">${i}</button>`;
    }
    if (pagination.has_next) html += `<button onclick="${functionName}(${pagination.page + 1})">Next</button>`;
    document.getElementById(`${section}Pagination`).innerHTML = `<div class="pagination">${html}</div>`;
}

function openUserActionModal(action, userId, userName) {
    UIState.userActionData = { action, userId, userName };
    const modal = new bootstrap.Modal(document.getElementById('userActionModal'));
    document.getElementById('userActionTitle').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} User`;
    document.getElementById('userActionMessage').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} user "${userName}"?`;
    document.getElementById('userActionReason').value = '';
    modal.show();
}

async function loadStations(page = 1, silent = false) {
    try {
        UIState.stationPage = page;
        const search = document.getElementById('stationSearch')?.value || '';
        const status = document.getElementById('stationStatusFilter')?.value || '';
        const data = await AdminAPI.getStations(page, 20, search, status);
        if (!data.ok) return !silent && showAlert(data.message || 'Failed to load stations', 'danger');
        renderStationsTable(data.stations);
        renderPagination(data.pagination, 'stations', 'station');
    } catch (error) {
        console.error('Error loading stations:', error);
        if (!silent) showAlert('Error loading stations', 'danger');
    }
}

function renderStationsTable(stations) {
    const html = stations.map(station => {
        const statusBadge = `<span class="badge status-${escapeHtml(station.approval_status)}">${escapeHtml(station.approval_status)}</span>`;
        const liveStatus = `<span class="badge status-${escapeHtml(station.status)}">${statusLabel(station.status)}</span>`;
        const wait = `<span class="wait-badge wait-${escapeHtml(station.wait_badge)}">${waitLabel(station.wait_badge)}</span>`;
        const petrol = station.fuel_availability?.petrol ? '<span class="fuel-badge available">Petrol</span>' : '<span class="fuel-badge no-fuel">Petrol</span>';
        const diesel = station.fuel_availability?.diesel ? '<span class="fuel-badge available">Diesel</span>' : '<span class="fuel-badge no-fuel">Diesel</span>';
        const inlineName = escapeInline(station.station_name);
        const actions = station.approval_status === 'pending'
            ? `<button class="btn btn-sm btn-success btn-action" onclick="openStationActionModal('approve', ${Number(station.station_id)}, '${inlineName}')">Approve</button>
               <button class="btn btn-sm btn-danger btn-action" onclick="openStationActionModal('reject', ${Number(station.station_id)}, '${inlineName}')">Reject</button>`
            : '';
        return `
            <tr>
                <td data-label="Station"><strong>${escapeHtml(station.station_name)}</strong></td>
                <td data-label="Owner">${station.owner ? escapeHtml(station.owner.name) : '--'}</td>
                <td data-label="Location">${escapeHtml(station.location)}</td>
                <td data-label="Approval">${statusBadge}</td>
                <td data-label="Queue">${Number(station.queue_length || 0)} (${Number(station.waiting_time || 0)} min) ${wait}</td>
                <td data-label="Status">${liveStatus}</td>
                <td data-label="Fuel">${petrol} ${diesel}</td>
                <td data-label="Actions">${actions}</td>
            </tr>
        `;
    }).join('');
    document.getElementById('stationsTableBody').innerHTML = html || '<tr><td colspan="8" class="text-center text-muted">No stations found.</td></tr>';
}

function openStationActionModal(action, stationId, stationName) {
    UIState.stationActionData = { action, stationId, stationName };
    const modal = new bootstrap.Modal(document.getElementById('stationActionModal'));
    document.getElementById('stationActionTitle').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} Station`;
    document.getElementById('stationActionMessage').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} station "${stationName}"?`;
    document.getElementById('stationActionReason').value = '';
    document.getElementById('stationActionReason').placeholder = action === 'reject' ? 'Rejection reason (required)' : 'Reason (optional)';
    modal.show();
}

async function loadReports(page = 1, silent = false) {
    try {
        UIState.reportPage = page;
        const search = document.getElementById('reportSearch')?.value || '';
        const status = document.getElementById('reportStatusFilter')?.value || '';
        const data = await AdminAPI.getReports(page, 20, search, status);
        if (!data.ok) return !silent && showAlert(data.message || 'Failed to load reports', 'danger');
        renderReportsTable(data.reports);
        renderPagination(data.pagination, 'reports', 'report');
    } catch (error) {
        console.error('Error loading reports:', error);
        if (!silent) showAlert('Error loading reports', 'danger');
    }
}

function renderReportsTable(reports) {
    const statusMap = { pending: 'warning', reviewed: 'info', resolved: 'success', spam: 'secondary' };
    const html = reports.map(report => {
        const encodedReport = escapeHtml(JSON.stringify(report));
        const comment = String(report.comment || '');
        return `
            <tr>
                <td data-label="ID">#${Number(report.report_id)}</td>
                <td data-label="Reporter">${escapeHtml(report.reporter?.name || '--')}</td>
                <td data-label="Station">${escapeHtml(report.station?.station_name || '--')}</td>
                <td data-label="Comment"><small>${escapeHtml(comment.length > 50 ? `${comment.substring(0, 50)}...` : comment)}</small></td>
                <td data-label="Status"><span class="badge bg-${statusMap[report.status] || 'secondary'}">${escapeHtml(report.status)}</span></td>
                <td data-label="Created">${formatDate(report.created_at)}</td>
                <td data-label="Actions"><button class="btn btn-sm btn-primary btn-action" onclick="openReportModal(JSON.parse(this.dataset.report))" data-report="${encodedReport}">Review</button></td>
            </tr>
        `;
    }).join('');
    document.getElementById('reportsTableBody').innerHTML = html || '<tr><td colspan="7" class="text-center text-muted">No reports found.</td></tr>';
}

function openReportModal(report) {
    UIState.reportActionData = report;
    const modal = new bootstrap.Modal(document.getElementById('reportActionModal'));
    document.getElementById('reportDetails').innerHTML = `
        <h6>Report #${Number(report.report_id)}</h6>
        <p><strong>Reporter:</strong> ${escapeHtml(report.reporter?.name || '--')} (${escapeHtml(report.reporter?.email || '--')})</p>
        <p><strong>Station:</strong> ${escapeHtml(report.station?.station_name || '--')}</p>
        <p><strong>Fuel Type:</strong> ${escapeHtml(report.fuel_type || '--')}</p>
        <p><strong>Queue Length:</strong> ${escapeHtml(report.queue_length || '--')}</p>
        <p><strong>Waiting Time:</strong> ${escapeHtml(report.waiting_time || '--')} min</p>
        <p><strong>Comment:</strong></p>
        <p style="background:#f5f5f5; padding:0.5rem; border-radius:4px;">${escapeHtml(report.comment || '')}</p>
        <p><strong>Status:</strong> <span class="badge bg-secondary">${escapeHtml(report.status)}</span></p>
        ${report.admin_notes ? `<p><strong>Admin Notes:</strong> ${escapeHtml(report.admin_notes)}</p>` : ''}
    `;
    document.getElementById('reportAdminNotes').value = report.admin_notes || '';
    modal.show();
}

async function loadAuditLogs(page = 1) {
    try {
        UIState.auditPage = page;
        const action = document.getElementById('auditActionFilter')?.value || '';
        const data = await AdminAPI.getAuditLogs(page, 20, action);
        if (!data.ok) return showAlert(data.message || 'Failed to load audit logs', 'danger');
        renderAuditTable(data.logs);
        renderPagination(data.pagination, 'audit', 'audit');
    } catch (error) {
        console.error('Error loading audit logs:', error);
        showAlert('Error loading audit logs', 'danger');
    }
}

function renderAuditTable(logs) {
    const html = logs.map(log => `
        <tr>
            <td data-label="Admin">${escapeHtml(log.admin?.name || '--')}</td>
            <td data-label="Action"><code>${escapeHtml(log.action_type)}</code></td>
            <td data-label="Entity"><small>${escapeHtml(log.entity_type)} #${escapeHtml(log.entity_id || '--')}</small></td>
            <td data-label="Description"><small>${escapeHtml(String(log.description || '').substring(0, 70))}</small></td>
            <td data-label="IP"><small>${escapeHtml(log.ip_address || '--')}</small></td>
            <td data-label="Timestamp"><small>${formatTimeAgo(log.created_at)}</small></td>
        </tr>
    `).join('');
    document.getElementById('auditTableBody').innerHTML = html || '<tr><td colspan="6" class="text-center text-muted">No audit logs found.</td></tr>';
}

async function loadAlerts(page = 1, silent = false) {
    try {
        UIState.alertPage = page;
        const data = await AdminAPI.getAlerts(page, 20);
        if (!data.ok) return !silent && showAlert(data.message || 'Failed to load alerts', 'danger');
        renderAlertsTable(data.alerts);
    } catch (error) {
        console.error('Error loading alerts:', error);
        if (!silent) showAlert('Error loading alerts', 'danger');
    }
}

function renderAlertsTable(alerts) {
    const severityMap = { critical: 'danger', high: 'danger', medium: 'warning', low: 'info' };
    const html = alerts.map(alert => {
        const acknowledged = alert.is_acknowledged
            ? '<span class="badge bg-success">Acknowledged</span>'
            : '<span class="badge bg-warning">Pending</span>';
        return `
            <tr>
                <td data-label="Severity"><span class="badge bg-${severityMap[alert.severity] || 'secondary'}">${escapeHtml(alert.severity)}</span></td>
                <td data-label="Title"><strong>${escapeHtml(alert.title)}</strong></td>
                <td data-label="Message">${escapeHtml(alert.message)}</td>
                <td data-label="Created">${formatTimeAgo(alert.created_at)}</td>
                <td data-label="Status">${acknowledged}</td>
                <td data-label="Actions">
                    ${!alert.is_acknowledged ? `<button class="btn btn-sm btn-success btn-action" onclick="acknowledgeAlert(${Number(alert.alert_id)})">Acknowledge</button>` : ''}
                    <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteAlert(${Number(alert.alert_id)})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
    document.getElementById('alertsTableBody').innerHTML = html || '<tr><td colspan="6" class="text-center text-muted">No open alerts.</td></tr>';
}

async function acknowledgeAlert(alertId) {
    const result = await AdminAPI.alertAction('acknowledge', alertId);
    if (result.ok) {
        showToast('Alert acknowledged');
        loadAlerts(UIState.alertPage, true);
        runLiveRefresh();
    } else {
        showAlert(result.message, 'danger');
    }
}

async function deleteAlert(alertId) {
    const result = await AdminAPI.alertAction('delete', alertId);
    if (result.ok) {
        showToast('Alert deleted');
        loadAlerts(UIState.alertPage, true);
        runLiveRefresh();
    } else {
        showAlert(result.message, 'danger');
    }
}

async function handleGlobalSearch(query) {
    const resultsEl = document.getElementById('globalSearchResults');
    if (!resultsEl) return;
    if (!query.trim()) {
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
        return;
    }

    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div class="search-loading">Searching...</div>';

    try {
        const data = await AdminAPI.globalSearch(query.trim());
        if (!data.ok) throw new Error(data.message || 'Search failed');
        renderSearchResults(data.data);
    } catch (error) {
        resultsEl.innerHTML = '<div class="search-empty">Search failed.</div>';
    }
}

function renderSearchResults(data) {
    const resultsEl = document.getElementById('globalSearchResults');
    const groups = [
        ['Users', 'users', 'users'],
        ['Stations', 'stations', 'stations'],
        ['Reports', 'reports', 'reports'],
    ];
    const total = groups.reduce((sum, [, key]) => sum + (data[key]?.length || 0), 0);
    if (!total) {
        resultsEl.innerHTML = '<div class="search-empty">No matching users, stations, or reports.</div>';
        return;
    }

    resultsEl.innerHTML = groups.map(([label, key, section]) => {
        const items = data[key] || [];
        if (!items.length) return '';
        return `
            <div class="search-results-section">
                <div class="search-results-title">${label}</div>
                ${items.map(item => `
                    <a href="#" class="search-result-item" data-section-target="${section}">
                        <strong>${escapeHtml(item.title)}</strong>
                        <small>${escapeHtml(item.subtitle || item.meta || '')}</small>
                        <span class="badge bg-light text-dark">${escapeHtml(item.status || item.meta || '')}</span>
                    </a>
                `).join('')}
            </div>
        `;
    }).join('');
}

function wireEvents() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            switchSection(item.dataset.section);
        });
    });

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.querySelector('.admin-sidebar')?.classList.toggle('open');
    });

    document.getElementById('dashboardRefreshBtn')?.addEventListener('click', () => loadDashboard());
    document.getElementById('userRefreshBtn')?.addEventListener('click', () => loadUsers(1));
    document.getElementById('stationRefreshBtn')?.addEventListener('click', () => loadStations(1));
    document.getElementById('reportRefreshBtn')?.addEventListener('click', () => loadReports(1));
    document.getElementById('auditRefreshBtn')?.addEventListener('click', () => loadAuditLogs(1));
    document.getElementById('alertRefreshBtn')?.addEventListener('click', () => loadAlerts(1));

    const debouncedUsers = debounce(() => loadUsers(1));
    const debouncedStations = debounce(() => loadStations(1));
    const debouncedReports = debounce(() => loadReports(1));
    document.getElementById('userSearch')?.addEventListener('input', debouncedUsers);
    document.getElementById('userRoleFilter')?.addEventListener('change', () => loadUsers(1));
    document.getElementById('userStatusFilter')?.addEventListener('change', () => loadUsers(1));
    document.getElementById('stationSearch')?.addEventListener('input', debouncedStations);
    document.getElementById('stationStatusFilter')?.addEventListener('change', () => loadStations(1));
    document.getElementById('reportSearch')?.addEventListener('input', debouncedReports);
    document.getElementById('reportStatusFilter')?.addEventListener('change', () => loadReports(1));
    document.getElementById('auditActionFilter')?.addEventListener('change', () => loadAuditLogs(1));

    document.getElementById('exportUsersBtn')?.addEventListener('click', () => AdminAPI.exportCSV('users'));

    document.getElementById('globalSearchInput')?.addEventListener('input', debounce((event) => {
        handleGlobalSearch(event.target.value);
    }, 300));

    document.getElementById('globalSearchResults')?.addEventListener('click', (event) => {
        const item = event.target.closest('.search-result-item');
        if (!item) return;
        event.preventDefault();
        document.getElementById('globalSearchResults').style.display = 'none';
        switchSection(item.dataset.sectionTarget);
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.global-search')) {
            const results = document.getElementById('globalSearchResults');
            if (results) results.style.display = 'none';
        }
    });

    document.getElementById('confirmUserActionBtn')?.addEventListener('click', handleConfirmUserAction);
    document.getElementById('confirmStationActionBtn')?.addEventListener('click', handleConfirmStationAction);
    document.getElementById('reportSpamBtn')?.addEventListener('click', () => handleReportAction('spam'));
    document.getElementById('reportResolveBtn')?.addEventListener('click', () => handleReportAction('resolve'));
    document.getElementById('acknowledgeAllBtn')?.addEventListener('click', handleAcknowledgeAll);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
}

async function handleConfirmUserAction() {
    const { action, userId } = UIState.userActionData;
    const reason = document.getElementById('userActionReason').value.trim();
    if ((action === 'suspend' || action === 'delete') && !reason) return showAlert('Reason is required', 'warning');

    const result = await AdminAPI.userAction(action, userId, reason);
    if (result.ok) {
        showAlert(`User ${action}ed successfully`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('userActionModal'))?.hide();
        loadUsers(UIState.userPage);
        runLiveRefresh();
    } else {
        showAlert(result.message, 'danger');
    }
}

async function handleConfirmStationAction() {
    const { action, stationId } = UIState.stationActionData;
    const reason = document.getElementById('stationActionReason').value.trim();
    if (action === 'reject' && !reason) return showAlert('Rejection reason is required', 'warning');

    const result = await AdminAPI.stationAction(action, stationId, reason);
    if (result.ok) {
        showAlert(`Station ${action}ed successfully`, 'success');
        showToast(action === 'approve' ? 'Station approved' : 'Station rejected');
        bootstrap.Modal.getInstance(document.getElementById('stationActionModal'))?.hide();
        loadStations(UIState.stationPage);
        runLiveRefresh();
    } else {
        showAlert(result.message, 'danger');
    }
}

async function handleReportAction(action) {
    const notes = document.getElementById('reportAdminNotes').value.trim();
    const result = await AdminAPI.reportAction(action, UIState.reportActionData.report_id, notes);
    if (result.ok) {
        showAlert(action === 'spam' ? 'Report marked as spam' : 'Report resolved', 'success');
        bootstrap.Modal.getInstance(document.getElementById('reportActionModal'))?.hide();
        loadReports(UIState.reportPage);
        runLiveRefresh();
    } else {
        showAlert(result.message, 'danger');
    }
}

async function handleAcknowledgeAll() {
    const result = await AdminAPI.alertAction('acknowledge_all');
    if (result.ok) {
        showAlert('All alerts acknowledged', 'success');
        loadAlerts(1, true);
        runLiveRefresh();
    } else {
        showAlert(result.message, 'danger');
    }
}

async function handleLogout() {
    try {
        await fetch('../backend/logout.php', { method: 'POST' });
    } finally {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

window.addEventListener('load', async () => {
    const userType = localStorage.getItem('userType');
    if (userType !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    wireEvents();
    document.getElementById('adminName').textContent = localStorage.getItem('adminName') || localStorage.getItem('username') || 'Admin';

    try {
        const authCheck = await AdminAPI.getLiveStats();
        if (!authCheck.ok) return;
        renderLiveStats(authCheck.data);
    } catch (error) {
        console.warn('Admin auth check failed:', error);
    }

    await loadDashboard();
    startLiveRefresh();
});
