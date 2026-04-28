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
            <div class="meta">
              <div class="k"><i class="fa-solid fa-users me-2"></i>Queue Length</div>
              <div class="v">${formatQueue(station.queue_length)}</div>
            </div>
            <div class="meta">
              <div class="k"><i class="fa-solid fa-clock me-2"></i>Waiting Time</div>
              <div class="v">${formatWait(station.waiting_time)}</div>
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
