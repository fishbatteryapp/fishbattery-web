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
  const passwordToggleButtons = Array.from(document.querySelectorAll("[data-password-toggle]"));
  const twofaSummary = document.getElementById("twofaSummary");
  const twofaStatusText = document.getElementById("twofaStatusText");
  const twofaStartBtn = document.getElementById("twofaStartBtn");
  const twofaDisableBtn = document.getElementById("twofaDisableBtn");
  const twofaSetupPanel = document.getElementById("twofaSetupPanel");
  const twofaQrImage = document.getElementById("twofaQrImage");
  const twofaManualKey = document.getElementById("twofaManualKey");
  const twofaVerifyCode = document.getElementById("twofaVerifyCode");
  const twofaConfirmBtn = document.getElementById("twofaConfirmBtn");
  const twofaCancelBtn = document.getElementById("twofaCancelBtn");
  const twofaDisablePanel = document.getElementById("twofaDisablePanel");
  const twofaDisablePassword = document.getElementById("twofaDisablePassword");
  const twofaDisableCode = document.getElementById("twofaDisableCode");
  const twofaDisableConfirmBtn = document.getElementById("twofaDisableConfirmBtn");
  const twofaDisableCancelBtn = document.getElementById("twofaDisableCancelBtn");

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
  let twoFactorEnabled = false;

  const eyeOpenSvg =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"></circle></svg>';
  const eyeClosedSvg =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M6.7 6.8C4.3 8.3 2.8 10.7 2.5 12c.6 2.2 4.1 6 9.5 6 2 0 3.8-.5 5.2-1.3"></path><path d="M14.5 6.3c4.1.9 6.6 4.3 7 5.7-.3 1-1.3 2.7-2.9 4.1"></path></svg>';

  function setPasswordToggleVisual(btn, visible) {
    btn.innerHTML = visible ? eyeOpenSvg : eyeClosedSvg;
    btn.setAttribute("aria-pressed", visible ? "true" : "false");
    btn.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  }

  function setStatus(message) {
    statusText.textContent = String(message || "");
  }

  function setPasswordStatus(message) {
    if (passwordStatusText) passwordStatusText.textContent = String(message || "");
  }

  function setTwofaStatus(message) {
    if (twofaStatusText) twofaStatusText.textContent = String(message || "");
  }

  function hideTwofaSetupPanel() {
    if (twofaSetupPanel) twofaSetupPanel.classList.add("hidden");
    if (twofaQrImage) twofaQrImage.removeAttribute("src");
    if (twofaManualKey) twofaManualKey.textContent = "";
    if (twofaVerifyCode) twofaVerifyCode.value = "";
  }

  function hideTwofaDisablePanel() {
    if (twofaDisablePanel) twofaDisablePanel.classList.add("hidden");
    if (twofaDisablePassword) twofaDisablePassword.value = "";
    if (twofaDisableCode) twofaDisableCode.value = "";
  }

  function renderTwofaUi() {
    if (!passwordSection || passwordSection.classList.contains("hidden")) return;
    if (twofaSummary) {
      twofaSummary.textContent = twoFactorEnabled
        ? "Authenticator app is enabled."
        : "Add an authenticator app for optional 2-step verification at sign-in.";
    }
    if (twofaStartBtn) twofaStartBtn.classList.toggle("hidden", twoFactorEnabled);
    if (twofaDisableBtn) twofaDisableBtn.classList.toggle("hidden", !twoFactorEnabled);
  }

  async function refreshTwofaStatus() {
    if (!canChangePassword) return;
    const status = await request("/v1/account/2fa/status", {
      headers: { Authorization: `Bearer ${token}` }
    });
    twoFactorEnabled = !!status?.enabled;
    renderTwofaUi();
  }

  for (const btn of passwordToggleButtons) {
    const inputId = String(btn.getAttribute("data-password-toggle") || "").trim();
    const input = inputId ? document.getElementById(inputId) : null;
    if (!input) continue;
    setPasswordToggleVisual(btn, false);
    btn.addEventListener("click", () => {
      const visible = input.getAttribute("type") === "text";
      input.setAttribute("type", visible ? "password" : "text");
      setPasswordToggleVisual(btn, !visible);
    });
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
        const msg = String((error && error.message) || error || "").toLowerCase();
        const isNetworkError =
          msg.includes("failed to fetch") ||
          msg.includes("name_not_resolved") ||
          msg.includes("err_connection_refused") ||
          msg.includes("networkerror");
        if (!isNetworkError) throw (error instanceof Error ? error : new Error(String(error)));
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
      await refreshTwofaStatus();
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

  if (twofaStartBtn) {
    twofaStartBtn.addEventListener("click", async () => {
      try {
        hideTwofaDisablePanel();
        setTwofaStatus("Preparing authenticator setup...");
        const data = await request("/v1/account/2fa/setup/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({})
        });
        if (twofaQrImage) twofaQrImage.src = String(data?.qrDataUrl || "");
        if (twofaManualKey) twofaManualKey.textContent = String(data?.manualCode || "");
        if (twofaSetupPanel) twofaSetupPanel.classList.remove("hidden");
        setTwofaStatus("Scan the QR code and enter the 6-digit code to confirm.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/only available for password-based accounts/i.test(message)) {
          setTwofaStatus("Authenticator setup is available only for password-based accounts.");
        } else {
          setTwofaStatus("Could not start authenticator setup right now.");
        }
      }
    });
  }

  if (twofaCancelBtn) {
    twofaCancelBtn.addEventListener("click", () => {
      hideTwofaSetupPanel();
      setTwofaStatus("");
    });
  }

  if (twofaConfirmBtn) {
    twofaConfirmBtn.addEventListener("click", async () => {
      try {
        const code = String(twofaVerifyCode?.value || "").replace(/\s+/g, "");
        if (!/^\d{6}$/.test(code)) {
          setTwofaStatus("Please enter a valid 6-digit code.");
          return;
        }
        setTwofaStatus("Enabling authenticator app...");
        const data = await request("/v1/account/2fa/setup/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ code })
        });
        if (data?.accessToken) localStorage.setItem("fishbattery.token", data.accessToken);
        if (data?.account) localStorage.setItem("fishbattery.account", JSON.stringify(data.account));
        hideTwofaSetupPanel();
        setTwofaStatus("Authenticator app enabled.");
        await refreshTwofaStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/invalid authenticator code/i.test(message)) {
          setTwofaStatus("That code is not valid. Try the latest code from your app.");
        } else {
          setTwofaStatus("Could not enable authenticator app right now.");
        }
      }
    });
  }

  if (twofaDisableBtn) {
    twofaDisableBtn.addEventListener("click", () => {
      hideTwofaSetupPanel();
      if (twofaDisablePanel) twofaDisablePanel.classList.remove("hidden");
      setTwofaStatus("Confirm with your password and a current authenticator code.");
    });
  }

  if (twofaDisableCancelBtn) {
    twofaDisableCancelBtn.addEventListener("click", () => {
      hideTwofaDisablePanel();
      setTwofaStatus("");
    });
  }

  if (twofaDisableConfirmBtn) {
    twofaDisableConfirmBtn.addEventListener("click", async () => {
      try {
        const currentPassword = String(twofaDisablePassword?.value || "");
        const code = String(twofaDisableCode?.value || "").replace(/\s+/g, "");
        if (!currentPassword || !/^\d{6}$/.test(code)) {
          setTwofaStatus("Enter your current password and a valid 6-digit code.");
          return;
        }
        setTwofaStatus("Disabling authenticator app...");
        const data = await request("/v1/account/2fa/disable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ currentPassword, code })
        });
        if (data?.accessToken) localStorage.setItem("fishbattery.token", data.accessToken);
        if (data?.account) localStorage.setItem("fishbattery.account", JSON.stringify(data.account));
        hideTwofaDisablePanel();
        setTwofaStatus("Authenticator app disabled.");
        await refreshTwofaStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/current password is incorrect/i.test(message)) {
          setTwofaStatus("Current password is incorrect.");
        } else if (/invalid authenticator code/i.test(message)) {
          setTwofaStatus("Authenticator code is invalid.");
        } else {
          setTwofaStatus("Could not disable authenticator app right now.");
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
