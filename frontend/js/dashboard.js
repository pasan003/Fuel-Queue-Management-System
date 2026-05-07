/**
 * Customer dashboard: loads station cards from PHP + MySQL via stations.php.
 */

/** Demo fallback if API is unreachable (offline dev only). */
const FALLBACK_STATIONS = [
  {
    station_id: 1,
    station_name: "Demo Station (offline)",
    location: "Import database/fqms.sql and ensure MySQL is running",
    status: "limited",
    petrol: true,
    diesel: true,
    queue_length: 0,
    waiting_time: 0,
    last_updated_iso: null,
  },
];

const state = { query: "", filter: "all", stations: [], loadError: null };

// Leaflet map references for user dashboard
let userMap = null;
let userMarkersLayer = null;
let userMarkerIcons = null;

function isValidLatLng(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a < -90 || a > 90) return false;
  if (b < -180 || b > 180) return false;
  return true;
}

function getFuelText(s) {
  const p = Boolean(s.petrol);
  const d = Boolean(s.diesel);
  if (p && d) return "Petrol & Diesel";
  if (p) return "Petrol";
  if (d) return "Diesel";
  return "None";
}

function getAvailabilityText(s) {
  const any = Boolean(s.petrol) || Boolean(s.diesel);
  return any ? "Yes" : "No";
}

function getMarkerIcons() {
  if (userMarkerIcons) return userMarkerIcons;
  if (typeof L === "undefined") return null;

  function icon(className) {
    return L.divIcon({
      className: `fqms-marker ${className}`,
      html: '<span class="fqms-marker__dot" aria-hidden="true"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
  }

  userMarkerIcons = {
    available: icon("fqms-marker--available"),
    limited: icon("fqms-marker--limited"),
    nofuel: icon("fqms-marker--nofuel"),
    fallback: icon("fqms-marker--limited"),
  };
  return userMarkerIcons;
}

function initUserMap() {
  const el = document.getElementById('mapUser');
  if (!el || typeof L === 'undefined') return;

  // Sri Lanka default (Colombo) — zoomed out enough to show island context.
  const defaultCenter = [6.9271, 79.8612];
  try {
    if (!userMap) {
      userMap = L.map(el).setView(defaultCenter, 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(userMap);
      userMarkersLayer = L.layerGroup().addTo(userMap);
      // Ensure proper sizing when layout/animations finish.
      setTimeout(() => {
        try { userMap?.invalidateSize(); } catch (_) {}
      }, 50);
    } else {
      userMap.setView(defaultCenter, 7);
    }
  } catch (err) {
    console.warn('Leaflet init failed', err);
  }
}

function addMarkersFromState() {
  if (!userMap || !userMarkersLayer) return;
  userMarkersLayer.clearLayers();
  const icons = getMarkerIcons();
  const points = [];

  (state.stations || []).forEach((s) => {
    const lat = s.latitude ?? null;
    const lng = s.longitude ?? null;
    if (lat === null || lng === null) return;
    if (!isValidLatLng(lat, lng)) return;

    try {
      const status = String(s.status || "");
      const icon =
        (icons && (status === "available" || status === "limited" || status === "nofuel"))
          ? icons[status]
          : (icons?.fallback || undefined);

      const marker = L.marker([Number(lat), Number(lng)], icon ? { icon } : undefined);
      const popupHtml = [
        `<div class="fqms-popup">`,
        `<div class="fqms-popup__title">${escapeHtml(s.station_name)}</div>`,
        s.location ? `<div class="fqms-popup__meta"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.location)}</div>` : ``,
        `<div class="fqms-popup__row"><strong>Fuel</strong>: ${escapeHtml(getFuelText(s))}</div>`,
        `<div class="fqms-popup__row"><strong>Queue</strong>: ${Number(s.queue_length ?? 0)} Vehicles</div>`,
        `<div class="fqms-popup__row"><strong>Available</strong>: ${escapeHtml(getAvailabilityText(s))}</div>`,
        `</div>`,
      ].join("");

      marker.bindPopup(popupHtml);
      marker.addTo(userMarkersLayer);
      points.push([Number(lat), Number(lng)]);
    } catch (err) {
      // ignore invalid coords / leaflet issues per-station
    }
  });

  // Fit map view to markers when available; otherwise keep Sri Lanka default.
  try {
    if (points.length === 1) {
      userMap.setView(points[0], 13);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      userMap.fitBounds(bounds.pad(0.2), { animate: false });
    }
  } catch (_) {}
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"]/g, function (s) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]);
  });
}

function statusLabel(status) {
  if (status === "available") return "Available";
  if (status === "limited") return "Limited";
  return "No Fuel";
}

function filterLabel(filter) {
  if (filter === "all") return "All";
  return statusLabel(filter);
}

function statusIcon(status) {
  if (status === "available") return "fa-circle-check";
  if (status === "limited") return "fa-triangle-exclamation";
  return "fa-circle-xmark";
}

function statusClass(status) {
  if (status === "available") return "status-available";
  if (status === "limited") return "status-limited";
  return "status-nofuel";
}

function yesNoChip(value) {
  if (value) return `<span class="yes"><i class="fa-solid fa-check"></i> Yes</span>`;
  return `<span class="no"><i class="fa-solid fa-xmark"></i> No</span>`;
}

function formatQueue(queueLength) {
  return `${queueLength} vehicles`;
}

function formatWait(mins) {
  return mins === 0 ? "—" : `${mins} mins`;
}

/**
 * Determine wait time status for visual styling.
 * @param {number} waitTimeMinutes - Estimated wait time in minutes
 * @returns {object} {status, label, icon}
 */
function getWaitTimeStatus(waitTimeMinutes) {
  if (waitTimeMinutes === 0) {
    return { status: 'quick', label: 'Available Now', icon: 'fa-circle-check' };
  }
  if (waitTimeMinutes <= 15) {
    return { status: 'quick', label: 'Quick Wait', icon: 'fa-check' };
  }
  if (waitTimeMinutes <= 30) {
    return { status: 'normal', label: 'Moderate Wait', icon: 'fa-hourglass-half' };
  }
  return { status: 'long', label: 'Long Wait', icon: 'fa-hourglass-end' };
}

/** Human-readable relative time from MySQL ISO datetime. */
function formatLastUpdated(iso) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH === 1) return "1 hour ago";
  if (diffH < 24) return `${diffH} hours ago`;
  const diffD = Math.floor(diffH / 24);
  return diffD === 1 ? "Yesterday" : `${diffD} days ago`;
}

function stationCardHTML(station) {
  const last = formatLastUpdated(station.last_updated_iso);
  const id = station.station_id;
  const waitStatus = getWaitTimeStatus(station.waiting_time);
  
  return `
    <div class="col-12 col-lg-6">
      <div class="station-link" data-station-id="${id}">
        <div class="station-card">
          <div class="station-top">
            <div>
              <h3 class="station-name">${station.station_name}</h3>
              <div class="station-location">
                <i class="fa-solid fa-location-dot"></i>
                <span>${station.location || "—"}</span>
              </div>
            </div>
            <div class="status-pill ${statusClass(station.status)}">
              <i class="fa-solid ${statusIcon(station.status)}"></i>
              ${statusLabel(station.status)}
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta">
              <div class="k"><i class="fa-solid fa-gas-pump me-2"></i>Petrol</div>
              <div class="v">${yesNoChip(station.petrol)}</div>
            </div>
            <div class="meta">
              <div class="k"><i class="fa-solid fa-oil-can me-2"></i>Diesel</div>
              <div class="v">${yesNoChip(station.diesel)}</div>
            </div>
            <div class="meta queue-metric">
              <div class="k"><i class="fa-solid fa-people-line me-2"></i>Queue Length</div>
              <div class="queue-length-value">${station.queue_length}</div>
              <div class="meta-unit">vehicles waiting</div>
              <div style="margin-top: 8px;">
                <button class="update-queue-btn" type="button" data-update-queue="${id}" title="Update queue length">
                  <i class="fa-solid fa-edit"></i>Update
                </button>
              </div>
            </div>
            <div class="meta waiting-time-metric">
              <div class="k"><i class="fa-solid fa-clock me-2"></i>Est. Wait Time</div>
              <div class="waiting-time-value">${station.waiting_time === 0 ? '0' : station.waiting_time}</div>
              <div class="meta-unit">minutes</div>
              ${station.waiting_time > 0 ? `
              <div class="wait-status-badge ${waitStatus.status}">
                <i class="fa-solid ${waitStatus.icon}"></i>
                ${waitStatus.label}
              </div>
              ` : ''}
            </div>
          </div>

          <div class="divider"></div>

          <div class="station-bottom">
            <div class="last-updated">
              <i class="fa-regular fa-clock"></i>
              Last updated: <span>${last}</span>
            </div>
            <button class="cta" type="button" data-open="${id}">
              <i class="fa-solid fa-circle-info me-2"></i>Details
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function applyFilters() {
  const q = state.query.trim().toLowerCase();
  return state.stations.filter((s) => {
    const matchesQuery =
      q === "" ||
      String(s.station_name || "")
        .toLowerCase()
        .includes(q) ||
      String(s.location || "")
        .toLowerCase()
        .includes(q);

    const matchesFilter = state.filter === "all" || s.status === state.filter;
    return matchesQuery && matchesFilter;
  });
}

function wireOpenButtons(grid) {
  grid.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const id = Number(this.getAttribute("data-open"));
      const station = state.stations.find((x) => x.station_id === id);
      if (!station) return;
      alert(
        `Station: ${station.station_name}\n` +
          `Location: ${station.location || "—"}\n` +
          `Status: ${statusLabel(station.status)}\n` +
          `Petrol: ${station.petrol ? "Yes" : "No"}\n` +
          `Diesel: ${station.diesel ? "Yes" : "No"}\n` +
          `Queue: ${station.queue_length} vehicles\n` +
          `Waiting: ${station.waiting_time} mins\n` +
          `Last updated: ${formatLastUpdated(station.last_updated_iso)}`
      );
    });
  });
}

function wireUpdateQueueButtons(grid) {
  grid.querySelectorAll("[data-update-queue]").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const stationId = Number(this.getAttribute("data-update-queue"));
      const station = state.stations.find((x) => x.station_id === stationId);
      if (!station) return;
      openQueueUpdateModal(station);
    });
  });
}

function openQueueUpdateModal(station) {
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  const input = document.getElementById("queueUpdateInput");
  const errorEl = document.getElementById("queueUpdateError");
  
  if (!backdrop || !input) return;

  // Set initial value
  input.value = String(station.queue_length);
  errorEl.textContent = "";
  errorEl.classList.remove("show");

  backdrop.classList.add("active");
  input.focus();

  // Store station ID for later use
  backdrop.dataset.stationId = String(station.station_id);
  backdrop.dataset.stationName = station.station_name;
}

function closeQueueUpdateModal() {
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  if (backdrop) {
    backdrop.classList.remove("active");
    backdrop.dataset.stationId = "";
    backdrop.dataset.stationName = "";
  }
}

async function submitQueueUpdate() {
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  const input = document.getElementById("queueUpdateInput");
  const errorEl = document.getElementById("queueUpdateError");
  const submitBtn = document.getElementById("queueUpdateSubmit");

  if (!backdrop || !input) return;

  const stationId = Number(backdrop.dataset.stationId);
  const stationName = backdrop.dataset.stationName;
  const queueLength = Number(input.value);

  errorEl.textContent = "";
  errorEl.classList.remove("show");

  // Validation
  if (isNaN(queueLength) || queueLength < 0) {
    errorEl.textContent = "Queue length must be a non-negative number";
    errorEl.classList.add("show");
    return;
  }

  if (queueLength > 10000) {
    errorEl.textContent = "Queue length exceeds reasonable limit (max 10000)";
    errorEl.classList.add("show");
    return;
  }

  submitBtn.disabled = true;
  try {
    const response = await apiPostJson("../backend/update_queue.php", {
      station_id: stationId,
      queue_length: queueLength,
    });

    if (!response.ok) {
      throw new Error(response.message || "Failed to update queue");
    }

    // Update local state
    const station = state.stations.find((s) => s.station_id === stationId);
    if (station) {
      station.queue_length = response.queue_length;
      station.last_updated_iso = response.updated_at;
    }

    // Re-render the grid
    render();
    closeQueueUpdateModal();

    // Show success feedback
    submitBtn.innerHTML = '<i class="fa-solid fa-check me-2"></i>Updated!';
    setTimeout(() => {
      submitBtn.innerHTML = 'Update';
    }, 2000);
  } catch (err) {
    errorEl.textContent = err?.message || "Update failed";
    errorEl.classList.add("show");
  } finally {
    submitBtn.disabled = false;
  }
}

function render() {
  const grid = document.getElementById("stationsGrid");
  const emptyWrap = document.getElementById("emptyWrap");
  const resultsMeta = document.getElementById("resultsMeta");
  if (!grid || !emptyWrap || !resultsMeta) return;

  const filtered = applyFilters();
  grid.innerHTML = filtered.map(stationCardHTML).join("");

  let meta = `${filtered.length} station${filtered.length === 1 ? "" : "s"} • ${filterLabel(state.filter)}`;
  if (state.loadError) {
    meta += ` • ${state.loadError}`;
  }
  resultsMeta.textContent = meta;

  emptyWrap.classList.toggle("d-none", filtered.length !== 0);
  wireOpenButtons(grid);
  wireUpdateQueueButtons(grid);
  // update markers on the map to match filtered stations
  try { addMarkersFromState(); } catch (e) { /* ignore if map not initialized */ }
}

function setActiveFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === filter);
  });
  render();
}

async function loadStationsFromApi() {
  state.loadError = null;
  try {
    const data = await apiGet("../backend/stations.php");
    if (data.ok && Array.isArray(data.stations)) {
      state.stations = data.stations;
      // initialize map and markers after loading stations
      initUserMap();
      addMarkersFromState();
      return;
    }
    throw new Error(data.message || "Invalid response");
  } catch (err) {
    if (err && (err.message === "Authentication required" || String(err.message || "").includes("401"))) {
      clearUserSession();
      window.location.href = "login.html";
      return;
    }
    state.stations = FALLBACK_STATIONS;
    state.loadError = "Using offline preview — connect MySQL and log in";
    initUserMap();
    addMarkersFromState();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const userType = localStorage.getItem("userType");
  const username = localStorage.getItem("username");

  if (!userType || !username) {
    window.location.href = "login.html";
    return;
  }

  const demoName = username || "User";
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");
  if (nameEl) nameEl.textContent = demoName;
  if (avatarEl) {
    avatarEl.textContent = demoName
      .split(" ")
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  const ownerDashboardLink = document.getElementById("ownerDashboardLink");
  if (ownerDashboardLink && userType === "owner") {
    ownerDashboardLink.style.display = "block";
  }

  await loadStationsFromApi();

  const search = document.getElementById("searchInput");
  if (search) {
    search.addEventListener("input", (e) => {
      state.query = e.target.value;
      render();
    });
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveFilter(btn.getAttribute("data-filter")));
  });

  // Queue Update Modal Event Listeners
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  const cancelBtn = document.getElementById("queueUpdateCancel");
  const submitBtn = document.getElementById("queueUpdateSubmit");
  const input = document.getElementById("queueUpdateInput");

  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeQueueUpdateModal();
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      closeQueueUpdateModal();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      await submitQueueUpdate();
    });
  }

  if (input) {
    input.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        await submitQueueUpdate();
      }
    });
  }

  render();
});

/**
 * Logout: destroy PHP session then clear local keys.
 * @param {Event} event
 */
async function performLogout(event) {
  event.preventDefault();

  const ok = confirm("Do you want to logout?");
  if (!ok) return;

  await logoutRemote();

  if (typeof clearUserSession === "function") {
    clearUserSession();
  } else {
    localStorage.removeItem("userType");
    localStorage.removeItem("username");
    localStorage.removeItem("loginTime");
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
  }

  window.location.href = "login.html";
}
