/**
 * Owner dashboard: loads/saves station fuel data via owner_station.php (PHP session).
 */

const ownerState = {
  stationId: null,
  petrolAvailable: true,
  dieselAvailable: true,
  queueLength: 0,
  waitingTimeMins: 0,
  stationName: "",
  stationLocation: "",
  lastUpdated: new Date(),
};

function calculateStatus() {
  const { petrolAvailable, dieselAvailable, queueLength } = ownerState;

  if (!petrolAvailable && !dieselAvailable) {
    return "no-fuel";
  }
  if (petrolAvailable && dieselAvailable && queueLength < 10) {
    return "available";
  }
  if (!petrolAvailable || !dieselAvailable || queueLength >= 10) {
    return "limited";
  }
  return "available";
}

function getStatusInfo(status) {
  const info = {
    available: {
      label: "Available",
      description: "Both fuels available, queue is normal",
      icon: "fa-circle-check",
      color: "available-bg",
    },
    limited: {
      label: "Limited",
      description: "Limited fuel or high queue length",
      icon: "fa-triangle-exclamation",
      color: "limited-bg",
    },
    "no-fuel": {
      label: "No Fuel",
      description: "All fuels currently unavailable",
      icon: "fa-circle-xmark",
      color: "no-fuel-bg",
    },
  };
  return info[status] || info.available;
}

function updateStatusDisplay() {
  const status = calculateStatus();
  const statusInfo = getStatusInfo(status);

  const indicator = document.getElementById("mainStatusIndicator");
  const statusLabelEl = document.getElementById("statusLabel");
  const statusDescription = document.getElementById("statusDescription");
  const statusCircle = indicator?.querySelector(".status-circle");

  if (statusCircle) {
    statusCircle.className = "status-circle " + statusInfo.color;
    statusCircle.innerHTML = `<i class="fa-solid ${statusInfo.icon}"></i>`;
  }

  if (statusLabelEl) statusLabelEl.textContent = statusInfo.label;
  if (statusDescription) statusDescription.textContent = statusInfo.description;

  const statusStat = document.getElementById("statusStat");
  if (statusStat) statusStat.textContent = statusInfo.label;

  const statusIcon = document.getElementById("statusIcon");
  if (statusIcon) {
    statusIcon.className = `fa-solid ${statusInfo.icon}`;
  }
}

function updateFuelStatusBadges() {
  const { petrolAvailable, dieselAvailable } = ownerState;

  const petrolStatus = document.getElementById("petrolStatus");
  if (petrolStatus) {
    const badgeClass = petrolAvailable ? "available" : "no-fuel";
    const badgeText = petrolAvailable
      ? '<i class="fa-solid fa-check-circle"></i> Available'
      : '<i class="fa-solid fa-xmark-circle"></i> Unavailable';
    petrolStatus.innerHTML = `<span class="status-badge ${badgeClass}">${badgeText}</span>`;
  }

  const dieselStatus = document.getElementById("dieselStatus");
  if (dieselStatus) {
    const badgeClass = dieselAvailable ? "available" : "no-fuel";
    const badgeText = dieselAvailable
      ? '<i class="fa-solid fa-check-circle"></i> Available'
      : '<i class="fa-solid fa-xmark-circle"></i> Unavailable';
    dieselStatus.innerHTML = `<span class="status-badge ${badgeClass}">${badgeText}</span>`;
  }

  const petrolStat = document.getElementById("petrolStat");
  const dieselStat = document.getElementById("dieselStat");
  if (petrolStat) petrolStat.textContent = petrolAvailable ? "Yes" : "No";
  if (dieselStat) dieselStat.textContent = dieselAvailable ? "Yes" : "No";
}

function updateQueueDisplay() {
  const { queueLength, waitingTimeMins } = ownerState;
  const queueEl = document.getElementById("queueLength");
  const waitEl = document.getElementById("waitingTime");
  if (queueEl) queueEl.textContent = String(queueLength);
  if (waitEl) waitEl.textContent = String(waitingTimeMins);
}

function updateStationInfo() {
  const { stationName, stationLocation, lastUpdated } = ownerState;
  const nameEl = document.getElementById("stationNameDisplay");
  const locEl = document.getElementById("stationLocationDisplay");
  const updatedEl = document.getElementById("stationLastUpdated");
  if (nameEl) nameEl.textContent = stationName;
  if (locEl) locEl.textContent = stationLocation;
  if (updatedEl) updatedEl.textContent = getTimeAgo(lastUpdated);
}

function updateLastSavedTime() {
  const lastSaved = document.getElementById("lastSaved");
  if (lastSaved) {
    const now = new Date();
    lastSaved.textContent = `Last saved: ${now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
}

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

function openQueueUpdateModal() {
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  const input = document.getElementById("queueUpdateInput");
  const errorEl = document.getElementById("queueUpdateError");
  
  if (!backdrop || !input) return;

  // Set initial value
  input.value = String(ownerState.queueLength);
  errorEl.textContent = "";
  errorEl.classList.remove("show");

  backdrop.classList.add("active");
  input.focus();
}

function closeQueueUpdateModal() {
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  if (backdrop) {
    backdrop.classList.remove("active");
  }
}

async function submitQueueUpdate() {
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  const input = document.getElementById("queueUpdateInput");
  const errorEl = document.getElementById("queueUpdateError");
  const submitBtn = document.getElementById("queueUpdateSubmit");

  if (!backdrop || !input) return;

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
      station_id: ownerState.stationId,
      queue_length: queueLength,
    });

    if (!response.ok) {
      throw new Error(response.message || "Failed to update queue");
    }

    // Update local state
    ownerState.queueLength = response.queue_length;
    ownerState.lastUpdated = new Date();

    // Re-render the UI
    updateQueueDisplay();
    updateStatusDisplay();
    updateStationInfo();

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

function refreshUI() {
  updateFuelStatusBadges();
  updateStatusDisplay();
  updateQueueDisplay();
  updateStationInfo();

  const petrolToggle = document.getElementById("petrolToggle");
  const dieselToggle = document.getElementById("dieselToggle");
  if (petrolToggle) petrolToggle.checked = ownerState.petrolAvailable;
  if (dieselToggle) dieselToggle.checked = ownerState.dieselAvailable;
}

async function loadOwnerStation() {
  const data = await apiGet("../backend/owner_station.php");
  if (!data.ok || !data.station) {
    throw new Error(data.message || "Could not load station");
  }
  const s = data.station;
  ownerState.stationId = s.station_id;
  ownerState.stationName = s.station_name;
  ownerState.stationLocation = s.location || "";
  ownerState.petrolAvailable = Boolean(s.petrol);
  ownerState.dieselAvailable = Boolean(s.diesel);
  ownerState.queueLength = s.queue_length ?? 0;
  ownerState.waitingTimeMins = s.waiting_time ?? 0;
  ownerState.lastUpdated = new Date();
}

document.addEventListener("DOMContentLoaded", async () => {
  const userType = localStorage.getItem("userType");
  const username = localStorage.getItem("username");

  if (!userType || !username) {
    window.location.href = "login.html";
    return;
  }

  if (userType !== "owner") {
    window.location.href = "dashboard.html";
    return;
  }

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

  try {
    await loadOwnerStation();
  } catch (e) {
    if (String(e?.message || "").includes("Authentication") || e?.message === "Authentication required") {
      window.location.href = "login.html";
      return;
    }
    alert(e?.message || "Could not load your station. Ensure you registered as an owner.");
    window.location.href = "dashboard.html";
    return;
  }

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

  const saveFuelBtn = document.getElementById("saveFuelBtn");
  if (saveFuelBtn) {
    saveFuelBtn.addEventListener("click", async () => {
      saveFuelBtn.disabled = true;
      try {
        await apiPostJson("../backend/owner_station.php", {
          petrol: ownerState.petrolAvailable,
          diesel: ownerState.dieselAvailable,
        });
        ownerState.lastUpdated = new Date();
        updateLastSavedTime();
        updateStationInfo();

        saveFuelBtn.innerHTML = '<i class="fa-solid fa-check me-2"></i>Saved!';
        setTimeout(() => {
          saveFuelBtn.innerHTML = '<i class="fa-solid fa-save me-2"></i>Save Changes';
        }, 2000);
      } catch (err) {
        alert(err?.message || "Save failed");
      } finally {
        saveFuelBtn.disabled = false;
      }
    });
  }

  // Queue Update Modal Event Listeners
  const backdrop = document.getElementById("queueUpdateModalBackdrop");
  const cancelBtn = document.getElementById("queueUpdateCancel");
  const submitBtn = document.getElementById("queueUpdateSubmit");
  const input = document.getElementById("queueUpdateInput");
  const updateQueueBtn = document.getElementById("ownerUpdateQueueBtn");

  if (updateQueueBtn) {
    updateQueueBtn.addEventListener("click", () => {
      openQueueUpdateModal();
    });
  }

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

  refreshUI();
  updateLastSavedTime();
});

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
