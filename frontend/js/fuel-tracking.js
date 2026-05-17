/**
 * Fuel Tracking & Analytics JavaScript
 * Handles fuel entry form, calculations, analytics display, and charts
 */

/** Relative to frontend/*.html (same pattern as dashboard.js / auth.js). */
const FUEL_API_BASE = '../backend';

let chartsInstances = {
  monthlyCost: null,
  fuelDistribution: null,
  monthlyUsage: null,
  efficiency: null,
};

let stationsCache = [];

/**
 * Extract a user-facing message from apiGet/apiPostJson thrown payloads.
 */
function fuelApiErrorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.message || fallback;
}

/**
 * Parse optional station_id from form/API (empty string -> null).
 */
function parseOptionalStationId(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const id = parseInt(String(raw), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Initialize fuel tracking on page load
 */
function initFuelTracking() {
  // Load stations for dropdown
  loadStationsForFuelForm();

  // Tab switching
  document.getElementById('tabFindStations')?.addEventListener('click', () => switchTab('stations'));
  document.getElementById('tabFuelTracking')?.addEventListener('click', () => switchTab('fuel-tracking'));

  // Form handling
  document.getElementById('fuelEntryForm')?.addEventListener('submit', handleFuelFormSubmit);
  document.getElementById('fuelFormReset')?.addEventListener('click', () => {
    document.getElementById('fuelEntryForm')?.reset();
  });

  // Auto-calculate total cost
  const litersInput = document.getElementById('fuelLiters');
  const priceInput = document.getElementById('pricePerLiter');
  const totalCostInput = document.getElementById('totalCost');

  const calculateTotal = () => {
    const liters = parseFloat(litersInput?.value || 0);
    const price = parseFloat(priceInput?.value || 0);
    if (liters > 0 && price > 0) {
      const total = (liters * price).toFixed(2);
      totalCostInput.value = total;
    } else {
      totalCostInput.value = '';
    }
  };

  litersInput?.addEventListener('input', calculateTotal);
  priceInput?.addEventListener('input', calculateTotal);

  // Apply filters button listener
  document.getElementById('btnApplyFilters')?.addEventListener('click', () => {
    fuelHistoryPage = 1;
    loadFuelHistory();
  });

  // Save edit log modal button listener
  document.getElementById('saveEditFuelLogBtn')?.addEventListener('click', handleEditFuelLogSubmit);

  // Load fuel prices from admin settings
  loadFuelPrices();

  // Load analytics
  loadFuelAnalytics();

  // Auto-refresh analytics every 30 seconds
  setInterval(loadFuelAnalytics, 30000);
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  const stationsView = document.getElementById('stationsView');
  const fuelTrackingView = document.getElementById('fuelTrackingView');
  const tabFindStations = document.getElementById('tabFindStations');
  const tabFuelTracking = document.getElementById('tabFuelTracking');

  if (tabName === 'stations') {
    stationsView.style.display = '';
    fuelTrackingView.style.display = 'none';
    tabFindStations.classList.add('active');
    tabFuelTracking.classList.remove('active');
  } else if (tabName === 'fuel-tracking') {
    stationsView.style.display = 'none';
    fuelTrackingView.style.display = '';
    tabFindStations.classList.remove('active');
    tabFuelTracking.classList.add('active');
    if (stationsCache.length === 0) {
      loadStationsForFuelForm();
    }
    loadFuelAnalytics();
  }
}

/**
 * Populate station <select> elements (add form + history filter).
 */
function populateStationDropdowns(stations) {
  const stationSelect = document.getElementById('fuelStation');
  const filterStation = document.getElementById('filterStation');

  const list = Array.isArray(stations) ? stations : [];

  if (stationSelect) {
    stationSelect.disabled = false;
    if (list.length === 0) {
      stationSelect.innerHTML = '<option value="">No stations available</option>';
    } else {
      stationSelect.innerHTML = '<option value="">Select a station...</option>';
      list.forEach((station) => {
        const option = document.createElement('option');
        option.value = station.station_id;
        option.textContent = station.station_name;
        stationSelect.appendChild(option);
      });
    }
  }

  if (filterStation) {
    filterStation.disabled = false;
    filterStation.innerHTML = '<option value="">All Stations</option>';
    list.forEach((station) => {
      const option = document.createElement('option');
      option.value = station.station_id;
      option.textContent = station.station_name;
      filterStation.appendChild(option);
    });
  }
}

/**
 * Load stations for dropdown
 */
function loadStationsForFuelForm() {
  const stationSelect = document.getElementById('fuelStation');
  const filterStation = document.getElementById('filterStation');

  if (stationSelect) {
    stationSelect.disabled = true;
    stationSelect.innerHTML = '<option value="">Loading stations...</option>';
  }
  if (filterStation) {
    filterStation.disabled = true;
    filterStation.innerHTML = '<option value="">Loading...</option>';
  }

  apiGet(`${FUEL_API_BASE}/stations.php?limit=50`)
    .then((data) => {
      if (data.ok && Array.isArray(data.stations)) {
        stationsCache = data.stations;
        populateStationDropdowns(data.stations);
      } else {
        console.error('Stations API unexpected response:', data);
        populateStationDropdowns([]);
      }
    })
    .catch((err) => {
      console.error('Failed to load stations:', err);
      const msg = fuelApiErrorMessage(err, 'Could not load stations');
      if (stationSelect) {
        stationSelect.disabled = false;
        stationSelect.innerHTML = `<option value="">${msg}</option>`;
      }
      if (filterStation) {
        filterStation.disabled = false;
        filterStation.innerHTML = '<option value="">All Stations</option>';
      }
    });
}

/**
 * Load fuel prices and populate form
 */
function loadFuelPrices() {
  apiGet(`${FUEL_API_BASE}/fuel-prices-api.php`)
    .then((data) => {
      if (data.ok && data.prices) {
        // Store prices in window for later use
        window.fuelPrices = {};
        data.prices.forEach((price) => {
          window.fuelPrices[price.fuel_type_id] = price.current_price;
        });

        // Auto-fill price when fuel type is selected
        const fuelTypeSelect = document.getElementById('fuelType');
        const priceInput = document.getElementById('pricePerLiter');

        fuelTypeSelect?.addEventListener('change', () => {
          const selectedFuelTypeId = parseInt(fuelTypeSelect.value);
          if (window.fuelPrices[selectedFuelTypeId]) {
            priceInput.value = window.fuelPrices[selectedFuelTypeId];
            // Trigger calculation
            priceInput.dispatchEvent(new Event('input'));
          }
        });
      }
    })
    .catch((err) => console.error('Failed to load fuel prices:', err));
}

/**
 * Handle fuel entry form submission
 */
function handleFuelFormSubmit(e) {
  e.preventDefault();

  const formEl = document.getElementById('fuelEntryForm');
  const formData = new FormData(formEl);
  const odometerRaw = formData.get('odometer_reading');
  const data = {
    fuel_type_id: parseInt(formData.get('fuel_type_id'), 10),
    liters: parseFloat(formData.get('liters')),
    price_per_liter: parseFloat(formData.get('price_per_liter')),
    odometer_reading:
      odometerRaw !== null && String(odometerRaw).trim() !== ''
        ? parseInt(String(odometerRaw), 10)
        : null,
    station_id: parseOptionalStationId(formData.get('station_id')),
    notes: String(formData.get('notes') || '').trim(),
  };

  // Validation
  if (!Number.isFinite(data.fuel_type_id) || data.fuel_type_id <= 0) {
    showFormMessage('Please select a fuel type', 'danger');
    return;
  }
  if (!Number.isFinite(data.liters) || data.liters <= 0) {
    showFormMessage('Liters must be greater than 0', 'danger');
    return;
  }
  if (!Number.isFinite(data.price_per_liter) || data.price_per_liter <= 0) {
    showFormMessage('Price per liter must be greater than 0', 'danger');
    return;
  }
  if (data.odometer_reading !== null && (!Number.isFinite(data.odometer_reading) || data.odometer_reading < 0)) {
    showFormMessage('Odometer reading must be a valid non-negative number', 'danger');
    return;
  }

  const submitBtn = document.querySelector('#fuelEntryForm button[type="submit"]');
  const defaultBtnHtml = '<i class="fa-solid fa-plus me-2"></i>Add Fuel Entry';
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Adding...';

  apiPostJson(`${FUEL_API_BASE}/fuel-usage-api.php`, data)
    .then((response) => {
      showFormMessage(response.message || 'Fuel entry added successfully!', 'success');
      formEl.reset();
      document.getElementById('totalCost').value = '';
      setTimeout(() => loadFuelAnalytics(), 500);
    })
    .catch((err) => {
      showFormMessage(fuelApiErrorMessage(err, 'Failed to add fuel entry'), 'danger');
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = defaultBtnHtml;
    });
}

/**
 * Show form message
 */
function showFormMessage(message, type) {
  const messageEl = document.getElementById('fuelFormMessage');
  messageEl.className = `alert alert-${type}`;
  messageEl.textContent = message;
  messageEl.classList.remove('d-none');

  setTimeout(() => {
    messageEl.classList.add('d-none');
  }, 4000);
}

/**
 * Load fuel analytics and update dashboard
 */
function loadFuelAnalytics() {
  apiGet(`${FUEL_API_BASE}/fuel-analytics-api.php`)
    .then((data) => {
      if (data.ok) {
        updateMetrics(data.metrics);
        loadFuelHistory();
        renderCharts(data.metrics, data.fuel_breakdown, data.monthly_trend);
      }
    })
    .catch((err) => console.error('Failed to load analytics:', err));
}

/**
 * Update metric cards
 */
function updateMetrics(metrics) {
  document.getElementById('metricTotalLiters').textContent = (metrics.total_liters || 0).toFixed(2);
  document.getElementById('metricTotalSpent').textContent = (metrics.total_spent || 0).toFixed(2);
  document.getElementById('metricTotalDistance').textContent = (metrics.total_distance || 0).toLocaleString();

  if (metrics.avg_efficiency) {
    document.getElementById('metricAvgEfficiency').textContent = metrics.avg_efficiency.toFixed(2);
  } else {
    document.getElementById('metricAvgEfficiency').textContent = '--';
  }
}



/**
 * Render charts
 */
function renderCharts(metrics, fuelBreakdown, monthlyTrend) {
  renderMonthlyCostChart(monthlyTrend);
  renderFuelDistributionChart(fuelBreakdown);
  renderMonthlyUsageChart(monthlyTrend);
  renderEfficiencyChart(monthlyTrend);
}

/**
 * Render monthly spending trend chart
 */
function renderMonthlyCostChart(monthlyTrend) {
  const ctx = document.getElementById('chartMonthlyCost');
  if (!ctx) return;

  const labels = monthlyTrend.map((m) => m.month);
  const data = monthlyTrend.map((m) => m.cost);

  // Destroy existing chart
  if (chartsInstances.monthlyCost) {
    chartsInstances.monthlyCost.destroy();
  }

  chartsInstances.monthlyCost = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Monthly Spending (LKR)',
          data: data,
          borderColor: '#FF6B35',
          backgroundColor: 'rgba(255, 107, 53, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#FF6B35',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => 'LKR ' + value,
          },
        },
      },
    },
  });
}

/**
 * Render fuel type distribution chart
 */
function renderFuelDistributionChart(fuelBreakdown) {
  const ctx = document.getElementById('chartFuelDistribution');
  if (!ctx) return;

  if (!fuelBreakdown || fuelBreakdown.length === 0) {
    ctx.parentElement.innerHTML = '<p class="text-muted text-center py-4">No fuel data available</p>';
    return;
  }

  const labels = fuelBreakdown.map((f) => f.fuel_name);
  const data = fuelBreakdown.map((f) => f.total_liters);

  // Destroy existing chart
  if (chartsInstances.fuelDistribution) {
    chartsInstances.fuelDistribution.destroy();
  }

  chartsInstances.fuelDistribution = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: ['#0D7377', '#14FFEC', '#FF6B35'],
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
        },
      },
    },
  });
}

/**
 * Render monthly fuel usage chart
 */
function renderMonthlyUsageChart(monthlyTrend) {
  const ctx = document.getElementById('chartMonthlyUsage');
  if (!ctx) return;

  const labels = monthlyTrend.map((m) => m.month);
  const data = monthlyTrend.map((m) => m.liters);

  // Destroy existing chart
  if (chartsInstances.monthlyUsage) {
    chartsInstances.monthlyUsage.destroy();
  }

  chartsInstances.monthlyUsage = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Monthly Fuel Usage (Liters)',
          data: data,
          backgroundColor: 'rgba(13, 115, 119, 0.8)',
          borderColor: '#0D7377',
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value + ' L',
          },
        },
      },
    },
  });
}

/**
 * Render fuel efficiency trend chart
 */
function renderEfficiencyChart(monthlyTrend) {
  const ctx = document.getElementById('chartEfficiency');
  if (!ctx) return;

  const labels = monthlyTrend.map((m) => m.month);
  const data = monthlyTrend.map((m) => (m.avg_efficiency ? parseFloat(m.avg_efficiency).toFixed(2) : 0));

  // Destroy existing chart
  if (chartsInstances.efficiency) {
    chartsInstances.efficiency.destroy();
  }

  chartsInstances.efficiency = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Average Efficiency (km/L)',
          data: data,
          borderColor: '#2D6A4F',
          backgroundColor: 'rgba(45, 106, 79, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#2D6A4F',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value + ' km/L',
          },
        },
      },
    },
  });
}

let fuelHistoryPage = 1;
const fuelHistoryLimit = 5;

/**
 * Load fuel history logs with pagination and filters
 */
function loadFuelHistory() {
  const month = document.getElementById('filterMonth')?.value || '';
  const fuelType = document.getElementById('filterFuelType')?.value || '';
  const station = document.getElementById('filterStation')?.value || '';

  const params = new URLSearchParams({
    page: fuelHistoryPage,
    limit: fuelHistoryLimit,
    month: month,
    fuel_type_id: fuelType,
    station_id: station
  });

  apiGet(`${FUEL_API_BASE}/fuel-usage-api.php?${params.toString()}`)
    .then((data) => {
      if (data.ok) {
        window.recentFuelLogs = data.logs; // Store globally for editing
        renderFuelHistoryTable(data.logs);
        renderFuelHistoryPagination(data.pagination);
      }
    })
    .catch((err) => console.error('Failed to load fuel history:', err));
}

/**
 * Render fuel logs into the history table
 */
function renderFuelHistoryTable(logs) {
  const tbody = document.getElementById('fuelLogsTableBody');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No matching fuel entries found</td></tr>';
    return;
  }

  tbody.innerHTML = logs
    .map((log) => {
      const date = new Date(log.created_at).toLocaleDateString();
      const efficiency = log.fuel_efficiency ? log.fuel_efficiency.toFixed(2) : '--';

      return `
        <tr>
          <td>${date}</td>
          <td><span class="fuel-type-badge">${log.fuel_name}</span></td>
          <td>${log.liters.toFixed(2)} L</td>
          <td><span class="cost-value">LKR ${log.total_cost.toFixed(2)}</span></td>
          <td><span class="efficiency-value">${efficiency} km/L</span></td>
          <td>
            <button class="btn btn-sm btn-outline-secondary" onclick="editFuelLog(${log.log_id})" title="Edit">
              <i class="fa-solid fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteFuelLog(${log.log_id})" title="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Render history table pagination controls
 */
function renderFuelHistoryPagination(pagination) {
  const infoEl = document.getElementById('fuelHistoryPaginationInfo');
  const pagEl = document.getElementById('fuelHistoryPagination');
  if (!pagEl) return;

  const total = pagination.total;
  const page = pagination.page;
  const totalPages = pagination.total_pages;

  if (infoEl) {
    const start = total === 0 ? 0 : (page - 1) * fuelHistoryLimit + 1;
    const end = Math.min(page * fuelHistoryLimit, total);
    infoEl.textContent = `Showing ${start} to ${end} of ${total} entries`;
  }

  let html = '';
  if (totalPages <= 1) {
    pagEl.innerHTML = '';
    return;
  }

  // Previous button
  html += `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <button class="page-link" onclick="changeFuelHistoryPage(${page - 1})" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
      </button>
    </li>
  `;

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    html += `
      <li class="page-item ${page === i ? 'active' : ''}">
        <button class="page-link" onclick="changeFuelHistoryPage(${i})">${i}</button>
      </li>
    `;
  }

  // Next button
  html += `
    <li class="page-item ${page === totalPages ? 'disabled' : ''}">
      <button class="page-link" onclick="changeFuelHistoryPage(${page + 1})" aria-label="Next">
        <span aria-hidden="true">&raquo;</span>
      </button>
    </li>
  `;

  pagEl.innerHTML = html;
}

/**
 * Change current history page
 */
function changeFuelHistoryPage(page) {
  fuelHistoryPage = page;
  loadFuelHistory();
}

/**
 * Open edit fuel entry modal and populate inputs
 */
function editFuelLog(logId) {
  const log = window.recentFuelLogs?.find(l => l.log_id === logId);
  if (!log) return;

  document.getElementById('editLogId').value = log.log_id;
  document.getElementById('editFuelType').value = log.fuel_type_id;
  document.getElementById('editFuelLiters').value = log.liters;
  document.getElementById('editPricePerLiter').value = log.price_per_liter;
  document.getElementById('editOdometerReading').value = log.odometer_reading || '';
  document.getElementById('editFuelNotes').value = log.notes || '';

  // Clear previous message
  const msgEl = document.getElementById('editFuelFormMessage');
  if (msgEl) msgEl.classList.add('d-none');

  // Open the bootstrap modal
  const modalEl = document.getElementById('editFuelLogModal');
  const editModal = new bootstrap.Modal(modalEl);
  editModal.show();
}

/**
 * Handle submission of edit fuel entry form
 */
function handleEditFuelLogSubmit() {
  const logId = parseInt(document.getElementById('editLogId').value);
  const liters = parseFloat(document.getElementById('editFuelLiters').value);
  const price = parseFloat(document.getElementById('editPricePerLiter').value);
  const odometer = document.getElementById('editOdometerReading').value ? parseInt(document.getElementById('editOdometerReading').value) : null;
  const notes = document.getElementById('editFuelNotes').value;

  if (isNaN(liters) || liters <= 0) {
    showEditFormMessage('Liters must be positive', 'danger');
    return;
  }
  if (isNaN(price) || price <= 0) {
    showEditFormMessage('Price must be positive', 'danger');
    return;
  }

  const saveBtn = document.getElementById('saveEditFuelLogBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Saving...';

  const params = new URLSearchParams();
  params.append('log_id', logId.toString());
  params.append('liters', liters.toString());
  params.append('price_per_liter', price.toString());
  if (odometer !== null) params.append('odometer_reading', odometer.toString());
  params.append('notes', notes);

  fetch(`${FUEL_API_BASE}/fuel-usage-api.php`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: params.toString()
  })
  .then(res => res.json())
  .then(response => {
    if (response.ok) {
      showEditFormMessage('Fuel entry updated successfully!', 'success');
      setTimeout(() => {
        const modalEl = document.getElementById('editFuelLogModal');
        // Hide Bootstrap modal cleanly
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal?.hide();
        // Force backdrop removal if it sticks
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        
        loadFuelAnalytics();
      }, 1000);
    } else {
      showEditFormMessage(response.message || 'Failed to update entry', 'danger');
    }
  })
  .catch(err => {
    showEditFormMessage('Error: ' + err.message, 'danger');
  })
  .finally(() => {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Changes';
  });
}

/**
 * Show edit fuel entry form message
 */
function showEditFormMessage(message, type) {
  const messageEl = document.getElementById('editFuelFormMessage');
  if (!messageEl) return;
  messageEl.className = `alert alert-${type} mt-3`;
  messageEl.textContent = message;
  messageEl.classList.remove('d-none');

  setTimeout(() => {
    messageEl.classList.add('d-none');
  }, 4000);
}

/**
 * Handle deletion of fuel entry log
 */
function deleteFuelLog(logId) {
  if (!confirm('Are you sure you want to delete this fuel log entry?')) {
    return;
  }

  const params = new URLSearchParams();
  params.append('log_id', logId.toString());

  fetch(`${FUEL_API_BASE}/fuel-usage-api.php`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: params.toString()
  })
  .then(res => res.json())
  .then(response => {
    if (response.ok) {
      alert('Fuel entry deleted successfully!');
      loadFuelAnalytics();
    } else {
      alert(response.message || 'Failed to delete entry');
    }
  })
  .catch(err => {
    alert('Error: ' + err.message);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFuelTracking);
} else {
  initFuelTracking();
}
