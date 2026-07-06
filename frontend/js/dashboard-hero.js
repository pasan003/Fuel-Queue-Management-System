/**
 * Dashboard Hero Module — Reusable Component
 * Provides a personalized hero section with typewriter greeting,
 * rotating subtitles, contextual meta info, quick action buttons,
 * and animated statistics counters.
 *
 * Works on both User Dashboard and Owner Dashboard.
 * Depends on localStorage keys set by auth.js (login).
 *
 * Version: 1.0
 */

(function () {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  /** Subtitles per user role — rotated randomly on each load. */
  var SUBTITLES = {
    user: [
      "Welcome back! Here's today's fuel station overview.",
      'Stay updated with the latest station activity.',
      'Check real-time fuel availability and track your fuel usage.',
      "Everything you need to know about fuel stations at a glance.",
    ],
    owner: [
      "Everything is ready. Let's check today's fuel queues.",
      'Manage your station efficiently and keep customers informed.',
      'Stay on top of fuel availability and queue updates.',
      'Your station dashboard — updated in real time.',
    ],
  };

  /** Quick actions per user role. */
  var QUICK_ACTIONS = {
    user: [
      { label: 'Find Stations', icon: 'fa-map-location-dot', action: 'find-stations', primary: true },
      { label: 'Report Queue', icon: 'fa-flag', action: 'report-queue', primary: false },
      { label: 'View History', icon: 'fa-clock-rotate-left', action: 'view-history', primary: false },
    ],
    owner: [
      { label: 'Update Queue', icon: 'fa-people-line', action: 'update-queue', primary: true },
      { label: 'Manage Fuel', icon: 'fa-sliders', action: 'manage-fuel', primary: false },
      { label: 'View Reports', icon: 'fa-chart-bar', action: 'view-reports', primary: false },
    ],
  };

  // ============================================================
  // HELPERS
  // ============================================================

  /** Determine time-of-day greeting. */
  function getGreeting() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good Morning';
    if (h >= 12 && h < 17) return 'Good Afternoon';
    if (h >= 17 && h < 21) return 'Good Evening';
    return 'Good Night';
  }

  /** Pick a random element from an array. */
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Format today's date in a friendly format. */
  function formatDate() {
    var now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Convert an ISO timestamp to a relative time string. */
  function formatLastLogin(isoString) {
    if (!isoString) return 'N/A';
    var then = new Date(isoString);
    if (isNaN(then.getTime())) return 'N/A';
    var now = new Date();
    var diffMs = now - then;
    var diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    var diffH = Math.floor(diffMins / 60);
    if (diffH < 24) return diffH + ' hour' + (diffH === 1 ? '' : 's') + ' ago';
    var diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Yesterday';
    return diffD + ' days ago';
  }

  /** Capitalize first letter. */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================================
  // TYPEWRITER ANIMATION
  // ============================================================

  /**
   * Animate text onto an element character by character.
   * Skips animation if user prefers reduced motion.
   * Calls callback when typing is complete.
   */
  function typewrite(element, text, cursor, callback) {
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !element) {
      if (element) element.textContent = text;
      if (cursor) cursor.style.display = 'none';
      if (callback) callback();
      return;
    }

    element.textContent = '';
    var index = 0;
    var speed = 35; // ms per character

    function type() {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        setTimeout(type, speed);
      } else {
        // Typing complete: hide cursor with a fade
        setTimeout(function () {
          if (cursor) {
            cursor.style.opacity = '0';
            cursor.style.transition = 'opacity 0.3s ease';
          }
          if (callback) callback();
        }, 500);
      }
    }

    type();
  }

  // ============================================================
  // COUNTER ANIMATION
  // ============================================================

  /**
   * Animate numeric .metric-value elements from 0 to their target value.
   * Exposed on window so fuel-tracking.js can trigger it after populating data.
   */
  function animateCounters() {
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var counters = document.querySelectorAll('.metric-value');

    counters.forEach(function (el) {
      var text = el.textContent.trim();
      var num = parseFloat(text);
      if (isNaN(num)) return;

      var suffix = text.replace(/[\d.,-]/g, '').trim();
      var cleanNum = parseFloat(text.replace(/[^0-9.-]/g, ''));
      if (isNaN(cleanNum)) return;

      if (prefersReduced) {
        el.setAttribute('data-num', String(cleanNum));
        return;
      }

      var decimalPlaces = (text.split('.')[1] || '').replace(/[^0-9]/g, '').length;
      var duration = 800;
      var start = performance.now();
      var from = 0;

      function tick(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        var val = from + (cleanNum - from) * eased;
        el.textContent = val.toFixed(decimalPlaces) + (suffix ? ' ' + suffix : '');
        el.setAttribute('data-num', String(val));
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          el.textContent = cleanNum.toFixed(decimalPlaces) + (suffix ? ' ' + suffix : '');
          el.setAttribute('data-num', String(cleanNum));
        }
      }
      requestAnimationFrame(tick);
    });
  }

  /**
   * Watch the metrics container for content changes and trigger counter animation.
   * This handles the async timing gap: fuel-tracking.js updates .metric-value
   * elements after an API call, and this observer fires when the values actually
   * land in the DOM.
   */
  function observeMetrics() {
    var metricsContainer = document.getElementById('analyticsMetrics');
    if (!metricsContainer) return;

    var observer = new MutationObserver(function () {
      // Debounce: wait for DOM to settle after the update
      clearTimeout(observer._timer);
      observer._timer = setTimeout(function () {
        animateCounters();
      }, 100);
    });

    observer.observe(metricsContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Expose globally so other modules can trigger counter animation manually
  window.animateDashboardCounters = animateCounters;

  // ============================================================
  // QUICK ACTION HANDLERS
  // ============================================================

  /**
   * Detect whether the current page has Owner Dashboard elements.
   * If these elements are missing, the owner is likely viewing the
   * User Dashboard, and owner-specific actions need a page redirect.
   */
  function isOnOwnerDashboard() {
    return document.getElementById('ownerUpdateQueueBtn') !== null;
  }

  /** Map action names to DOM interactions. */
  var ACTION_HANDLERS = {
    'find-stations': function () {
      var tabBtn = document.getElementById('tabFindStations');
      if (tabBtn) { tabBtn.click(); return; }
      scrollToSection('stationsGrid');
    },
    'report-queue': function () {
      // Scroll to the stations grid where queue buttons exist
      var grid = document.getElementById('stationsGrid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'view-history': function () {
      var tabBtn = document.getElementById('tabFuelTracking');
      if (tabBtn) { tabBtn.click(); return; }
      scrollToSection('fuelLogsTableBody');
    },
    'update-queue': function () {
      // On owner dashboard, trigger the update queue button click
      var btn = document.getElementById('ownerUpdateQueueBtn');
      if (btn) { btn.click(); return; }
      // On user dashboard, check for card update queue buttons
      var firstQueueBtn = document.querySelector('[data-update-queue]');
      if (firstQueueBtn) { firstQueueBtn.click(); return; }
      // Not on any page with queue update elements — redirect to Owner Dashboard
      if (!isOnOwnerDashboard()) {
        window.location.href = 'owner-dashboard.html';
      }
    },
    'manage-fuel': function () {
      var el = document.getElementById('saveFuelBtn');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      // Only on the User Dashboard — redirect to Owner Dashboard
      if (!isOnOwnerDashboard()) {
        window.location.href = 'owner-dashboard.html';
      }
    },
    'view-reports': function () {
      // Scroll to the queue information / analytics section
      var panel = document.querySelector('.queue-info-panel');
      if (panel) { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      // Only on the User Dashboard — redirect to Owner Dashboard
      if (!isOnOwnerDashboard()) {
        window.location.href = 'owner-dashboard.html';
      }
    },
  };

  function scrollToSection(fallbackId) {
    var el = document.getElementById(fallbackId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleAction(action) {
    var handler = ACTION_HANDLERS[action];
    if (handler) handler();
  }

  // ============================================================
  // BUILD QUICK ACTION BUTTONS
  // ============================================================

  function buildActions(container, userType) {
    if (!container) return;
    container.innerHTML = '';

    var actions = QUICK_ACTIONS[userType] || QUICK_ACTIONS.user;
    actions.forEach(function (action) {
      var btn = document.createElement('button');
      btn.className = 'hero-action-btn' + (action.primary ? ' primary-action' : '');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', action.label);
      btn.innerHTML = '<i class="fa-solid ' + action.icon + '"></i> ' + action.label;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        handleAction(action.action);
      });
      container.appendChild(btn);
    });
  }

  // ============================================================
  // MAIN INIT
  // ============================================================

  function initHero() {
    var greetingEl = document.getElementById('heroGreeting');
    var cursorEl = document.getElementById('heroCursor');
    var subtitleEl = document.getElementById('heroSubtitle');
    var metaEl = document.getElementById('heroMeta');
    var actionsEl = document.getElementById('heroActions');
    var dateEl = document.getElementById('heroDate');
    var lastLoginEl = document.getElementById('heroLastLogin');
    var roleEl = document.getElementById('heroRole');

    // If the greeting element is missing, we're not on a dashboard page
    if (!greetingEl) return;

    // Read session data from localStorage (set by auth.js / login)
    var username = localStorage.getItem('username') || 'User';
    var userType = localStorage.getItem('userType') || 'customer';
    var loginTime = localStorage.getItem('loginTime');
    var email = localStorage.getItem('userEmail');

    // Determine role label
    var roleLabel = userType === 'owner'
      ? 'Station Owner'
      : userType === 'admin'
        ? 'Administrator'
        : 'Customer';

    // Build greeting text
    var greeting = getGreeting();
    var greetingText = greeting + ', ' + username + '!';

    // Set static metadata
    if (dateEl) dateEl.textContent = formatDate();
    if (lastLoginEl) lastLoginEl.textContent = formatLastLogin(loginTime);
    if (roleEl) roleEl.textContent = roleLabel;

    // Pick a random subtitle
    var subtitles = SUBTITLES[userType] || SUBTITLES.user;
    if (subtitleEl) subtitleEl.textContent = pickRandom(subtitles);

    // Build quick action buttons
    buildActions(actionsEl, userType);

    // Run typewriter animation, then fade in subtitle, meta, and actions
    typewrite(greetingEl, greetingText, cursorEl, function () {
      // Show subtitle
      if (subtitleEl) subtitleEl.classList.add('visible');

      // Show meta after subtitle fades in
      setTimeout(function () {
        if (metaEl) metaEl.classList.add('visible');
      }, 300);

      // Show actions after meta fades in
      setTimeout(function () {
        if (actionsEl) actionsEl.classList.add('visible');
      }, 550);

      // Animate visible counters shortly after
      setTimeout(function () {
        animateCounters();
      }, 900);
    });

    // When the fuel tracking tab is switched to, animate counters + observe future changes
    var fuelTabBtn = document.getElementById('tabFuelTracking');
    if (fuelTabBtn) {
      fuelTabBtn.addEventListener('click', function () {
        setTimeout(animateCounters, 100);
        observeMetrics();
      });
    }

    // If metrics are already visible (e.g. user is on fuel tracking tab on page load),
    // start observing immediately
    var fuelTrackingView = document.getElementById('fuelTrackingView');
    if (fuelTrackingView && fuelTrackingView.style.display !== 'none') {
      observeMetrics();
    }
  }

  // ============================================================
  // BOOTSTRAP
  // ============================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero);
  } else {
    initHero();
  }
})();
