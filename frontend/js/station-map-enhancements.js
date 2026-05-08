/**
 * Station map enhancements (search suggestions + queue label helpers).
 * Non-module script: attaches a small API to window.FQMSMapEnhancements.
 */

(function () {
  "use strict";

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"]/g, function (s) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[s];
    });
  }

  function debounce(fn, waitMs) {
    let t = null;
    return function (...args) {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  function getFuelText(s) {
    const p = Boolean(s?.petrol);
    const d = Boolean(s?.diesel);
    if (p && d) return "Petrol, Diesel";
    if (p) return "Petrol";
    if (d) return "Diesel";
    return "None";
  }

  function getQueueLabel(queueLength) {
    const q = Number(queueLength ?? 0);
    if (!Number.isFinite(q) || q <= 5) return "Low Queue";
    if (q <= 15) return "Medium Queue";
    return "High Queue";
  }

  function getQueueBadgeClass(queueLength) {
    const q = Number(queueLength ?? 0);
    if (!Number.isFinite(q) || q <= 5) return "success";
    if (q <= 15) return "warning";
    return "danger";
  }

  function isFuelAvailable(s) {
    return Boolean(s?.petrol) || Boolean(s?.diesel);
  }

  function renderSuggestions(mountEl, stations) {
    if (!mountEl) return;

    if (!Array.isArray(stations) || stations.length === 0) {
      mountEl.innerHTML = "";
      mountEl.classList.add("d-none");
      return;
    }

    mountEl.classList.remove("d-none");
    mountEl.innerHTML = stations
      .map((s) => {
        const qLabel = getQueueLabel(s.queue_length);
        const qBadge = getQueueBadgeClass(s.queue_length);
        const avail = isFuelAvailable(s);
        const availBadge = avail ? "success" : "secondary";
        const availText = avail ? "Fuel Available" : "No Fuel";
        return `
          <button type="button" class="list-group-item list-group-item-action fqms-suggest-card" data-station-id="${Number(
            s.station_id
          )}">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div class="min-w-0">
                <div class="fw-bold text-truncate">${escapeHtml(s.station_name)}</div>
                <div class="text-muted small text-truncate">${escapeHtml(s.location || "")}</div>
                <div class="small mt-1">${escapeHtml(getFuelText(s))}</div>
              </div>
              <div class="text-end flex-shrink-0">
                <span class="badge text-bg-${qBadge} mb-1">${escapeHtml(qLabel)}</span><br/>
                <span class="badge text-bg-${availBadge}">${availText}</span>
              </div>
            </div>
          </button>
        `;
      })
      .join("");
  }

  /**
   * @param {object} opts
   * @param {HTMLInputElement} opts.inputEl
   * @param {HTMLElement} opts.mountEl
   * @param {(query: string) => Promise<any[]>} opts.fetchStations
   * @param {(stationId: number) => void} opts.onSelect
   * @param {number} [opts.debounceMs]
   * @param {number} [opts.maxItems]
   */
  function initStationSearchSuggestions(opts) {
    const inputEl = opts?.inputEl;
    const mountEl = opts?.mountEl;
    const fetchStations = opts?.fetchStations;
    const onSelect = opts?.onSelect;
    const debounceMs = Number(opts?.debounceMs ?? 160);
    const maxItems = Number(opts?.maxItems ?? 8);

    if (!inputEl || !mountEl || typeof fetchStations !== "function" || typeof onSelect !== "function") {
      return { destroy() {} };
    }

    let destroyed = false;
    let lastQuery = "";
    let activeReq = 0;

    function hide() {
      mountEl.innerHTML = "";
      mountEl.classList.add("d-none");
    }

    async function doSearch(q) {
      const query = String(q || "").trim();
      lastQuery = query;

      if (query === "") {
        hide();
        return;
      }

      const reqId = ++activeReq;
      try {
        const list = await fetchStations(query);
        if (destroyed) return;
        if (reqId !== activeReq) return; // ignore stale results
        const out = Array.isArray(list) ? list.slice(0, maxItems) : [];
        renderSuggestions(mountEl, out);
      } catch (e) {
        // Keep UI quiet (no console spam); just hide on failures.
        if (destroyed) return;
        if (reqId !== activeReq) return;
        hide();
      }
    }

    const debounced = debounce(doSearch, debounceMs);

    function onInput() {
      debounced(inputEl.value);
    }

    function onFocus() {
      // If user focuses back with text present, show suggestions again.
      if (String(inputEl.value || "").trim() !== "") {
        debounced(inputEl.value);
      }
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        hide();
      }
    }

    function onClickSuggestion(e) {
      const btn = e.target?.closest?.("[data-station-id]");
      if (!btn) return;
      const stationId = Number(btn.getAttribute("data-station-id"));
      if (!Number.isFinite(stationId)) return;
      hide();
      onSelect(stationId);
      // Keep cursor in input for quick repeat searches.
      try {
        inputEl.focus();
      } catch (_) {}
    }

    function onDocPointerDown(e) {
      if (e.target === inputEl) return;
      if (mountEl.contains(e.target)) return;
      hide();
    }

    inputEl.addEventListener("input", onInput);
    inputEl.addEventListener("focus", onFocus);
    inputEl.addEventListener("keydown", onKeyDown);
    mountEl.addEventListener("click", onClickSuggestion);
    document.addEventListener("pointerdown", onDocPointerDown);

    return {
      destroy() {
        destroyed = true;
        inputEl.removeEventListener("input", onInput);
        inputEl.removeEventListener("focus", onFocus);
        inputEl.removeEventListener("keydown", onKeyDown);
        mountEl.removeEventListener("click", onClickSuggestion);
        document.removeEventListener("pointerdown", onDocPointerDown);
      },
      refreshIfOpen() {
        if (destroyed) return;
        if (String(inputEl.value || "").trim() === "") return;
        // If visible, refresh with latest query.
        if (!mountEl.classList.contains("d-none") && lastQuery) {
          doSearch(lastQuery);
        }
      },
      hide,
    };
  }

  window.FQMSMapEnhancements = {
    initStationSearchSuggestions,
    getQueueLabel,
  };
})();

