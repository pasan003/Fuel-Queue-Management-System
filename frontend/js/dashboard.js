/**
 * Customer dashboard: loads station cards from PHP + MySQL via stations.php.
 */

// Version stamp to verify the correct file is running in the browser console.
// Check: window.__FQMS_DASHBOARD_JS_VERSION
window.__FQMS_DASHBOARD_JS_VERSION = "2026-05-11-1";

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

// Lightweight polling (no websockets). Interval-safe + non-overlapping fetches.
let refreshIntervalId = null;
let refreshInFlight = false;
let lastSuccessfulRefreshAt = 0;
let lastRefreshErrorAt = 0;
let lastRenderedStationIdsKey = "";
let toastTimerId = null;

// Leaflet map references for user dashboard
let userMap = null;
let userMarkersLayer = null;
let userMarkerIcons = null;
let userMarkersByStationId = new Map();
let userMarkers = Object.create(null); // stationId -> marker (plain object)
let selectedMarkerStationId = null;

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
  userMarkersByStationId = new Map();
  userMarkers = Object.create(null);
  selectedMarkerStationId = null;
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
      userMarkersByStationId.set(Number(s.station_id), marker);
      userMarkers[String(Number(s.station_id))] = marker;
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

function setSelectedMarker(stationId) {
  try {
    if (selectedMarkerStationId != null) {
      const prev = userMarkersByStationId.get(Number(selectedMarkerStationId));
      const prevEl = prev?.getElement?.();
      prevEl?.classList?.remove("is-selected");
    }
  } catch (_) {}

  selectedMarkerStationId = stationId;
  try {
    const m = userMarkersByStationId.get(Number(stationId));
    const el = m?.getElement?.();
    el?.classList?.add("is-selected");
  } catch (_) {}
}

function buildPopupHtmlForStation(s) {
  return [
    `<div class="fqms-popup">`,
    `<div class="fqms-popup__title">${escapeHtml(s.station_name)}</div>`,
    s.location ? `<div class="fqms-popup__meta"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.location)}</div>` : ``,
    `<div class="fqms-popup__row"><strong>Fuel</strong>: ${escapeHtml(getFuelText(s))}</div>`,
    `<div class="fqms-popup__row"><strong>Queue</strong>: ${Number(s.queue_length ?? 0)} Vehicles</div>`,
    `<div class="fqms-popup__row"><strong>Available</strong>: ${escapeHtml(getAvailabilityText(s))}</div>`,
    `</div>`,
  ].join("");
}

function focusStationOnMap(stationId, opts = {}) {
  const id = Number(stationId);
  if (!Number.isFinite(id)) return;

  const station = state.stations.find((x) => Number(x.station_id) === id);
  if (!station) return;

  // Prefer explicit coords from clicked element if provided, fallback to station data.
  const lat = opts?.lat != null && opts.lat !== "" ? opts.lat : (station.latitude ?? null);
  const lng = opts?.lng != null && opts.lng !== "" ? opts.lng : (station.longitude ?? null);
  if (lat === null || lng === null) return;
  if (!isValidLatLng(lat, lng)) return;

  initUserMap();
  if (!userMap) return;

  const marker = userMarkersByStationId.get(id) || userMarkers[String(id)] || null;

  // Smoothly scroll attention to the map (especially on mobile).
  try {
    document.getElementById("mapUser")?.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (_) {}

  if (marker) {
    setSelectedMarker(id);
  }

  // Fly to station and open popup after animation settles.
  try {
    userMap.flyTo([Number(lat), Number(lng)], 15, { animate: true, duration: 0.9 });
  } catch (_) {
    try {
      userMap.setView([Number(lat), Number(lng)], 15, { animate: true });
    } catch (_) {}
  }

  try {
    setTimeout(() => {
      try {
        if (marker) {
          marker.openPopup();
        } else if (typeof L !== "undefined") {
          // If no marker exists (e.g., station has coords but marker wasn't created),
          // still show an info popup at the location so the click visibly works.
          const html = buildPopupHtmlForStation(station);
          L.popup({ closeButton: true, autoPan: true })
            .setLatLng([Number(lat), Number(lng)])
            .setContent(html)
            .openOn(userMap);
        }
      } catch (_) {}
    }, 950);
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

function formatRelativeFromTimestamp(ts) {
  if (!ts) return "—";
  const diffMs = Date.now() - ts;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "—";
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h === 1) return "1 hour ago";
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function stationIdsKeyFromStations(list) {
  return (list || [])
    .map((s) => String(Number(s.station_id)))
    .sort()
    .join(",");
}

function setMetaRefreshUi({ refreshing }) {
  const resultsMeta = document.getElementById("resultsMeta");
  if (!resultsMeta) return;
  resultsMeta.classList.toggle("fqms-meta--refreshing", Boolean(refreshing));
}

function updateMetaLastUpdated() {
  const resultsMeta = document.getElementById("resultsMeta");
  if (!resultsMeta) return;

  // Preserve existing base meta text, then append a compact "Last updated" tail.
  const base = resultsMeta.getAttribute("data-base-meta") || resultsMeta.textContent || "";
  const tail = lastSuccessfulRefreshAt
    ? ` • Last updated: ${formatRelativeFromTimestamp(lastSuccessfulRefreshAt)}`
    : "";
  resultsMeta.textContent = `${base}${tail}`;
}

function setBaseMetaText(text) {
  const resultsMeta = document.getElementById("resultsMeta");
  if (!resultsMeta) return;
  resultsMeta.setAttribute("data-base-meta", text);
  resultsMeta.textContent = text;
  updateMetaLastUpdated();
}

function ensureToastContainer() {
  let el = document.getElementById("fqmsToast");
  if (el) return el;
  el = document.createElement("div");
  el.id = "fqmsToast";
  el.className = "fqms-toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  document.body.appendChild(el);
  return el;
}

function showToast(message, variant = "warn", ms = 3200) {
  const el = ensureToastContainer();
  if (!el) return;
  el.classList.remove("is-show", "is-warn", "is-ok");
  el.classList.add("is-show", variant === "ok" ? "is-ok" : "is-warn");
  el.textContent = message;
  if (toastTimerId) window.clearTimeout(toastTimerId);
  toastTimerId = window.setTimeout(() => {
    try {
      el.classList.remove("is-show");
    } catch (_) {}
  }, ms);
}

function animateNumber(el, nextValue, opts = {}) {
  if (!el) return;
  const duration = Math.max(120, Math.min(650, Number(opts.duration || 380)));
  const prev = Number(el.getAttribute("data-num") ?? el.textContent);
  const from = Number.isFinite(prev) ? prev : 0;
  const to = Number(nextValue);
  if (!Number.isFinite(to) || to === from) {
    el.textContent = String(nextValue);
    el.setAttribute("data-num", String(to));
    return;
  }

  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = Math.round(from + (to - from) * eased);
    el.textContent = String(v);
    el.setAttribute("data-num", String(v));
    if (t < 1) requestAnimationFrame(tick);
    else {
      el.textContent = String(to);
      el.setAttribute("data-num", String(to));
    }
  }
  requestAnimationFrame(tick);
}

function setWaitBadge(containerEl, waitingTime) {
  if (!containerEl) return;
  const wait = Number(waitingTime) || 0;
  const waitStatus = getWaitTimeStatus(wait);
  const existing = containerEl.querySelector(".wait-status-badge");

  if (wait <= 0) {
    if (existing) existing.remove();
    return;
  }

  if (!existing) {
    const badge = document.createElement("div");
    badge.className = `wait-status-badge ${waitStatus.status}`;
    badge.innerHTML = `<i class="fa-solid ${waitStatus.icon}"></i>${waitStatus.label}`;
    containerEl.appendChild(badge);
    return;
  }

  existing.className = `wait-status-badge ${waitStatus.status}`;
  const iconEl = existing.querySelector("i");
  if (iconEl) iconEl.className = `fa-solid ${waitStatus.icon}`;
  // keep text node simple
  existing.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) n.textContent = waitStatus.label;
  });
  if (!existing.textContent?.includes(waitStatus.label)) {
    existing.textContent = "";
    existing.innerHTML = `<i class="fa-solid ${waitStatus.icon}"></i>${waitStatus.label}`;
  }
}

function updateYesNoChip(containerEl, value) {
  if (!containerEl) return;
  const html = yesNoChip(Boolean(value));
  if (containerEl.innerHTML !== html) containerEl.innerHTML = html;
}

function patchStationCard(cardRoot, prevStation, nextStation) {
  if (!cardRoot) return false;
  const card = cardRoot.classList.contains("station-card")
    ? cardRoot
    : cardRoot.querySelector(".station-card") || cardRoot;

  let changed = false;
  const prevStatus = String(prevStation?.status || "");
  const nextStatus = String(nextStation?.status || "");
  const prevQueue = Number(prevStation?.queue_length ?? 0);
  const nextQueue = Number(nextStation?.queue_length ?? 0);
  const prevWait = Number(prevStation?.waiting_time ?? 0);
  const nextWait = Number(nextStation?.waiting_time ?? 0);

  // Status pill update (color transitions handled by CSS)
  if (prevStatus !== nextStatus) {
    const pill = card.querySelector(".status-pill");
    if (pill) {
      pill.classList.remove("status-available", "status-limited", "status-nofuel");
      pill.classList.add(statusClass(nextStatus));
      const iconEl = pill.querySelector("i");
      if (iconEl) iconEl.className = `fa-solid ${statusIcon(nextStatus)}`;
      // update text content after icon
      const txt = statusLabel(nextStatus);
      if (!pill.textContent.includes(txt)) {
        pill.childNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) n.textContent = ` ${txt}`;
        });
        if (!pill.textContent.includes(txt)) {
          pill.innerHTML = `<i class="fa-solid ${statusIcon(nextStatus)}"></i>${txt}`;
        }
      }
    }
    changed = true;
  }

  // Fuel chips (Petrol / Diesel)
  if (Boolean(prevStation?.petrol) !== Boolean(nextStation?.petrol)) {
    updateYesNoChip(card.querySelector(".meta:nth-child(1) .v"), nextStation.petrol);
    changed = true;
  }
  if (Boolean(prevStation?.diesel) !== Boolean(nextStation?.diesel)) {
    updateYesNoChip(card.querySelector(".meta:nth-child(2) .v"), nextStation.diesel);
    changed = true;
  }

  // Queue length (pulse/glow when it changes)
  if (prevQueue !== nextQueue) {
    const qEl = card.querySelector(".queue-length-value");
    animateNumber(qEl, nextQueue, { duration: 420 });
    card.classList.remove("fqms-queue-changed");
    // force reflow so animation can retrigger
    void card.offsetWidth;
    card.classList.add("fqms-queue-changed");
    changed = true;
  }

  // Waiting time number + badge
  if (prevWait !== nextWait) {
    const wEl = card.querySelector(".waiting-time-value");
    animateNumber(wEl, nextWait, { duration: 420 });
    setWaitBadge(card.querySelector(".meta.waiting-time-metric"), nextWait);
    changed = true;
  }

  // Last updated text inside card
  const prevIso = String(prevStation?.last_updated_iso || "");
  const nextIso = String(nextStation?.last_updated_iso || "");
  if (prevIso !== nextIso) {
    const span = card.querySelector(".last-updated span");
    if (span) span.textContent = formatLastUpdated(nextStation.last_updated_iso);
    changed = true;
  }

  // Update stored coords on the clickable wrapper (used by card->map)
  const nextLat = nextStation.latitude ?? "";
  const nextLng = nextStation.longitude ?? "";
  if (String(prevStation?.latitude ?? "") !== String(nextLat) || String(prevStation?.longitude ?? "") !== String(nextLng)) {
    try {
      cardRoot.setAttribute("data-lat", String(nextLat));
      cardRoot.setAttribute("data-lng", String(nextLng));
      card.setAttribute("data-lat", String(nextLat));
      card.setAttribute("data-lng", String(nextLng));
    } catch (_) {}
  }

  if (changed) {
    card.classList.remove("fqms-card-updated");
    void card.offsetWidth;
    card.classList.add("fqms-card-updated");
  }
  return changed;
}

function patchVisibleStationCards(prevStationsById, nextStationsById) {
  const grid = document.getElementById("stationsGrid");
  if (!grid) return { patched: 0, reRendered: false };

  const filtered = applyFilters();
  const nextKey = stationIdsKeyFromStations(filtered);

  // If the visible set changed (new/removed due to data changes), do a regular render.
  // This avoids complicated DOM diff logic while still preventing flicker in the common case.
  if (lastRenderedStationIdsKey && lastRenderedStationIdsKey !== nextKey) {
    render();
    lastRenderedStationIdsKey = nextKey;
    return { patched: 0, reRendered: true };
  }

  let patched = 0;
  filtered.forEach((s) => {
    const id = Number(s.station_id);
    const cardEl = grid.querySelector(`[data-station-id="${id}"]`);
    if (!cardEl) return;
    const prev = prevStationsById.get(id) || null;
    const next = nextStationsById.get(id) || null;
    if (!next) return;
    if (patchStationCard(cardEl, prev, next)) patched += 1;
  });

  lastRenderedStationIdsKey = nextKey;
  return { patched, reRendered: false };
}

function stationCardHTML(station) {
  const last = formatLastUpdated(station.last_updated_iso);
  const id = station.station_id;
  const waitStatus = getWaitTimeStatus(station.waiting_time);
  const lat = station.latitude ?? "";
  const lng = station.longitude ?? "";
  
  return `
    <div class="col-12 col-lg-6">
      <div class="station-link js-station-card" data-station-id="${id}" data-lat="${lat}" data-lng="${lng}">
        <div class="station-card js-station-card" data-station-id="${id}" data-lat="${lat}" data-lng="${lng}">
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
  setBaseMetaText(meta);

  emptyWrap.classList.toggle("d-none", filtered.length !== 0);
  wireOpenButtons(grid);
  wireUpdateQueueButtons(grid);
  // update markers on the map to match filtered stations
  try { addMarkersFromState(); } catch (e) { /* ignore if map not initialized */ }

  // Track current visible set to enable targeted refresh patching.
  lastRenderedStationIdsKey = stationIdsKeyFromStations(filtered);
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

async function refreshStationsQuietly() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  setMetaRefreshUi({ refreshing: true });
  document.body.classList.add("fqms-is-refreshing");

  // Keep old data visible; only patch on success.
  const prevStations = Array.isArray(state.stations) ? state.stations : [];
  const prevById = new Map(prevStations.map((s) => [Number(s.station_id), s]));

  try {
    const data = await apiGet("../backend/stations.php");
    if (!data.ok || !Array.isArray(data.stations)) {
      throw new Error(data.message || "Invalid response");
    }

    state.loadError = null;
    state.stations = data.stations;
    lastSuccessfulRefreshAt = Date.now();

    const nextById = new Map(state.stations.map((s) => [Number(s.station_id), s]));
    const result = patchVisibleStationCards(prevById, nextById);

    // Keep map in sync. Markers depend on station status/coords, so update on refresh.
    try { addMarkersFromState(); } catch (_) {}

    updateMetaLastUpdated();
    return result;
  } catch (err) {
    const now = Date.now();
    // Avoid spamming warnings if backend is down.
    if (now - lastRefreshErrorAt > 15000) {
      lastRefreshErrorAt = now;
      showToast("Live update failed. Showing last known data.", "warn");
    }
  } finally {
    refreshInFlight = false;
    setMetaRefreshUi({ refreshing: false });
    document.body.classList.remove("fqms-is-refreshing");
  }
}

function startAutoRefresh() {
  // Prevent duplicates (important for bfcache / accidental double init).
  if (refreshIntervalId != null) return;

  const MIN = 5000;
  const MAX = 10000;
  // 7s feels "live" without spamming backend.
  const intervalMs = 7000;
  const safeMs = Math.max(MIN, Math.min(MAX, intervalMs));

  refreshIntervalId = window.setInterval(() => {
    refreshStationsQuietly();
  }, safeMs);

  // If the tab becomes visible again, do one immediate refresh (but still avoid overlap).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshStationsQuietly();
    }
  });

  // Update the "Last updated" label every second for the relative time feel.
  window.setInterval(() => {
    updateMetaLastUpdated();
  }, 1000);
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

  // Card -> map interaction (Google Maps-style focus on marker)
  // Delegated: cards are injected dynamically, so bind once at document level.
  // Enable debug logs by running in browser console: localStorage.setItem("fqmsDebug","1")
  const debugClicks = localStorage.getItem("fqmsDebug") === "1";
  document.addEventListener("click", (e) => {
    // Don't hijack clicks on buttons inside the card (Details / Update Queue).
    if (e.target?.closest?.("[data-open]")) return;
    if (e.target?.closest?.("[data-update-queue]")) return;

    const cardEl = e.target?.closest?.("[data-station-id]");
    if (!cardEl) return;

    // Only handle clicks that occur within the station grid or suggestion container (if present).
    const inStations = Boolean(cardEl.closest?.("#stationsGrid"));
    const inSuggestions = Boolean(cardEl.closest?.("#stationSearchSuggestions"));
    if (!inStations && !inSuggestions) return;

    const id = Number(cardEl.getAttribute("data-station-id"));
    if (!Number.isFinite(id)) return;

    const lat = cardEl.getAttribute("data-lat");
    const lng = cardEl.getAttribute("data-lng");

    if (debugClicks) {
      console.log("Card clicked", id);
      console.log("Marker found", userMarkersByStationId.get(id) || userMarkers[String(id)] || null);
      console.log("Card coords", { lat, lng });
    }

    focusStationOnMap(id, { lat, lng });
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
  // Start polling only after initial render.
  startAutoRefresh();
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
