function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value || "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function postForm(url, formEl) {
  const fd = new FormData(formEl);
  return fetch(url, {
    method: "POST",
    body: fd,
    headers: { "X-Requested-With": "XMLHttpRequest" }
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    return data;
  });
}

function togglePasswordBy(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input || !iconEl) return;
  if (input.type === "password") {
    input.type = "text";
    iconEl.classList.remove("fa-eye");
    iconEl.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    iconEl.classList.remove("fa-eye-slash");
    iconEl.classList.add("fa-eye");
  }
}

function initLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const toggleIcon = document.querySelector(".toggle-password");
  if (toggleIcon) {
    toggleIcon.addEventListener("click", () => togglePasswordBy("password", toggleIcon));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    let valid = true;
    const username = String(document.getElementById("username")?.value || "").trim();
    const password = String(document.getElementById("password")?.value || "").trim();

    setText("usernameError", "");
    setText("passwordError", "");

    if (username === "") {
      setText("usernameError", "Username is required");
      valid = false;
    }

    if (password === "") {
      setText("passwordError", "Password is required");
      valid = false;
    } else if (password.length < 6) {
      setText("passwordError", "Password must be at least 6 characters");
      valid = false;
    }

    if (!valid) return;

    try {
      const result = await postForm("../backend/login.php", form);
      alert(result.message || "Login successful");
      window.location.href = "dashboard.html";
    } catch (err) {
      alert(err?.message || "Login failed");
    }
  });
}

function initRegister() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const userTypeInput = document.getElementById("userType");
  const btnCustomer = document.getElementById("btnCustomer");
  const btnOwner = document.getElementById("btnOwner");
  const ownerPanel = document.getElementById("ownerPanel");

  function clearOwnerErrors() {
    ["stationNameError", "stationLocationError", "fuelTypesError"].forEach((id) => setText(id, ""));
  }

  function setUserType(type) {
    const isOwner = type === "owner";
    if (userTypeInput) userTypeInput.value = type;

    if (btnCustomer) {
      btnCustomer.classList.toggle("active", !isOwner);
      btnCustomer.setAttribute("aria-pressed", String(!isOwner));
    }
    if (btnOwner) {
      btnOwner.classList.toggle("active", isOwner);
      btnOwner.setAttribute("aria-pressed", String(isOwner));
    }

    if (ownerPanel) {
      ownerPanel.classList.toggle("visible", isOwner);
      ownerPanel.setAttribute("aria-hidden", String(!isOwner));
    }

    if (!isOwner) {
      const s1 = document.getElementById("stationName");
      const s2 = document.getElementById("stationLocation");
      const p = document.getElementById("fuelPetrol");
      const d = document.getElementById("fuelDiesel");
      if (s1) s1.value = "";
      if (s2) s2.value = "";
      if (p) p.checked = false;
      if (d) d.checked = false;
      clearOwnerErrors();
    }
  }

  btnCustomer?.addEventListener("click", () => setUserType("customer"));
  btnOwner?.addEventListener("click", () => setUserType("owner"));

  const toggleIcon = document.getElementById("togglePasswordIcon");
  if (toggleIcon) {
    toggleIcon.addEventListener("click", () => togglePasswordBy("password", toggleIcon));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let valid = true;

    const type = String(userTypeInput?.value || "customer");

    setText("fullNameError", "");
    setText("nationalIdError", "");
    setText("emailError", "");
    setText("passwordError", "");
    clearOwnerErrors();

    const fullName = String(document.getElementById("fullName")?.value || "").trim();
    const nationalId = String(document.getElementById("nationalId")?.value || "").trim();
    const email = String(document.getElementById("email")?.value || "").trim();
    const password = String(document.getElementById("password")?.value || "");

    if (fullName === "") { setText("fullNameError", "Full name is required"); valid = false; }
    if (nationalId === "") { setText("nationalIdError", "National ID is required"); valid = false; }
    if (email === "") { setText("emailError", "Email is required"); valid = false; }
    else if (!isValidEmail(email)) { setText("emailError", "Enter a valid email address"); valid = false; }

    if (password === "") { setText("passwordError", "Password is required"); valid = false; }
    else if (password.length < 6) { setText("passwordError", "Password must be at least 6 characters"); valid = false; }

    if (type === "owner") {
      const stationName = String(document.getElementById("stationName")?.value || "").trim();
      const stationLocation = String(document.getElementById("stationLocation")?.value || "").trim();
      const petrol = Boolean(document.getElementById("fuelPetrol")?.checked);
      const diesel = Boolean(document.getElementById("fuelDiesel")?.checked);

      if (stationName === "") { setText("stationNameError", "Station name is required"); valid = false; }
      if (stationLocation === "") { setText("stationLocationError", "Station location is required"); valid = false; }
      if (!petrol && !diesel) { setText("fuelTypesError", "Select at least one fuel type"); valid = false; }
    }

    if (!valid) return;

    try {
      const result = await postForm("../backend/register.php", form);
      alert(result.message || "Registration successful");
      window.location.href = "login.html";
    } catch (err) {
      alert(err?.message || "Registration failed");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initRegister();
});

