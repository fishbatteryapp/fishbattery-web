(function initLoginPage() {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const displayNameInput = document.getElementById("displayName");
  const displayNameField = document.getElementById("displayNameField");
  const statusText = document.getElementById("statusText");
  const modeLoginBtn = document.getElementById("modeLogin");
  const modeRegisterBtn = document.getElementById("modeRegister");
  const submitBtn = document.getElementById("submitAuth");
  const API_BASES = [
    "https://api.fishbattery.app",
    "https://fishbattery-auth-api-production.up.railway.app",
    "http://localhost:3000"
  ];

  let mode = "login";

  function write(value) {
    statusText.textContent = String(value || "");
  }

  function setMode(nextMode) {
    mode = nextMode;
    const register = mode === "register";
    displayNameField.classList.toggle("hidden", !register);
    modeLoginBtn.classList.toggle("btn-primary", !register);
    modeRegisterBtn.classList.toggle("btn-primary", register);
    modeLoginBtn.classList.toggle("btn", register);
    modeRegisterBtn.classList.toggle("btn", !register);
    submitBtn.textContent = register ? "Create account" : "Sign in";
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
      // text
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
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError;
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
      localStorage.removeItem("fishbattery.token");
      localStorage.removeItem("fishbattery.account");
    }
  }

  submitBtn.addEventListener("click", async () => {
    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const displayName = displayNameInput.value.trim();
      if (!email || !password) {
        write("Please enter your email and password.");
        return;
      }
      if (mode === "register" && !displayName) {
        write("Please choose a display name.");
        return;
      }
      write(mode === "register" ? "Creating your account..." : "Signing you in...");

      const route = mode === "register" ? "/v1/auth/register" : "/v1/auth/login";
      const body =
        mode === "register"
          ? { email, password, displayName }
          : { email, password };
      const data = await request(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!data?.accessToken) {
        throw new Error("Something went wrong. Please try again.");
      }

      localStorage.setItem("fishbattery.token", data.accessToken);
      if (data.account) localStorage.setItem("fishbattery.account", JSON.stringify(data.account));
      write("Success. Redirecting...");
      window.location.href = "./account.html";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already in use/i.test(message)) {
        write("That email or display name is already in use.");
      } else if (/invalid credentials/i.test(message)) {
        write("Wrong email or password. Please try again.");
      } else if (/failed to fetch|name_not_resolved|network/i.test(message.toLowerCase())) {
        write("Cannot reach the server right now. Please try again in a minute.");
      } else {
        write("Could not complete sign-in right now. Please try again.");
      }
    }
  });

  const query = new URLSearchParams(window.location.search);
  setMode(query.get("mode") === "register" ? "register" : "login");
  tryRestoreSession();
})();
