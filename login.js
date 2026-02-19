(function initLoginPage() {
  // Login page controller.
  // Handles:
  // - Login/register mode switching
  // - Password auth (+ optional 2FA challenge flow)
  // - Google OAuth redirect flow
  // - Session restore/redirect if already authenticated

  // Core form/UI references.
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const displayNameInput = document.getElementById("displayName");
  const displayNameField = document.getElementById("displayNameField");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const confirmPasswordField = document.getElementById("confirmPasswordField");
  const twoFactorInput = document.getElementById("twoFactorCode");
  const twoFactorField = document.getElementById("twoFactorField");
  const statusText = document.getElementById("statusText");
  const authHeading = document.getElementById("authHeading");
  const passwordSubtitle = document.getElementById("passwordSubtitle");
  const modeLoginBtn = document.getElementById("modeLogin");
  const modeRegisterBtn = document.getElementById("modeRegister");
  const submitBtn = document.getElementById("submitAuth");
  const googleAuthBtn = document.getElementById("googleAuth");

  // API resolution:
  // - Production URL is always available
  // - Local URL is tried as fallback during local development
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];

  let mode = "login";
  let pendingTwoFactorChallenge = "";

  // Small status text helper for user feedback.
  function write(value) {
    statusText.textContent = String(value || "");
  }

  // Toggle between login/register UI states.
  function setMode(nextMode) {
    mode = nextMode;
    const register = mode === "register";
    displayNameField.classList.toggle("hidden", !register);
    confirmPasswordField.classList.toggle("hidden", !register);
    twoFactorField.classList.add("hidden");
    pendingTwoFactorChallenge = "";
    if (twoFactorInput) twoFactorInput.value = "";
    modeLoginBtn.classList.toggle("btn-primary", !register);
    modeRegisterBtn.classList.toggle("btn-primary", register);
    modeLoginBtn.classList.toggle("btn", register);
    modeRegisterBtn.classList.toggle("btn", !register);
    submitBtn.textContent = register ? "Create account" : "Sign in";
    authHeading.textContent = register ? "Create account" : "Sign in";
    passwordSubtitle.textContent = register ? "Or create an account yourself" : "Or use a password";
    write(register ? "Create your account to get started." : "Sign in with your account.");
  }

  // Mode switch buttons.
  modeLoginBtn.addEventListener("click", () => setMode("login"));
  modeRegisterBtn.addEventListener("click", () => setMode("register"));

  // Parse both JSON and plain-text error responses from API.
  async function parseResponse(res) {
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      // plain text response
    }
    if (!res.ok) {
      throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    }
    return data;
  }

  // Order API bases so previously successful one is tried first.
  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES.includes(resolved)) out.push(resolved);
    for (const base of API_BASES) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  // Network request helper with base failover for connectivity issues.
  async function request(path, init) {
    let lastError = new Error("Request failed");
    for (const base of getApiBases()) {
      try {
        const res = await fetch(`${base}${path}`, init);
        const data = await parseResponse(res);
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        return data;
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

  // Clear stored web auth state.
  function clearSession() {
    localStorage.removeItem("fishbattery.token");
    localStorage.removeItem("fishbattery.account");
  }

  // If token exists and is valid, skip login page and move to account settings.
  async function tryRestoreSession() {
    const token = (localStorage.getItem("fishbattery.token") || "").trim();
    if (!token) return;
    try {
      const data = await request("/v1/auth/session", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (data?.account) localStorage.setItem("fishbattery.account", JSON.stringify(data.account));
      window.location.href = "./account.html";
    } catch {
      clearSession();
    }
  }

  // OAuth redirect URI is current page URL.
  function currentRedirectUri() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  // Start Google OAuth by requesting start params from API and redirecting.
  async function startGoogleAuth() {
    write("Opening Google sign-in...");
    const redirectUri = currentRedirectUri();
    const startData = await request("/v1/auth/google/desktop/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirectUri })
    });
    if (!startData?.authUrl) throw new Error("Could not start Google sign-in");
    window.location.href = startData.authUrl;
  }

  // Complete OAuth flow when redirected back with code+state in query string.
  async function completeGoogleAuthFromQuery() {
    const query = new URLSearchParams(window.location.search);
    const code = String(query.get("code") || "").trim();
    const state = String(query.get("state") || "").trim();
    const oauthError = String(query.get("error") || "").trim();
    if (oauthError) {
      write("Google sign-in was canceled or failed.");
      query.delete("error");
      query.delete("error_description");
      // Clean URL after handled error.
      window.history.replaceState({}, "", `${window.location.pathname}?${query.toString()}`.replace(/\?$/, ""));
      return;
    }
    if (!code || !state) return;

    write("Finalizing Google sign-in...");
    const redirectUri = currentRedirectUri();
    const data = await request("/v1/auth/google/desktop/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, code, redirectUri })
    });

    if (!data?.accessToken) throw new Error("Google sign-in did not return a session token");
    localStorage.setItem("fishbattery.token", data.accessToken);
    if (data.account) localStorage.setItem("fishbattery.account", JSON.stringify(data.account));
    query.delete("code");
    query.delete("state");
    query.delete("scope");
    query.delete("authuser");
    query.delete("prompt");
    window.history.replaceState({}, "", `${window.location.pathname}${query.toString() ? `?${query.toString()}` : ""}`);
    window.location.href = "./account.html";
  }

  // Map low-level/server errors to clearer user-facing messages.
  function userErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes("already in use")) return "That email or username is already in use.";
    if (lower.includes("invalid credentials")) return "Wrong email or password. Please try again.";
    if (lower.includes("invalid authenticator code")) return "Authenticator code is invalid. Try the latest 6-digit code.";
    if (lower.includes("2fa challenge is invalid or expired")) return "Your 2FA challenge expired. Sign in again.";
    if (lower.includes("failed to fetch") || lower.includes("name_not_resolved") || lower.includes("network")) {
      return "Cannot reach the server right now. Please try again in a minute.";
    }
    if (lower.includes("google auth is not configured")) {
      return "Google sign-in is not configured yet.";
    }
    if (lower.includes("redirecturi")) {
      return "Google redirect setup is incomplete. Please contact support.";
    }
    return "Could not complete authentication right now. Please try again.";
  }

  // Primary submit handler for:
  // - register
  // - login
  // - 2FA verification step
  async function submitAuth() {
    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const displayName = displayNameInput.value.trim();
      const confirmPassword = confirmPasswordInput.value;
      if (!email || !password) {
        write("Please enter your email and password.");
        return;
      }
      if (mode === "register") {
        if (!displayName) {
          write("Please choose a unique username.");
          return;
        }
        if (password !== confirmPassword) {
          write("Passwords do not match.");
          return;
        }
      }
      write(mode === "register" ? "Creating your account..." : "Signing you in...");

      let data;
      if (mode === "register") {
        // Registration path.
        data = await request("/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName })
        });
      } else if (pendingTwoFactorChallenge) {
        // 2FA completion path after challenge was issued.
        const code = String(twoFactorInput?.value || "").replace(/\s+/g, "");
        if (!/^\d{6}$/.test(code)) {
          write("Enter a valid 6-digit authenticator code.");
          return;
        }
        data = await request("/v1/auth/login/2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeToken: pendingTwoFactorChallenge, code })
        });
      } else {
        // First-step login (may return requiresTwoFactor).
        data = await request("/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        if (data?.requiresTwoFactor && data?.challengeToken) {
          // Switch UI into 2FA mode while preserving challenge token.
          pendingTwoFactorChallenge = String(data.challengeToken);
          twoFactorField.classList.remove("hidden");
          submitBtn.textContent = "Verify code";
          write("Enter your 6-digit authenticator code to finish signing in.");
          twoFactorInput?.focus();
          return;
        }
      }

      if (!data?.accessToken) throw new Error("Missing session token");
      localStorage.setItem("fishbattery.token", data.accessToken);
      if (data.account) localStorage.setItem("fishbattery.account", JSON.stringify(data.account));
      write("Success. Redirecting...");
      window.location.href = "./account.html";
    } catch (error) {
      write(userErrorMessage(error));
    }
  }

  // Main submit click.
  submitBtn.addEventListener("click", submitAuth);

  // Enter key shortcut for password login.
  passwordInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (mode !== "login") return;
    event.preventDefault();
    void submitAuth();
  });

  // Enter key shortcut for 2FA code submit.
  twoFactorInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (!pendingTwoFactorChallenge) return;
    event.preventDefault();
    void submitAuth();
  });

  // Google auth button.
  googleAuthBtn.addEventListener("click", async () => {
    try {
      await startGoogleAuth();
    } catch (error) {
      write(userErrorMessage(error));
    }
  });

  // Initial bootstrap:
  // 1) Set mode from query (?mode=register)
  // 2) Complete OAuth if redirect params exist
  // 3) Otherwise try session restore
  const query = new URLSearchParams(window.location.search);
  setMode(query.get("mode") === "register" ? "register" : "login");
  completeGoogleAuthFromQuery()
    .catch((error) => write(userErrorMessage(error)))
    .finally(() => {
      tryRestoreSession();
    });
})();

