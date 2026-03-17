(function initAccountPage() {
  // Account page overview:
  // - Loads current account session/profile.
  // - Handles profile edits, avatar transform/upload, password changes, 2FA setup/disable.
  // - Includes GDPR self-service actions (data export + account deletion).

  const summary = document.getElementById("accountSummary");
  const emailInput = document.getElementById("email");
  const displayNameInput = document.getElementById("displayName");
  const avatarFileInput = document.getElementById("avatarFile");
  const clearAvatarBtn = document.getElementById("clearAvatar");
  const avatarPreviewWrap = document.getElementById("avatarPreviewWrap");
  const avatarPreviewFrame = document.getElementById("avatarPreviewFrame");
  const avatarPreviewImage = document.getElementById("avatarPreviewImage");
  const avatarResetViewBtn = document.getElementById("avatarResetView");
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
  const exportDataBtn = document.getElementById("exportDataBtn");
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  const privacyStatusText = document.getElementById("privacyStatusText");
  const discordSummary = document.getElementById("discordSummary");
  const discordLinkBtn = document.getElementById("discordLinkBtn");
  const discordUnlinkBtn = document.getElementById("discordUnlinkBtn");
  const discordStatusText = document.getElementById("discordStatusText");

  // API base strategy:
  // - Use production endpoint by default.
  // - In localhost development, allow local API fallback.
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];
  const DISCORD_REDIRECT_URI = `${window.location.origin}/discord-link.html`;

  let authToken = (localStorage.getItem("fishbattery.token") || "").trim();
  if (!authToken) {
    window.location.href = "./login.html";
    return;
  }

  function setAuthToken(nextToken) {
    const normalized = String(nextToken || "").trim();
    if (!normalized) return;
    authToken = normalized;
    localStorage.setItem("fishbattery.token", normalized);
  }

  function isAuthInvalidError(error) {
    const statusCode = Number(error?.statusCode || 0);
    const message = String(error?.message || error || "").toLowerCase();
    return (
      statusCode === 401 ||
      statusCode === 403 ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("token expired") ||
      message.includes("invalid token")
    );
  }

  let pendingAvatarData = null;
  let avatarPreviewSource = null;
  let avatarNaturalW = 0;
  let avatarNaturalH = 0;
  let avatarScalePct = 100;
  let avatarOffsetXPct = 0;
  let avatarOffsetYPct = 0;
  let avatarTransformDirty = false;
  let avatarDragging = false;
  let avatarDragPointerId = null;
  let avatarDragStartX = 0;
  let avatarDragStartY = 0;
  let avatarDragStartOffsetX = 0;
  let avatarDragStartOffsetY = 0;
  let clearAvatar = false;
  let canChangePassword = false;
  let twoFactorEnabled = false;

  function setDiscordStatus(message) {
    if (discordStatusText) discordStatusText.textContent = String(message || "");
  }

  async function refreshDiscordLinkStatus() {
    try {
      const status = await request("/v1/account/discord", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const linked = !!status?.linked;
      const username = String(status?.username || "").trim();
      if (discordSummary) {
        discordSummary.textContent = linked
          ? `Linked to Discord as ${username || "your account"}.`
          : "No Discord account linked yet.";
      }
      if (discordLinkBtn) discordLinkBtn.classList.toggle("hidden", linked);
      if (discordUnlinkBtn) discordUnlinkBtn.classList.toggle("hidden", !linked);
      if (!status?.oauthConfigured) {
        setDiscordStatus("Discord linking is not configured on the server yet.");
        if (discordLinkBtn) discordLinkBtn.setAttribute("disabled", "disabled");
        return;
      }
      if (discordLinkBtn) discordLinkBtn.removeAttribute("disabled");
      if (linked) {
        setDiscordStatus(
          status?.roleSyncConfigured
            ? "Premium roles will be synced automatically when your subscription changes."
            : "Discord is linked, but automatic role sync is not configured on the server."
        );
      } else {
        setDiscordStatus("Link your Discord account so Fishbattery can sync your Premium Users role automatically.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (discordSummary) discordSummary.textContent = "Could not load Discord link status right now.";
      setDiscordStatus(message || "Could not load Discord link status right now.");
    }
  }

  function applyDiscordCallbackResult() {
    const query = new URLSearchParams(window.location.search);
    const linked = String(query.get("discord") || "").trim();
    const error = String(query.get("discord_error") || "").trim();
    const detail = String(query.get("detail") || "").trim();
    if (linked === "linked") {
      setDiscordStatus(detail || "Discord linked successfully.");
    } else if (linked === "unlinked") {
      setDiscordStatus(detail || "Discord unlinked.");
    } else if (error) {
      setDiscordStatus(detail || "Could not complete Discord linking.");
    } else {
      return;
    }
    query.delete("discord");
    query.delete("discord_error");
    query.delete("detail");
    const nextUrl = `${window.location.pathname}${query.toString() ? `?${query.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  // Password visibility icon assets.
  const eyeOpenSvg =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"></circle></svg>';
  const eyeClosedSvg =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M6.7 6.8C4.3 8.3 2.8 10.7 2.5 12c.6 2.2 4.1 6 9.5 6 2 0 3.8-.5 5.2-1.3"></path><path d="M14.5 6.3c4.1.9 6.6 4.3 7 5.7-.3 1-1.3 2.7-2.9 4.1"></path></svg>';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

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

  function setPrivacyStatus(message) {
    if (privacyStatusText) privacyStatusText.textContent = String(message || "");
  }

  function resetAvatarTransform() {
    avatarScalePct = 100;
    avatarOffsetXPct = 0;
    avatarOffsetYPct = 0;
    avatarTransformDirty = false;
  }

  function getAvatarPreviewLayout() {
    const frame = avatarPreviewWrap?.querySelector(".avatar-preview-frame");
    const frameW = Math.max(1, Number(frame?.clientWidth || 140));
    const frameH = Math.max(1, Number(frame?.clientHeight || 140));
    const srcW = Math.max(1, avatarNaturalW || 1);
    const srcH = Math.max(1, avatarNaturalH || 1);
    const scale = Math.max(0.5, Math.min(2.5, avatarScalePct / 100));
    const coverScale = Math.max(frameW / srcW, frameH / srcH) * scale;
    const displayW = srcW * coverScale;
    const displayH = srcH * coverScale;
    const maxShiftX = Math.max(0, (displayW - frameW) / 2);
    const maxShiftY = Math.max(0, (displayH - frameH) / 2);
    const shiftX = (avatarOffsetXPct / 100) * maxShiftX;
    const shiftY = (avatarOffsetYPct / 100) * maxShiftY;
    const left = (frameW - displayW) / 2 + shiftX;
    const top = (frameH - displayH) / 2 + shiftY;
    return { left, top, width: displayW, height: displayH };
  }

  function renderAvatarPreviewTransform() {
    if (!avatarPreviewImage || !avatarPreviewSource || !avatarNaturalW || !avatarNaturalH) return;
    const layout = getAvatarPreviewLayout();
    avatarPreviewImage.style.left = `${layout.left}px`;
    avatarPreviewImage.style.top = `${layout.top}px`;
    avatarPreviewImage.style.width = `${layout.width}px`;
    avatarPreviewImage.style.height = `${layout.height}px`;
  }

  function getAvatarShiftBoundsPx() {
    const frame = avatarPreviewFrame;
    const frameW = Math.max(1, Number(frame?.clientWidth || 140));
    const frameH = Math.max(1, Number(frame?.clientHeight || 140));
    const srcW = Math.max(1, avatarNaturalW || 1);
    const srcH = Math.max(1, avatarNaturalH || 1);
    const scale = Math.max(0.5, Math.min(2.5, avatarScalePct / 100));
    const coverScale = Math.max(frameW / srcW, frameH / srcH) * scale;
    const displayW = srcW * coverScale;
    const displayH = srcH * coverScale;
    return {
      maxShiftX: Math.max(0, (displayW - frameW) / 2),
      maxShiftY: Math.max(0, (displayH - frameH) / 2)
    };
  }

  function setAvatarPreviewSource(dataUrl) {
    avatarPreviewSource = dataUrl ? String(dataUrl) : null;
    if (!avatarPreviewSource) {
      avatarNaturalW = 0;
      avatarNaturalH = 0;
      if (avatarPreviewImage) avatarPreviewImage.removeAttribute("src");
      if (avatarPreviewWrap) avatarPreviewWrap.classList.add("hidden");
      return;
    }
    if (avatarPreviewWrap) avatarPreviewWrap.classList.remove("hidden");
    if (!avatarPreviewImage) return;
    avatarPreviewImage.onload = () => {
      avatarNaturalW = Number(avatarPreviewImage.naturalWidth || 0);
      avatarNaturalH = Number(avatarPreviewImage.naturalHeight || 0);
      renderAvatarPreviewTransform();
    };
    avatarPreviewImage.onerror = () => {
      avatarNaturalW = 0;
      avatarNaturalH = 0;
    };
    avatarPreviewImage.src = avatarPreviewSource;
  }

  async function imageFromDataUrl(dataUrl) {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image data"));
      img.src = dataUrl;
    });
  }

  async function buildTransformedAvatarDataUrl(originalDataUrl) {
    const src = await imageFromDataUrl(originalDataUrl);
    const out = 256;
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;

    const srcW = Math.max(1, Number(src.naturalWidth || src.width || 1));
    const srcH = Math.max(1, Number(src.naturalHeight || src.height || 1));
    const scale = Math.max(0.5, Math.min(2.5, avatarScalePct / 100));
    const coverScale = Math.max(out / srcW, out / srcH) * scale;
    const drawW = srcW * coverScale;
    const drawH = srcH * coverScale;
    const maxShiftX = Math.max(0, (drawW - out) / 2);
    const maxShiftY = Math.max(0, (drawH - out) / 2);
    const shiftX = (avatarOffsetXPct / 100) * maxShiftX;
    const shiftY = (avatarOffsetYPct / 100) * maxShiftY;
    const drawX = (out - drawW) / 2 + shiftX;
    const drawY = (out - drawH) / 2 + shiftY;

    ctx.clearRect(0, 0, out, out);
    ctx.drawImage(src, drawX, drawY, drawW, drawH);
    try {
      return canvas.toDataURL("image/png");
    } catch {
      // If canvas export is blocked (e.g. cross-origin image), keep original source.
      return originalDataUrl;
    }
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
      headers: { Authorization: `Bearer ${authToken}` }
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
      const err = new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
      err.statusCode = Number(response.status || 0);
      throw err;
    }
    return parsed;
  }

  function getApiBases() {
    // Prefer most recently successful base first.
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES.includes(resolved)) out.push(resolved);
    for (const base of API_BASES) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  async function request(path, init) {
    // Request helper with network-level failover only.
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
    // Pull current account and initialize all visible sections.
    setStatus("Loading your account...");
    const session = await request("/v1/auth/session", {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (session?.accessToken) setAuthToken(session.accessToken);
    const account = session?.account;
    if (!account) throw new Error("Could not load account");
    canChangePassword = !!account.canChangePassword;

    emailInput.value = account.email || "";
    displayNameInput.value = account.displayName || "";
    summary.textContent = `Signed in as ${account.displayName || "User"}`;
    if (!pendingAvatarData && !clearAvatar) {
      resetAvatarTransform();
      setAvatarPreviewSource(account.avatarUrl || null);
    }
    if (passwordSection) passwordSection.classList.toggle("hidden", !canChangePassword);
    if (!canChangePassword) {
      setPasswordStatus("Password change is unavailable for this account.");
    } else {
      setPasswordStatus("Use at least 8 characters.");
      await refreshTwofaStatus();
    }
    localStorage.setItem("fishbattery.account", JSON.stringify(account));
    await refreshDiscordLinkStatus();
    setStatus("You are signed in.");
  }

  clearAvatarBtn.addEventListener("click", () => {
    clearAvatar = true;
    pendingAvatarData = null;
    avatarFileInput.value = "";
    resetAvatarTransform();
    setAvatarPreviewSource(null);
    setStatus("Profile picture will be removed when you save.");
  });

  avatarFileInput.addEventListener("change", async () => {
    const file = avatarFileInput.files?.[0];
    if (!file) return;
    try {
      pendingAvatarData = await readAsDataUrl(file);
      clearAvatar = false;
      resetAvatarTransform();
      setAvatarPreviewSource(pendingAvatarData);
      setStatus(`Selected new profile picture: ${file.name}`);
    } catch {
      setStatus("Could not load the selected image. Please try another file.");
    }
  });

  avatarResetViewBtn?.addEventListener("click", () => {
    const hadNonDefault =
      avatarScalePct !== 100 || avatarOffsetXPct !== 0 || avatarOffsetYPct !== 0;
    resetAvatarTransform();
    if (avatarPreviewSource && hadNonDefault) avatarTransformDirty = true;
    renderAvatarPreviewTransform();
  });

  avatarPreviewFrame?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (!avatarPreviewSource || !avatarNaturalW || !avatarNaturalH) return;
    avatarDragging = true;
    avatarDragPointerId = event.pointerId;
    avatarDragStartX = event.clientX;
    avatarDragStartY = event.clientY;
    avatarDragStartOffsetX = avatarOffsetXPct;
    avatarDragStartOffsetY = avatarOffsetYPct;
    avatarPreviewFrame.setPointerCapture(event.pointerId);
    avatarPreviewFrame.classList.add("dragging");
  });

  avatarPreviewFrame?.addEventListener("pointermove", (event) => {
    if (!avatarDragging || avatarDragPointerId !== event.pointerId) return;
    const { maxShiftX, maxShiftY } = getAvatarShiftBoundsPx();
    const deltaX = event.clientX - avatarDragStartX;
    const deltaY = event.clientY - avatarDragStartY;
    avatarOffsetXPct =
      maxShiftX > 0 ? clamp(avatarDragStartOffsetX + (deltaX * 100) / maxShiftX, -100, 100) : 0;
    avatarOffsetYPct =
      maxShiftY > 0 ? clamp(avatarDragStartOffsetY + (deltaY * 100) / maxShiftY, -100, 100) : 0;
    avatarTransformDirty = true;
    renderAvatarPreviewTransform();
  });

  const endAvatarDrag = (event) => {
    if (avatarDragPointerId !== event.pointerId) return;
    avatarDragging = false;
    avatarDragPointerId = null;
    avatarPreviewFrame?.classList.remove("dragging");
    try {
      avatarPreviewFrame?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors
    }
  };

  avatarPreviewFrame?.addEventListener("pointerup", endAvatarDrag);
  avatarPreviewFrame?.addEventListener("pointercancel", endAvatarDrag);

  avatarPreviewFrame?.addEventListener(
    "wheel",
    (event) => {
      if (!avatarPreviewSource || !avatarNaturalW || !avatarNaturalH) return;
      event.preventDefault();
      avatarScalePct = clamp(avatarScalePct - event.deltaY * 0.06, 50, 250);
      avatarTransformDirty = true;
      renderAvatarPreviewTransform();
    },
    { passive: false }
  );

  saveBtn.addEventListener("click", async () => {
    try {
      const displayName = displayNameInput.value.trim();
      if (!displayName) {
        setStatus("Please enter a unique username.");
        return;
      }

      const body = { displayName };
      if (clearAvatar) {
        body.avatarUrl = null;
      } else if (pendingAvatarData || (avatarTransformDirty && avatarPreviewSource)) {
        const avatarSource = pendingAvatarData || avatarPreviewSource;
        body.avatarUrl = await buildTransformedAvatarDataUrl(avatarSource);
      }

      setStatus("Saving changes...");
      const updated = await request("/v1/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(body)
      });
      if (updated?.accessToken) setAuthToken(updated.accessToken);
      if (updated?.account) localStorage.setItem("fishbattery.account", JSON.stringify(updated.account));

      clearAvatar = false;
      pendingAvatarData = null;
      avatarFileInput.value = "";
      resetAvatarTransform();
      setStatus("Saved successfully.");
      await loadSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/(display name|username) already in use/i.test(message)) {
        setStatus("That username is already taken. Please choose another.");
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
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        if (updated?.accessToken) setAuthToken(updated.accessToken);
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
            Authorization: `Bearer ${authToken}`
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
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ code })
        });
        if (data?.accessToken) setAuthToken(data.accessToken);
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
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ currentPassword, code })
        });
        if (data?.accessToken) setAuthToken(data.accessToken);
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

  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", async () => {
      try {
        setPrivacyStatus("Preparing your data export...");
        const payload = await request("/v1/account/data-export", {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `fishbattery-account-export-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setPrivacyStatus("Data export downloaded.");
      } catch {
        setPrivacyStatus("Could not export your data right now. Please try again.");
      }
    });
  }

  if (discordLinkBtn) {
    discordLinkBtn.addEventListener("click", async () => {
      try {
        setDiscordStatus("Opening Discord linking flow...");
        const start = await request("/v1/account/discord/link/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ redirectUri: DISCORD_REDIRECT_URI })
        });
        if (!start?.authUrl) {
          throw new Error("Could not start Discord linking");
        }
        window.location.href = String(start.authUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setDiscordStatus(message || "Could not start Discord linking right now.");
      }
    });
  }

  if (discordUnlinkBtn) {
    discordUnlinkBtn.addEventListener("click", async () => {
      const confirmed = window.confirm("Unlink your Discord account from Fishbattery?");
      if (!confirmed) return;
      try {
        setDiscordStatus("Unlinking Discord...");
        await request("/v1/account/discord/unlink", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({})
        });
        setDiscordStatus("Discord unlinked.");
        await refreshDiscordLinkStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setDiscordStatus(message || "Could not unlink Discord right now.");
      }
    });
  }

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", async () => {
      const acknowledged = window.confirm(
        "This permanently deletes your Fishbattery account and cloud data. This cannot be undone. Continue?"
      );
      if (!acknowledged) return;

      const confirmText = window.prompt('Type DELETE to confirm account deletion.');
      if (confirmText !== "DELETE") {
        setPrivacyStatus("Account deletion cancelled.");
        return;
      }

      try {
        setPrivacyStatus("Deleting your account...");
        const body = { confirm: "DELETE" };
        if (canChangePassword) {
          const currentPassword = window.prompt("Enter your current password to confirm deletion.");
          if (!currentPassword) {
            setPrivacyStatus("Account deletion cancelled.");
            return;
          }
          body.currentPassword = currentPassword;
        }
        await request("/v1/account/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify(body)
        });
        localStorage.removeItem("fishbattery.token");
        localStorage.removeItem("fishbattery.account");
        window.location.href = "./index.html";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/current password is incorrect/i.test(message)) {
          setPrivacyStatus("Current password is incorrect.");
        } else {
          setPrivacyStatus("Could not delete account right now. Please try again.");
        }
      }
    });
  }

  applyDiscordCallbackResult();

  loadSession().catch((error) => {
    if (isAuthInvalidError(error)) {
      localStorage.removeItem("fishbattery.token");
      localStorage.removeItem("fishbattery.account");
      window.location.href = "./login.html";
      return;
    }
    setStatus("Could not verify your session right now. Check your connection and retry.");
  });
})();

