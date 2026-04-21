/**
 * Owner Dashboard JavaScript
 * Manages fuel availability, auto status calculation, and queue display
 */

// ========================================
// STATE MANAGEMENT
// ========================================

const ownerState = {
  petrolAvailable: true,
  dieselAvailable: true,
  queueLength: 24,
  waitingTimeMins: 18,
  stationName: "City Fuel Point",
  stationLocation: "Ward Place, Colombo 07",
  lastUpdated: new Date(),
};

// ========================================
// AUTO STATUS CALCULATION LOGIC
// ========================================

/**
 * Calculate station status based on fuel availability and queue length
 * 
 * Status Logic:
 * - "Available": Both fuels available AND queue < 10
 * - "Limited": Only one fuel OR queue >= 10 but < 50
 * - "No Fuel": Both fuels unavailable
 */
function calculateStatus() {
  const { petrolAvailable, dieselAvailable, queueLength } = ownerState;

  // Both fuels unavailable = No Fuel
  if (!petrolAvailable && !dieselAvailable) {
    return "no-fuel";
  }

  // Both fuels available AND queue is low = Available
  if (petrolAvailable && dieselAvailable && queueLength < 10) {
    return "available";
  }

  // One fuel unavailable OR queue is high = Limited
  if ((!petrolAvailable || !dieselAvailable) || queueLength >= 10) {
    return "limited";
  }

  return "available";
}

/**
 * Get status label and description
 */
function getStatusInfo(status) {
  const info = {
    available: {
      label: "Available",
      description: "Both fuels available, queue is normal",
      icon: "fa-circle-check",
      color: "available-bg"
    },
    limited: {
      label: "Limited",
      description: "Limited fuel or high queue length",
      icon: "fa-triangle-exclamation",
      color: "limited-bg"
    },
    "no-fuel": {
      label: "No Fuel",
      description: "All fuels currently unavailable",
      icon: "fa-circle-xmark",
      color: "no-fuel-bg"
    }
  };
  return info[status] || info.available;
}

// ========================================
// DOM UPDATE FUNCTIONS
// ========================================

/**
 * Update the main status display (center status indicator)
 */
function updateStatusDisplay() {
  const status = calculateStatus();
  const statusInfo = getStatusInfo(status);

  const indicator = document.getElementById("mainStatusIndicator");
  const statusLabel = document.getElementById("statusLabel");
  const statusDescription = document.getElementById("statusDescription");
  const statusCircle = indicator?.querySelector(".status-circle");

  if (statusCircle) {
    // Remove old status classes
    statusCircle.className = "status-circle " + statusInfo.color;
    statusCircle.innerHTML = `<i class="fa-solid ${statusInfo.icon}"></i>`;
  }

  if (statusLabel) statusLabel.textContent = statusInfo.label;
  if (statusDescription) statusDescription.textContent = statusInfo.description;

  // Update quick stats status
  const statusStat = document.getElementById("statusStat");
  if (statusStat) statusStat.textContent = statusInfo.label;

  // Update status icon
  const statusIcon = document.getElementById("statusIcon");
  if (statusIcon) {
    statusIcon.className = `fa-solid ${statusInfo.icon}`;
  }
}

/**
 * Update fuel status badges
 */
function updateFuelStatusBadges() {
  const { petrolAvailable, dieselAvailable } = ownerState;

  // Petrol status badge
  const petrolStatus = document.getElementById("petrolStatus");
  if (petrolStatus) {
    const badgeClass = petrolAvailable ? "available" : "no-fuel";
    const badgeText = petrolAvailable 
      ? '<i class="fa-solid fa-check-circle"></i> Available'
      : '<i class="fa-solid fa-xmark-circle"></i> Unavailable';
    petrolStatus.innerHTML = `<span class="status-badge ${badgeClass}">${badgeText}</span>`;
  }

  // Diesel status badge
  const dieselStatus = document.getElementById("dieselStatus");
  if (dieselStatus) {
    const badgeClass = dieselAvailable ? "available" : "no-fuel";
    const badgeText = dieselAvailable
      ? '<i class="fa-solid fa-check-circle"></i> Available'
      : '<i class="fa-solid fa-xmark-circle"></i> Unavailable';
    dieselStatus.innerHTML = `<span class="status-badge ${badgeClass}">${badgeText}</span>`;
  }

  // Quick stats
  const petrolStat = document.getElementById("petrolStat");
  const dieselStat = document.getElementById("dieselStat");
  if (petrolStat) petrolStat.textContent = petrolAvailable ? "Yes" : "No";
  if (dieselStat) dieselStat.textContent = dieselAvailable ? "Yes" : "No";
}

/**
 * Update queue information display
 */
function updateQueueDisplay() {
  const { queueLength, waitingTimeMins } = ownerState;

  const queueEl = document.getElementById("queueLength");
  const waitEl = document.getElementById("waitingTime");

  if (queueEl) queueEl.textContent = queueLength;
  if (waitEl) waitEl.textContent = waitingTimeMins;
}

/**
 * Update station info display
 */
function updateStationInfo() {
  const { stationName, stationLocation, lastUpdated } = ownerState;

  const nameEl = document.getElementById("stationNameDisplay");
  const locEl = document.getElementById("stationLocationDisplay");
  const updatedEl = document.getElementById("stationLastUpdated");

  if (nameEl) nameEl.textContent = stationName;
  if (locEl) locEl.textContent = stationLocation;
  if (updatedEl) updatedEl.textContent = getTimeAgo(lastUpdated);
}

/**
 * Update last saved timestamp
 */
function updateLastSavedTime() {
  const lastSaved = document.getElementById("lastSaved");
  if (lastSaved) {
    const now = new Date();
    lastSaved.textContent = `Last saved: ${now.toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    })}`;
  }
}

/**
 * Format time ago string
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins === 0) return "Just now";
  if (diffMins === 1) return "1 minute ago";
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

/**
 * Refresh all UI elements
 */
function refreshUI() {
  updateFuelStatusBadges();
  updateStatusDisplay();
  updateQueueDisplay();
  updateStationInfo();
}

// ========================================
// EVENT LISTENERS & INITIALIZATION
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in and is an owner
  const userType = localStorage.getItem("userType");
  const username = localStorage.getItem("username");
  
  if (!userType || !username) {
    // User not logged in, redirect to login
    window.location.href = "login.html";
    return;
  }
  
  if (userType !== "owner") {
    // User is not an owner, redirect to user dashboard
    window.location.href = "dashboard.html";
    return;
  }

  // Initialize owner name and avatar
  const ownerNameEl = document.getElementById("ownerName");
  const ownerAvatarEl = document.getElementById("ownerAvatar");

  if (ownerNameEl) ownerNameEl.textContent = username;
  if (ownerAvatarEl) {
    ownerAvatarEl.textContent = username
      .split(" ")
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  // ========================================
  // FUEL TOGGLE SWITCHES
  // ========================================

  const petrolToggle = document.getElementById("petrolToggle");
  const dieselToggle = document.getElementById("dieselToggle");

  if (petrolToggle) {
    petrolToggle.addEventListener("change", () => {
      ownerState.petrolAvailable = petrolToggle.checked;
      updateFuelStatusBadges();
      updateStatusDisplay();
    });
  }

  if (dieselToggle) {
    dieselToggle.addEventListener("change", () => {
      ownerState.dieselAvailable = dieselToggle.checked;
      updateFuelStatusBadges();
      updateStatusDisplay();
    });
  }

  // ========================================
  // SAVE BUTTON
  // ========================================

  const saveFuelBtn = document.getElementById("saveFuelBtn");
  if (saveFuelBtn) {
    saveFuelBtn.addEventListener("click", () => {
      ownerState.lastUpdated = new Date();
      updateLastSavedTime();
      updateStationInfo();

      // Visual feedback
      saveFuelBtn.innerHTML = '<i class="fa-solid fa-check me-2"></i>Saved!';
      setTimeout(() => {
        saveFuelBtn.innerHTML = '<i class="fa-solid fa-save me-2"></i>Save Changes';
      }, 2000);

      // Console log for development
      console.log("Fuel availability saved:", {
        petrol: ownerState.petrolAvailable,
        diesel: ownerState.dieselAvailable,
        timestamp: ownerState.lastUpdated
      });
    });
  }

  // ========================================
  // LOGOUT FUNCTIONALITY
  // ========================================

  const logoutLinks = document.querySelectorAll("[id*='logoutLink']");
  logoutLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      performLogout(e);
    });
  });

  // ========================================
  // SIMULATE QUEUE UPDATES
  // ========================================

  /**
   * Simulate real-time queue updates
   * In production, this would be replaced with real-time data from backend
   */
  function simulateQueueUpdate() {
    // Simulate slight variations in queue length and waiting time
    const queueVariation = Math.floor(Math.random() * 15) - 7; // -7 to +7
    const newQueue = Math.max(0, ownerState.queueLength + queueVariation);
    
    ownerState.queueLength = newQueue;
    ownerState.waitingTimeMins = Math.ceil(newQueue * 0.75); // Approx 45 seconds per vehicle

    updateQueueDisplay();
    updateStatusDisplay();
  }

  // Update queue every 30 seconds (simulation)
  setInterval(simulateQueueUpdate, 30000);

  // ========================================
  // INITIAL UI RENDER
  // ========================================

  refreshUI();
  updateLastSavedTime();

  console.log("Owner Dashboard Initialized", ownerState);
});

// ========================================
// LOGOUT HELPER FUNCTION
// ========================================

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

// ========================================
// HELPER: Export state for debugging
// ========================================

window.ownerDashboardDebug = () => {
  console.table(ownerState);
  console.log("Status:", calculateStatus());
  console.log("Status Info:", getStatusInfo(calculateStatus()));
};
