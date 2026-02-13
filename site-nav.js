(function initSiteNav() {
  const container = document.getElementById("authActions");
  if (!container) return;
  const API_BASES_DEFAULT = [
    "https://api.fishbattery.app",
    "https://fishbattery-auth-api-production.up.railway.app",
    "http://localhost:3000"
  ];

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
  }

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved) out.push(resolved);
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
  }

  const token = (localStorage.getItem("fishbattery.token") || "").trim();
  const rawAccount = localStorage.getItem("fishbattery.account");
  if (!token) {
    renderLoggedOut();
    return;
  }
  if (rawAccount) {
    try {
      const account = JSON.parse(rawAccount);
      renderLoggedIn(account);
      return;
    } catch {
      // fall through to restore
    }
  }

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
