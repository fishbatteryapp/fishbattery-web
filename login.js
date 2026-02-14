(function initLoginPage() {
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

  const API_BASES = [
    "https://api.fishbattery.app",
    "https://fishbattery-auth-api-production.up.railway.app",
    "http://localhost:3000"
  ];

  let mode = "login";
  let pendingTwoFactorChallenge = "";

  function write(value) {
    statusText.textContent = String(value || "");
  }

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

  modeLoginBtn.addEventListener("click", () => setMode("login"));
  modeRegisterBtn.addEventListener("click", () => setMode("register"));

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

  function clearSession() {
    localStorage.removeItem("fishbattery.token");
    localStorage.removeItem("fishbattery.account");
  }

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

  function currentRedirectUri() {
    return `${window.location.origin}${window.location.pathname}`;
  }

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

  async function completeGoogleAuthFromQuery() {
    const query = new URLSearchParams(window.location.search);
    const code = String(query.get("code") || "").trim();
    const state = String(query.get("state") || "").trim();
    const oauthError = String(query.get("error") || "").trim();
    if (oauthError) {
      write("Google sign-in was canceled or failed.");
      query.delete("error");
      query.delete("error_description");
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

  function userErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes("already in use")) return "That email or display name is already in use.";
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
          write("Please choose a display name.");
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
        data = await request("/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName })
        });
      } else if (pendingTwoFactorChallenge) {
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
        data = await request("/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        if (data?.requiresTwoFactor && data?.challengeToken) {
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

  submitBtn.addEventListener("click", submitAuth);

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (mode !== "login") return;
    event.preventDefault();
    void submitAuth();
  });

  twoFactorInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (!pendingTwoFactorChallenge) return;
    event.preventDefault();
    void submitAuth();
  });

  googleAuthBtn.addEventListener("click", async () => {
    try {
      await startGoogleAuth();
    } catch (error) {
      write(userErrorMessage(error));
    }
  });

  const query = new URLSearchParams(window.location.search);
  setMode(query.get("mode") === "register" ? "register" : "login");
  completeGoogleAuthFromQuery()
    .catch((error) => write(userErrorMessage(error)))
    .finally(() => {
      tryRestoreSession();
    });
})();
