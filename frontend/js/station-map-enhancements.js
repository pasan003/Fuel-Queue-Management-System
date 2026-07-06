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

  function isFuelAvailable(s) {
    return Boolean(s?.petrol) || Boolean(s?.diesel);
  }

  function getAvailText(s) {
    if (Boolean(s?.petrol) || Boolean(s?.diesel)) return "Fuel Available";
    return "No Fuel";
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
        const avail = isFuelAvailable(s);
        const availIcon = avail ? "fa-check-circle" : "fa-circle-xmark";
        const availClass = avail ? "fqms-suggest-avail" : "fqms-suggest-noavail";
        const qLen = Number(s.queue_length ?? 0);
        return `
          <button type="button" class="fqms-suggest-item" data-station-id="${Number(
            s.station_id
          )}">
            <div class="fqms-suggest-item__primary">${escapeHtml(s.station_name)}</div>
            <div class="fqms-suggest-item__secondary">
              ${escapeHtml(s.location || "")}
              <span class="${availClass}"><i class="fa-solid ${availIcon}"></i> ${getAvailText(s)}</span>
              <span class="fqms-suggest-queue">${qLen} vehicles</span>
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
  };
})();

