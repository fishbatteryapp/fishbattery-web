(function initAccountPage() {
  const summary = document.getElementById("accountSummary");
  const emailInput = document.getElementById("email");
  const displayNameInput = document.getElementById("displayName");
  const avatarFileInput = document.getElementById("avatarFile");
  const clearAvatarBtn = document.getElementById("clearAvatar");
  const saveBtn = document.getElementById("saveProfile");
  const statusText = document.getElementById("statusText");
  const passwordSection = document.getElementById("passwordSection");
  const currentPasswordInput = document.getElementById("currentPassword");
  const newPasswordInput = document.getElementById("newPassword");
  const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
  const changePasswordBtn = document.getElementById("changePassword");
  const passwordStatusText = document.getElementById("passwordStatusText");

  const API_BASES = [
    "https://api.fishbattery.app",
    "https://fishbattery-auth-api-production.up.railway.app",
    "http://localhost:3000"
  ];

  const token = (localStorage.getItem("fishbattery.token") || "").trim();
  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  let pendingAvatarData = null;
  let clearAvatar = false;
  let canChangePassword = false;

  function setStatus(message) {
    statusText.textContent = String(message || "");
  }

  function setPasswordStatus(message) {
    if (passwordStatusText) passwordStatusText.textContent = String(message || "");
  }

  async function parseResponse(response) {
    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // text response
    }
    if (!response.ok) {
      throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    }
    return parsed;
  }

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved) out.push(resolved);
    for (const base of API_BASES) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  async function request(path, init) {
    let lastError = new Error("Request failed");
    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}${path}`, init);
        const parsed = await parseResponse(response);
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError;
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  async function loadSession() {
    setStatus("Loading your account...");
    const session = await request("/v1/auth/session", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const account = session?.account;
    if (!account) throw new Error("Could not load account");
    canChangePassword = !!account.canChangePassword;

    emailInput.value = account.email || "";
    displayNameInput.value = account.displayName || "";
    summary.textContent = `Signed in as ${account.displayName || "User"}`;
    if (passwordSection) passwordSection.classList.toggle("hidden", !canChangePassword);
    if (!canChangePassword) {
      setPasswordStatus("Password change is unavailable for this account.");
    } else {
      setPasswordStatus("Use at least 8 characters.");
    }
    localStorage.setItem("fishbattery.account", JSON.stringify(account));
    setStatus("You are signed in.");
  }

  clearAvatarBtn.addEventListener("click", () => {
    clearAvatar = true;
    pendingAvatarData = null;
    avatarFileInput.value = "";
    setStatus("Profile picture will be removed when you save.");
  });

  avatarFileInput.addEventListener("change", async () => {
    const file = avatarFileInput.files?.[0];
    if (!file) return;
    try {
      pendingAvatarData = await readAsDataUrl(file);
      clearAvatar = false;
      setStatus(`Selected new profile picture: ${file.name}`);
    } catch {
      setStatus("Could not load the selected image. Please try another file.");
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      const displayName = displayNameInput.value.trim();
      if (!displayName) {
        setStatus("Please enter a display name.");
        return;
      }

      const body = { displayName };
      if (clearAvatar) {
        body.avatarUrl = null;
      } else if (pendingAvatarData) {
        body.avatarUrl = pendingAvatarData;
      }

      setStatus("Saving changes...");
      const updated = await request("/v1/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (updated?.accessToken) localStorage.setItem("fishbattery.token", updated.accessToken);
      if (updated?.account) localStorage.setItem("fishbattery.account", JSON.stringify(updated.account));

      clearAvatar = false;
      pendingAvatarData = null;
      avatarFileInput.value = "";
      setStatus("Saved successfully.");
      await loadSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/display name already in use/i.test(message)) {
        setStatus("That display name is already taken. Please choose another.");
      } else {
        setStatus("Could not save changes right now. Please try again.");
      }
    }
  });

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async () => {
      try {
        if (!canChangePassword) {
          setPasswordStatus("Password change is unavailable for this account.");
          return;
        }
        const currentPassword = String(currentPasswordInput?.value || "");
        const newPassword = String(newPasswordInput?.value || "");
        const confirmPassword = String(confirmNewPasswordInput?.value || "");

        if (!currentPassword || !newPassword || !confirmPassword) {
          setPasswordStatus("Please fill in all password fields.");
          return;
        }
        if (newPassword.length < 8) {
          setPasswordStatus("New password must be at least 8 characters.");
          return;
        }
        if (newPassword !== confirmPassword) {
          setPasswordStatus("New password confirmation does not match.");
          return;
        }

        setPasswordStatus("Updating password...");
        const updated = await request("/v1/account/password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        if (updated?.accessToken) localStorage.setItem("fishbattery.token", updated.accessToken);
        if (updated?.account) localStorage.setItem("fishbattery.account", JSON.stringify(updated.account));

        if (currentPasswordInput) currentPasswordInput.value = "";
        if (newPasswordInput) newPasswordInput.value = "";
        if (confirmNewPasswordInput) confirmNewPasswordInput.value = "";
        setPasswordStatus("Password updated successfully.");
        await loadSession();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/current password is incorrect/i.test(message)) {
          setPasswordStatus("Current password is incorrect.");
        } else if (/at least 8 characters/i.test(message)) {
          setPasswordStatus("New password must be at least 8 characters.");
        } else if (/must be different/i.test(message)) {
          setPasswordStatus("New password must be different from current password.");
        } else if (/unavailable for this account/i.test(message)) {
          setPasswordStatus("Password change is unavailable for this account.");
        } else {
          setPasswordStatus("Could not update password right now. Please try again.");
        }
      }
    });
  }

  loadSession().catch(() => {
    localStorage.removeItem("fishbattery.token");
    localStorage.removeItem("fishbattery.account");
    window.location.href = "./login.html";
  });
})();
