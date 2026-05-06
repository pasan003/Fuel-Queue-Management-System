/**
 * Admin Dashboard JavaScript
 * Handles API calls, UI rendering, and user interactions
 */

const AdminAPI = {
    baseUrl: '../backend/admin',

    // Statistics
    async getStatistics() {
        const response = await fetch(`${this.baseUrl}/statistics.php`);
        return response.json();
    },

    // Users
    async getUsers(page = 1, limit = 20, search = '', role = '', status = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            ...(role && { role }),
            ...(status && { status }),
        });
        const response = await fetch(`${this.baseUrl}/users.php?${params}`);
        return response.json();
    },

    async userAction(action, userId, reason = '') {
        const response = await fetch(`${this.baseUrl}/user-actions.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, user_id: userId, reason }),
        });
        return response.json();
    },

    // Stations
    async getStations(page = 1, limit = 20, search = '', status = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            ...(status && { approval_status: status }),
        });
        const response = await fetch(`${this.baseUrl}/stations.php?${params}`);
        return response.json();
    },

    async stationAction(action, stationId, reason = '') {
        const response = await fetch(`${this.baseUrl}/station-actions.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, station_id: stationId, reason }),
        });
        return response.json();
    },

    // Reports
    async getReports(page = 1, limit = 20, search = '', status = '') {
        const params = new URLSearchParams({
            page,
            limit,
            search,
            ...(status && { status }),
        });
        const response = await fetch(`${this.baseUrl}/reports.php?${params}`);
        return response.json();
    },

    async reportAction(action, reportId, notes = '') {
        const response = await fetch(`${this.baseUrl}/report-actions.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, report_id: reportId, notes }),
        });
        return response.json();
    },

    // Audit Logs
    async getAuditLogs(page = 1, limit = 20, action = '', user = '') {
        const params = new URLSearchParams({
            page,
            limit,
            ...(action && { action }),
            ...(user && { user }),
        });
        const response = await fetch(`${this.baseUrl}/audit-logs.php?${params}`);
        return response.json();
    },

    // Alerts
    async getAlerts(page = 1, limit = 20, acknowledged = '') {
        const params = new URLSearchParams({
            page,
            limit,
            ...(acknowledged !== '' && { acknowledged }),
        });
        const response = await fetch(`${this.baseUrl}/alerts.php?${params}`);
        return response.json();
    },

    async alertAction(action, alertId = null) {
        const response = await fetch(`${this.baseUrl}/alert-actions.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action, ...(alertId && { alert_id: alertId }) }),
        });
        return response.json();
    },

    // Export
    exportCSV(type) {
        window.location.href = `${this.baseUrl}/export.php?type=${type}`;
    },
};

// UI State
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
};

// Helper Functions
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.admin-main').insertBefore(alertDiv, document.querySelector('.section-header'));
    setTimeout(() => alertDiv.remove(), 5000);
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatTimeAgo(dateString) {
    if (!dateString) return '—';
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

// Section Navigation
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        switchSection(section);
    });
});

function switchSection(section) {
    UIState.currentSection = section;

    // Update active menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.style.display = 'none';
    });
    document.getElementById(`${section}Section`).style.display = 'block';

    // Load data
    if (section === 'dashboard') loadDashboard();
    else if (section === 'users') loadUsers();
    else if (section === 'stations') loadStations();
    else if (section === 'reports') loadReports();
    else if (section === 'audit') loadAuditLogs();
    else if (section === 'alerts') loadAlerts();
}

// Dashboard
async function loadDashboard() {
    try {
        const data = await AdminAPI.getStatistics();

        if (!data.ok) {
            showAlert('Failed to load statistics', 'danger');
            return;
        }

        // Update stat cards
        document.getElementById('statTotalUsers').textContent = data.users.total;
        document.getElementById('statTotalStations').textContent = data.stations.total;
        document.getElementById('statTotalReports').textContent = data.reports.total;
        document.getElementById('statActiveQueues').textContent = data.active_queues_count;

        // Station status
        document.getElementById('stationPending').textContent = data.stations.pending;
        document.getElementById('stationApproved').textContent = data.stations.approved;
        document.getElementById('stationRejected').textContent = data.stations.rejected;

        // Fuel availability
        let fuelHtml = '';
        for (const [fuel, info] of Object.entries(data.fuel_availability)) {
            fuelHtml += `
                <div class="stat-row">
                    <span>${fuel}</span>
                    <strong>${info.availability_percentage}%</strong>
                    <small>(${info.available_stations}/${info.total_stations})</small>
                </div>
            `;
        }
        document.getElementById('fuelAvailability').innerHTML = fuelHtml;

        // Update badges
        if (data.stations.pending > 0) {
            document.getElementById('stationsBadge').textContent = data.stations.pending;
            document.getElementById('stationsBadge').style.display = 'inline-block';
        }
        if (data.reports.pending > 0) {
            document.getElementById('reportsBadge').textContent = data.reports.pending;
            document.getElementById('reportsBadge').style.display = 'inline-block';
        }
        if (data.alerts.total_unacknowledged > 0) {
            document.getElementById('alertsBadge').textContent = data.alerts.total_unacknowledged;
            document.getElementById('alertsBadge').style.display = 'inline-block';
        }

        // Render charts
        renderUserChart(data.users);
        renderReportChart(data.reports);

        // Render alerts
        if (data.alerts.total_unacknowledged > 0) {
            renderAlerts(data.alerts);
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Error loading dashboard', 'danger');
    }
}

function renderUserChart(data) {
    const ctx = document.getElementById('userChart').getContext('2d');
    if (window.userChartInstance) window.userChartInstance.destroy();

    window.userChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Customers', 'Owners', 'Admins'],
            datasets: [{
                data: [data.by_role.customer, data.by_role.owner, data.by_role.admin],
                backgroundColor: ['#0d6efd', '#198754', '#6c757d'],
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        },
    });
}

function renderReportChart(data) {
    const ctx = document.getElementById('reportChart').getContext('2d');
    if (window.reportChartInstance) window.reportChartInstance.destroy();

    window.reportChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Pending', 'Reviewed', 'Resolved', 'Spam'],
            datasets: [{
                label: 'Reports',
                data: [data.pending, data.reviewed, data.resolved, data.spam],
                backgroundColor: ['#ffc107', '#0d6efd', '#198754', '#6c757d'],
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
        },
    });
}

function renderAlerts(alerts) {
    let html = '';
    const severityIcons = {
        critical: 'fa-exclamation-triangle',
        high: 'fa-exclamation-circle',
        medium: 'fa-info-circle',
        low: 'fa-check-circle',
    };

    for (const [type, count] of Object.entries(alerts.by_type)) {
        if (count === 0) continue;
        for (let i = 0; i < Math.min(count, 1); i++) {
            const severity = Object.keys(alerts.by_severity).find(s => alerts.by_severity[s] > 0) || 'medium';
            html += `
                <div class="alert-card ${severity}">
                    <div class="alert-icon">
                        <i class="fas ${severityIcons[severity]}"></i>
                    </div>
                    <div class="alert-content">
                        <h6>${type.replace('_', ' ')}</h6>
                        <p>${count} alert${count > 1 ? 's' : ''}</p>
                    </div>
                </div>
            `;
        }
    }

    document.getElementById('alertsContainer').innerHTML = html;
    if (html) document.getElementById('alertsContainer').style.display = 'grid';
}

// Users Management
async function loadUsers(page = 1) {
    try {
        UIState.userPage = page;
        const search = document.getElementById('userSearch')?.value || '';
        const role = document.getElementById('userRoleFilter')?.value || '';
        const status = document.getElementById('userStatusFilter')?.value || '';

        const data = await AdminAPI.getUsers(page, 20, search, role, status);

        if (!data.ok) {
            showAlert('Failed to load users', 'danger');
            return;
        }

        renderUsersTable(data.users);
        renderPagination(data.pagination, 'users', 'user');

    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users', 'danger');
    }
}

function renderUsersTable(users) {
    let html = '';
    for (const user of users) {
        const statusBadge = user.is_active
            ? '<span class="badge status-active">Active</span>'
            : '<span class="badge status-suspended">Suspended</span>';

        html += `
            <tr>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td><span class="badge bg-secondary">${user.role}</span></td>
                <td>${statusBadge}</td>
                <td>${user.station_count}</td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    ${user.is_active
            ? `<button class="btn btn-sm btn-outline-danger btn-action" onclick="openUserActionModal('suspend', ${user.user_id}, '${user.name}')">Suspend</button>`
            : `<button class="btn btn-sm btn-outline-success btn-action" onclick="openUserActionModal('activate', ${user.user_id}, '${user.name}')">Activate</button>`
            }
                    <button class="btn btn-sm btn-outline-danger btn-action" onclick="openUserActionModal('delete', ${user.user_id}, '${user.name}')">Delete</button>
                </td>
            </tr>
        `;
    }
    document.getElementById('usersTableBody').innerHTML = html;
}

function renderPagination(pagination, section, type) {
    let html = '';
    if (pagination.has_prev) {
        html += `<button onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}s(${pagination.page - 1})">← Prev</button>`;
    }
    for (let i = 1; i <= Math.min(pagination.total_pages, 5); i++) {
        html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}s(${i})">${i}</button>`;
    }
    if (pagination.has_next) {
        html += `<button onclick="load${type.charAt(0).toUpperCase() + type.slice(1)}s(${pagination.page + 1})">Next →</button>`;
    }
    document.getElementById(`${section}Pagination`).innerHTML = `<div class="pagination">${html}</div>`;
}

// User Actions
function openUserActionModal(action, userId, userName) {
    UIState.userActionData = { action, userId, userName };
    const modal = new bootstrap.Modal(document.getElementById('userActionModal'));
    document.getElementById('userActionTitle').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} User`;
    document.getElementById('userActionMessage').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} user "${userName}"?`;
    document.getElementById('userActionReason').value = '';
    modal.show();
}

document.getElementById('confirmUserActionBtn').addEventListener('click', async () => {
    const { action, userId } = UIState.userActionData;
    const reason = document.getElementById('userActionReason').value.trim();

    if ((action === 'suspend' || action === 'delete') && !reason) {
        showAlert('Reason is required', 'warning');
        return;
    }

    try {
        const result = await AdminAPI.userAction(action, userId, reason);
        if (result.ok) {
            showAlert(`User ${action}ed successfully`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('userActionModal')).hide();
            loadUsers(UIState.userPage);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error performing action:', error);
        showAlert('Error performing action', 'danger');
    }
});

// Stations Management
async function loadStations(page = 1) {
    try {
        UIState.stationPage = page;
        const search = document.getElementById('stationSearch')?.value || '';
        const status = document.getElementById('stationStatusFilter')?.value || '';

        const data = await AdminAPI.getStations(page, 20, search, status);

        if (!data.ok) {
            showAlert('Failed to load stations', 'danger');
            return;
        }

        renderStationsTable(data.stations);
        renderPagination(data.pagination, 'stations', 'station');

    } catch (error) {
        console.error('Error loading stations:', error);
        showAlert('Error loading stations', 'danger');
    }
}

function renderStationsTable(stations) {
    let html = '';
    for (const station of stations) {
        const statusBadge = `<span class="badge status-${station.approval_status}">${station.approval_status.charAt(0).toUpperCase() + station.approval_status.slice(1)}</span>`;
        const petrol = station.fuel_availability.petrol ? '<span class="fuel-badge available">✓ Petrol</span>' : '<span class="fuel-badge">✗ Petrol</span>';
        const diesel = station.fuel_availability.diesel ? '<span class="fuel-badge available">✓ Diesel</span>' : '<span class="fuel-badge">✗ Diesel</span>';

        let actions = '';
        if (station.approval_status === 'pending') {
            actions = `
                <button class="btn btn-sm btn-success btn-action" onclick="openStationActionModal('approve', ${station.station_id}, '${station.station_name}')">Approve</button>
                <button class="btn btn-sm btn-danger btn-action" onclick="openStationActionModal('reject', ${station.station_id}, '${station.station_name}')">Reject</button>
            `;
        }

        html += `
            <tr>
                <td><strong>${station.station_name}</strong></td>
                <td>${station.owner ? station.owner.name : '—'}</td>
                <td>${station.location}</td>
                <td>${statusBadge}</td>
                <td>${station.queue_length} (${station.waiting_time} min)</td>
                <td>${petrol} ${diesel}</td>
                <td>${actions}</td>
            </tr>
        `;
    }
    document.getElementById('stationsTableBody').innerHTML = html;
}

function openStationActionModal(action, stationId, stationName) {
    UIState.stationActionData = { action, stationId, stationName };
    const modal = new bootstrap.Modal(document.getElementById('stationActionModal'));
    document.getElementById('stationActionTitle').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} Station`;
    document.getElementById('stationActionMessage').textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} station "${stationName}"?`;
    document.getElementById('stationActionReason').value = '';
    if (action === 'reject') {
        document.getElementById('stationActionReason').placeholder = 'Rejection reason (required)';
    }
    modal.show();
}

document.getElementById('confirmStationActionBtn').addEventListener('click', async () => {
    const { action, stationId } = UIState.stationActionData;
    const reason = document.getElementById('stationActionReason').value.trim();

    if (action === 'reject' && !reason) {
        showAlert('Rejection reason is required', 'warning');
        return;
    }

    try {
        const result = await AdminAPI.stationAction(action, stationId, reason);
        if (result.ok) {
            showAlert(`Station ${action}ed successfully`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('stationActionModal')).hide();
            loadStations(UIState.stationPage);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Error performing action:', error);
        showAlert('Error performing action', 'danger');
    }
});

// Reports Management
async function loadReports(page = 1) {
    try {
        UIState.reportPage = page;
        const search = document.getElementById('reportSearch')?.value || '';
        const status = document.getElementById('reportStatusFilter')?.value || '';

        const data = await AdminAPI.getReports(page, 20, search, status);

        if (!data.ok) {
            showAlert('Failed to load reports', 'danger');
            return;
        }

        renderReportsTable(data.reports);
        renderPagination(data.pagination, 'reports', 'report');

    } catch (error) {
        console.error('Error loading reports:', error);
        showAlert('Error loading reports', 'danger');
    }
}

function renderReportsTable(reports) {
    let html = '';
    for (const report of reports) {
        const statusMap = {
            'pending': 'warning',
            'reviewed': 'info',
            'resolved': 'success',
            'spam': 'secondary',
        };
        const statusBadge = `<span class="badge bg-${statusMap[report.status] || 'secondary'}">${report.status}</span>`;

        html += `
            <tr>
                <td>#${report.report_id}</td>
                <td>${report.reporter.name}</td>
                <td>${report.station?.station_name || '—'}</td>
                <td><small>${report.comment.substring(0, 50)}...</small></td>
                <td>${statusBadge}</td>
                <td>${formatDate(report.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-primary btn-action" onclick="openReportModal(${JSON.stringify(report).replace(/"/g, '&quot;')})">Review</button>
                </td>
            </tr>
        `;
    }
    document.getElementById('reportsTableBody').innerHTML = html;
}

function openReportModal(report) {
    UIState.reportActionData = report;
    const modal = new bootstrap.Modal(document.getElementById('reportActionModal'));

    let details = `
        <h6>Report #${report.report_id}</h6>
        <p><strong>Reporter:</strong> ${report.reporter.name} (${report.reporter.email})</p>
        <p><strong>Station:</strong> ${report.station?.station_name || '—'}</p>
        <p><strong>Fuel Type:</strong> ${report.fuel_type || '—'}</p>
        <p><strong>Queue Length:</strong> ${report.queue_length || '—'}</p>
        <p><strong>Waiting Time:</strong> ${report.waiting_time || '—'} min</p>
        <p><strong>Comment:</strong></p>
        <p style="background:#f5f5f5; padding:0.5rem; border-radius:4px;">${report.comment}</p>
        <p><strong>Status:</strong> <span class="badge">${report.status}</span></p>
        ${report.admin_notes ? `<p><strong>Admin Notes:</strong> ${report.admin_notes}</p>` : ''}
    `;

    document.getElementById('reportDetails').innerHTML = details;
    document.getElementById('reportAdminNotes').value = report.admin_notes || '';

    modal.show();
}

document.getElementById('reportSpamBtn').addEventListener('click', async () => {
    const notes = document.getElementById('reportAdminNotes').value.trim();
    try {
        const result = await AdminAPI.reportAction('spam', UIState.reportActionData.report_id, notes);
        if (result.ok) {
            showAlert('Report marked as spam', 'success');
            bootstrap.Modal.getInstance(document.getElementById('reportActionModal')).hide();
            loadReports(UIState.reportPage);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        showAlert('Error marking report as spam', 'danger');
    }
});

document.getElementById('reportResolveBtn').addEventListener('click', async () => {
    const notes = document.getElementById('reportAdminNotes').value.trim();
    try {
        const result = await AdminAPI.reportAction('resolve', UIState.reportActionData.report_id, notes);
        if (result.ok) {
            showAlert('Report resolved', 'success');
            bootstrap.Modal.getInstance(document.getElementById('reportActionModal')).hide();
            loadReports(UIState.reportPage);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        showAlert('Error resolving report', 'danger');
    }
});

// Audit Logs
async function loadAuditLogs(page = 1) {
    try {
        UIState.auditPage = page;
        const data = await AdminAPI.getAuditLogs(page, 20);

        if (!data.ok) {
            showAlert('Failed to load audit logs', 'danger');
            return;
        }

        renderAuditTable(data.logs);
        renderPagination(data.pagination, 'audit', 'audit');

    } catch (error) {
        console.error('Error loading audit logs:', error);
        showAlert('Error loading audit logs', 'danger');
    }
}

function renderAuditTable(logs) {
    let html = '';
    for (const log of logs) {
        html += `
            <tr>
                <td>${log.admin.name}</td>
                <td><code>${log.action_type}</code></td>
                <td><small>${log.entity_type} #${log.entity_id}</small></td>
                <td><small>${log.description.substring(0, 60)}...</small></td>
                <td><small>${log.ip_address || '—'}</small></td>
                <td><small>${formatTimeAgo(log.created_at)}</small></td>
            </tr>
        `;
    }
    document.getElementById('auditTableBody').innerHTML = html;
}

// Alerts
async function loadAlerts(page = 1) {
    try {
        UIState.alertPage = page;
        const data = await AdminAPI.getAlerts(page, 20);

        if (!data.ok) {
            showAlert('Failed to load alerts', 'danger');
            return;
        }

        renderAlertsTable(data.alerts);

    } catch (error) {
        console.error('Error loading alerts:', error);
        showAlert('Error loading alerts', 'danger');
    }
}

function renderAlertsTable(alerts) {
    let html = '';
    for (const alert of alerts) {
        const acknowledged = alert.is_acknowledged
            ? `<span class="badge bg-success">Acknowledged</span>`
            : `<span class="badge bg-warning">Pending</span>`;

        html += `
            <tr>
                <td><span class="badge bg-danger">${alert.severity}</span></td>
                <td><strong>${alert.title}</strong></td>
                <td>${alert.message}</td>
                <td>${formatTimeAgo(alert.created_at)}</td>
                <td>${acknowledged}</td>
                <td>
                    ${!alert.is_acknowledged ? `<button class="btn btn-sm btn-success btn-action" onclick="acknowledgeAlert(${alert.alert_id})">Acknowledge</button>` : ''}
                    <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteAlert(${alert.alert_id})">Delete</button>
                </td>
            </tr>
        `;
    }
    document.getElementById('alertsTableBody').innerHTML = html;
}

async function acknowledgeAlert(alertId) {
    try {
        const result = await AdminAPI.alertAction('acknowledge', alertId);
        if (result.ok) {
            loadAlerts(UIState.alertPage);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        showAlert('Error acknowledging alert', 'danger');
    }
}

async function deleteAlert(alertId) {
    try {
        const result = await AdminAPI.alertAction('delete', alertId);
        if (result.ok) {
            loadAlerts(UIState.alertPage);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        showAlert('Error deleting alert', 'danger');
    }
}

// Event Listeners
document.getElementById('userRefreshBtn')?.addEventListener('click', () => loadUsers(1));
document.getElementById('stationRefreshBtn')?.addEventListener('click', () => loadStations(1));
document.getElementById('reportRefreshBtn')?.addEventListener('click', () => loadReports(1));
document.getElementById('auditRefreshBtn')?.addEventListener('click', () => loadAuditLogs(1));
document.getElementById('alertRefreshBtn')?.addEventListener('click', () => loadAlerts(1));

document.getElementById('userSearch')?.addEventListener('change', () => loadUsers(1));
document.getElementById('userRoleFilter')?.addEventListener('change', () => loadUsers(1));
document.getElementById('userStatusFilter')?.addEventListener('change', () => loadUsers(1));

document.getElementById('stationSearch')?.addEventListener('change', () => loadStations(1));
document.getElementById('stationStatusFilter')?.addEventListener('change', () => loadStations(1));

document.getElementById('reportSearch')?.addEventListener('change', () => loadReports(1));
document.getElementById('reportStatusFilter')?.addEventListener('change', () => loadReports(1));

// Export buttons
document.getElementById('exportUsersBtn')?.addEventListener('click', () => AdminAPI.exportCSV('users'));

// Acknowledge all alerts
document.getElementById('acknowledgeAllBtn')?.addEventListener('click', async () => {
    try {
        const result = await AdminAPI.alertAction('acknowledge_all');
        if (result.ok) {
            showAlert('All alerts acknowledged', 'success');
            loadAlerts(1);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        showAlert('Error acknowledging alerts', 'danger');
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('../backend/logout.php', { method: 'POST' });
        window.location.href = 'login.html';
    } catch (error) {
        showAlert('Error logging out', 'danger');
    }
});

// Check authentication and load initial data
window.addEventListener('load', async () => {
    // Get user info (if logged in)
    try {
        const response = await fetch('../backend/stations.php');
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }

    // Set admin name from session (if available)
    const adminName = localStorage.getItem('adminName') || 'Admin';
    document.getElementById('adminName').textContent = adminName;

    // Load dashboard
    loadDashboard();
});
