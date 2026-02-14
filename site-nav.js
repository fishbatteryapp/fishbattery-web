(function initSiteNav() {
  const container = document.getElementById("authActions");
  if (!container) return;
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];

  function clearSession() {
    localStorage.removeItem("fishbattery.token");
    localStorage.removeItem("fishbattery.account");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initialsFor(name) {
    const cleaned = String(name || "").trim();
    if (!cleaned) return "U";
    return cleaned
      .split(/\s+/)
      .map((part) => part[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function renderLoggedOut() {
    container.innerHTML = `
      <a class="btn" href="./login.html">Log in</a>
      <a class="btn btn-primary" href="./login.html?mode=register">Create account</a>
    `;
    for (const el of document.querySelectorAll(".show-logged-out")) {
      el.classList.remove("hidden");
    }
    for (const el of document.querySelectorAll(".show-logged-in")) {
      el.classList.add("hidden");
    }
    setSponsoredVisibility(true);
  }

  function isAdsFreeAccount(account) {
    const tier = String(account?.subscriptionTier || account?.subscription_tier || "").toLowerCase();
    return tier === "premium" || tier === "founder";
  }

  function setSponsoredVisibility(showSponsored) {
    for (const el of document.querySelectorAll(".sponsored-slot")) {
      el.classList.toggle("hidden", !showSponsored);
    }
  }

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES_DEFAULT.includes(resolved)) out.push(resolved);
    for (const base of API_BASES_DEFAULT) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  async function tryRestoreAccountFromToken(token) {
    for (const base of getApiBases()) {
      try {
        const res = await fetch(`${base}/v1/auth/session`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) continue;
        const data = await res.json();
        const account = data?.account;
        if (!account) continue;
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        localStorage.setItem("fishbattery.account", JSON.stringify(account));
        return account;
      } catch {
        // try next base
      }
    }
    return null;
  }

  function renderLoggedIn(account) {
    const name = account?.displayName || "Signed in";
    const avatarUrl = String(account?.avatarUrl || "").trim();
    const avatarMarkup = avatarUrl
      ? `<img class="account-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" />`
      : `<span class="account-avatar-fallback">${initialsFor(name)}</span>`;
    container.innerHTML = `
      <a class="account-pill" href="./account.html" title="Account settings">
        <span class="account-avatar-wrap">${avatarMarkup}</span>
        <span>${name}</span>
      </a>
      <button id="topLogout" class="btn">Log out</button>
    `;
    const logoutBtn = document.getElementById("topLogout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearSession();
        window.location.href = "./index.html";
      });
    }
    for (const el of document.querySelectorAll(".show-logged-out")) {
      el.classList.add("hidden");
    }
    for (const el of document.querySelectorAll(".show-logged-in")) {
      el.classList.remove("hidden");
    }
    setSponsoredVisibility(!isAdsFreeAccount(account));
  }

  const token = (localStorage.getItem("fishbattery.token") || "").trim();
  if (!token) {
    renderLoggedOut();
    return;
  }
  // While restoring, keep sponsored slots visible by default.
  setSponsoredVisibility(true);
  container.innerHTML = `<span class="hint">Restoring session...</span>`;
  tryRestoreAccountFromToken(token).then((account) => {
    if (account) {
      renderLoggedIn(account);
    } else {
      clearSession();
      renderLoggedOut();
    }
  });
})();

