(function initUpgradePage() {
  const sessionSummary = document.getElementById("sessionSummary");
  const statusText = document.getElementById("statusText");
  const API_BASES_DEFAULT = [
    "https://api.fishbattery.app",
    "https://fishbattery-auth-api-production.up.railway.app",
    "http://localhost:3000"
  ];
  const token = localStorage.getItem("fishbattery.token") || "";

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved) out.push(resolved);
    for (const base of API_BASES_DEFAULT) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  function write(value) {
    statusText.textContent = String(value || "");
  }

  function errorText(error) {
    const raw = String((error && error.message) || error || "").trim();
    if (!raw) return "Unknown error";
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.message) return String(parsed.message);
    } catch {
      // not json
    }
    return raw;
  }

  function getToken() {
    return (localStorage.getItem("fishbattery.token") || "").trim();
  }

  async function parseResponse(response) {
    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep plain text
    }
    if (!response.ok) {
      throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    }
    return parsed;
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

  async function checkSession() {
    const token = getToken();
    if (!token) {
      window.location.href = "./login.html";
      return;
    }
    write("Checking your account...");
    const data = await request("/v1/auth/session", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const account = data?.account;
    if (account) {
      sessionSummary.textContent = `Signed in as ${account.displayName} (${account.email})`;
      localStorage.setItem("fishbattery.account", JSON.stringify(account));
    } else {
      sessionSummary.textContent = "Signed in";
    }
    write("You are signed in.");
  }

  async function checkSubscription() {
    const token = getToken();
    if (!token) {
      window.location.href = "./login.html";
      return;
    }
    write("Checking your current plan...");
    const data = await request("/v1/subscription/status", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const plan = String(data?.tier || "free");
    write(`Current plan: ${plan.charAt(0).toUpperCase()}${plan.slice(1)}.`);
  }

  async function startCheckout(plan) {
    const token = getToken();
    if (!token) {
      window.location.href = "./login.html";
      return;
    }
    write("Opening secure checkout...");
    const data = await request("/v1/billing/checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });
    if (data && data.url) window.location.href = data.url;
    else write("Could not open checkout. Please try again.");
  }

  async function openPortal() {
    const token = getToken();
    if (!token) {
      window.location.href = "./login.html";
      return;
    }
    write("Opening billing settings...");
    const data = await request("/v1/billing/portal-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({})
    });
    if (data && data.url) window.location.href = data.url;
    else write("Could not open billing settings. Please try again.");
  }

  document.getElementById("checkSession").addEventListener("click", async () => {
    try {
      await checkSession();
    } catch (error) {
      write("Could not refresh your account right now.");
    }
  });

  document.getElementById("checkSub").addEventListener("click", async () => {
    try {
      await checkSubscription();
    } catch (error) {
      write("Could not load your plan right now.");
    }
  });

  document.getElementById("upgradeMonthly").addEventListener("click", async () => {
    try {
      await startCheckout("monthly");
    } catch (error) {
      const msgRaw = errorText(error);
      const msg = msgRaw.toLowerCase();
      if (msg.includes("billing is not configured") || msg.includes("premium prices are not configured")) {
        write("Premium checkout is not live yet. Please try again later.");
      } else if (msg.includes("failed to fetch") || msg.includes("name_not_resolved")) {
        write("Cannot reach billing right now. Please check your connection and try again.");
      } else {
        write(`Checkout failed: ${msgRaw}`);
      }
    }
  });

  document.getElementById("upgradeYearly").addEventListener("click", async () => {
    try {
      await startCheckout("yearly");
    } catch (error) {
      const msgRaw = errorText(error);
      const msg = msgRaw.toLowerCase();
      if (msg.includes("billing is not configured") || msg.includes("premium prices are not configured")) {
        write("Premium checkout is not live yet. Please try again later.");
      } else if (msg.includes("failed to fetch") || msg.includes("name_not_resolved")) {
        write("Cannot reach billing right now. Please check your connection and try again.");
      } else {
        write(`Checkout failed: ${msgRaw}`);
      }
    }
  });

  document.getElementById("openPortal").addEventListener("click", async () => {
    try {
      await openPortal();
    } catch (error) {
      const msgRaw = errorText(error);
      const msg = msgRaw.toLowerCase();
      if (msg.includes("billing is not configured")) {
        write("Billing is not live yet. Please try again later.");
      } else if (msg.includes("failed to fetch") || msg.includes("name_not_resolved")) {
        write("Cannot reach billing right now. Please check your connection and try again.");
      } else {
        write(`Could not open billing settings: ${msgRaw}`);
      }
    }
  });

  document.getElementById("signOut").addEventListener("click", async () => {
    localStorage.removeItem("fishbattery.token");
    localStorage.removeItem("fishbattery.account");
    window.location.href = "./login.html";
  });

  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  const cachedAccount = localStorage.getItem("fishbattery.account");
  if (cachedAccount) {
    try {
      const account = JSON.parse(cachedAccount);
      if (account?.displayName && account?.email) {
        sessionSummary.textContent = `Signed in as ${account.displayName} (${account.email})`;
      }
    } catch {
      // ignore invalid cache
    }
  }

  checkSession().catch((error) => {
    sessionSummary.textContent = "Session invalid. Please sign in again.";
    write("Your session expired. Please sign in again.");
    localStorage.removeItem("fishbattery.token");
    localStorage.removeItem("fishbattery.account");
  });
})();
