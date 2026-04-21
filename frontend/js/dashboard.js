const stationsData = [
  {
    id: 1,
    name: "CPC Fuel Station - Colombo 07",
    location: "Ward Place, Colombo",
    status: "available",
    petrol: true,
    diesel: true,
    queueLength: 24,
    waitingTimeMins: 18,
    lastUpdated: "5 min ago"
  },
  {
    id: 2,
    name: "LIOC Fuel Station - Borella",
    location: "Maradana Rd, Colombo",
    status: "limited",
    petrol: true,
    diesel: false,
    queueLength: 58,
    waitingTimeMins: 42,
    lastUpdated: "12 min ago"
  },
  {
    id: 3,
    name: "CPC Fuel Station - Nugegoda",
    location: "High Level Rd, Nugegoda",
    status: "nofuel",
    petrol: false,
    diesel: false,
    queueLength: 0,
    waitingTimeMins: 0,
    lastUpdated: "20 min ago"
  },
  {
    id: 4,
    name: "LIOC Fuel Station - Dehiwala",
    location: "Galle Rd, Dehiwala",
    status: "available",
    petrol: false,
    diesel: true,
    queueLength: 33,
    waitingTimeMins: 25,
    lastUpdated: "8 min ago"
  },
  {
    id: 5,
    name: "CPC Fuel Station - Rajagiriya",
    location: "Buthgamuwa Rd, Rajagiriya",
    status: "limited",
    petrol: true,
    diesel: true,
    queueLength: 71,
    waitingTimeMins: 55,
    lastUpdated: "3 min ago"
  },
  {
    id: 6,
    name: "LIOC Fuel Station - Kotte",
    location: "Sri Jayawardenepura Kotte",
    status: "available",
    petrol: true,
    diesel: false,
    queueLength: 19,
    waitingTimeMins: 14,
    lastUpdated: "7 min ago"
  }
];

const state = { query: "", filter: "all" };

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

function stationCardHTML(station) {
  const href = `station_details.html?stationId=${station.id}`;
  return `
    <div class="col-12 col-lg-6">
      <a class="station-link" href="${href}" data-station-id="${station.id}" aria-label="Open station ${station.name}">
        <div class="station-card">
          <div class="station-top">
            <div>
              <h3 class="station-name">${station.name}</h3>
              <div class="station-location">
                <i class="fa-solid fa-location-dot"></i>
                <span>${station.location}</span>
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
              <div class="v">${formatQueue(station.queueLength)}</div>
            </div>
            <div class="meta">
              <div class="k"><i class="fa-solid fa-clock me-2"></i>Waiting Time</div>
              <div class="v">${formatWait(station.waitingTimeMins)}</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="station-bottom">
            <div class="last-updated">
              <i class="fa-regular fa-clock"></i>
              Last updated: <span>${station.lastUpdated}</span>
            </div>
            <button class="cta" type="button" data-open="${station.id}">
              <i class="fa-solid fa-arrow-right me-2"></i>Open
            </button>
          </div>
        </div>
      </a>
    </div>
  `;
}

function applyFilters() {
  const q = state.query.trim().toLowerCase();
  return stationsData.filter((s) => {
    const matchesQuery =
      q === "" ||
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q);

    const matchesFilter = state.filter === "all" || s.status === state.filter;
    return matchesQuery && matchesFilter;
  });
}

function render() {
  const grid = document.getElementById("stationsGrid");
  const emptyWrap = document.getElementById("emptyWrap");
  const resultsMeta = document.getElementById("resultsMeta");
  if (!grid || !emptyWrap || !resultsMeta) return;

  const filtered = applyFilters();
  grid.innerHTML = filtered.map(stationCardHTML).join("");

  emptyWrap.classList.toggle("d-none", filtered.length !== 0);
  resultsMeta.textContent = `${filtered.length} station${filtered.length === 1 ? "" : "s"} • ${filterLabel(state.filter)}`;

  grid.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const id = Number(this.getAttribute("data-open"));
      const station = stationsData.find((x) => x.id === id);
      if (!station) return;
      alert(
        `Station: ${station.name}\n` +
          `Location: ${station.location}\n` +
          `Status: ${statusLabel(station.status)}\n` +
          `Petrol: ${station.petrol ? "Yes" : "No"}\n` +
          `Diesel: ${station.diesel ? "Yes" : "No"}\n` +
          `Queue: ${station.queueLength} vehicles\n` +
          `Waiting: ${station.waitingTimeMins} mins\n` +
          `Last Updated: ${station.lastUpdated}`
      );
    });
  });
}

function setActiveFilter(filter) {
  state.filter = filter;
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === filter);
  });
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in
  const userType = localStorage.getItem("userType");
  const username = localStorage.getItem("username");
  
  if (!userType || !username) {
    // User not logged in, redirect to login
    window.location.href = "login.html";
    return;
  }

  // Display user information in navbar
  const demoName = username || "User";
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");
  if (nameEl) nameEl.textContent = demoName;
  if (avatarEl) avatarEl.textContent = demoName.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();

  // Show owner dashboard link if user is owner
  const ownerDashboardLink = document.getElementById("ownerDashboardLink");
  if (ownerDashboardLink) {
    if (userType === "owner") {
      ownerDashboardLink.style.display = "block";
    }
  }

  // Search functionality
  const search = document.getElementById("searchInput");
  if (search) {
    search.addEventListener("input", (e) => {
      state.query = e.target.value;
      render();
    });
  }

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveFilter(btn.getAttribute("data-filter")));
  });

  render();
});

/**
 * Perform logout with session clearing
 * @param {Event} event - Click event from logout link
 */
function performLogout(event) {
  event.preventDefault();
  
  const ok = confirm("Do you want to logout?");
  if (ok) {
    // Clear user session using auth.js function if available
    if (typeof clearUserSession === "function") {
      clearUserSession();
    } else {
      // Fallback: clear manually
      localStorage.removeItem("userType");
      localStorage.removeItem("username");
      localStorage.removeItem("loginTime");
    }
    
    // Redirect to login
    window.location.href = "login.html";
  }
}

