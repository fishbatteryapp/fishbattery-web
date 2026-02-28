(function initSiteNav() {
  // Purpose:
  // Keep top navigation/auth actions consistent across all website pages.
  //
  // Responsibilities:
  // - Restore session from token (if present).
  // - Render logged-out CTA or logged-in account pill + logout.
  // - Toggle sponsored sections by subscription status and consent state.

  // All pages that use this script provide an auth action container.
  const container = document.getElementById("authActions");
  if (!container) return;
  // Primary hosted API endpoint.
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  // Local development fallback logic.
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];

  // Remove local session artifacts.
  function clearSession() {
    localStorage.removeItem("fishbattery.token");
    localStorage.removeItem("fishbattery.account");
  }

  // Escape untrusted text before interpolation into HTML strings.
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Fallback avatar initials when no avatar image URL exists.
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

  // Logged-out rendering:
  // - Show Login / Create account buttons.
  // - Toggle helper classes used by page content (`show-logged-in/out`).
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

  // Premium and founder tiers are ad-free.
  function isAdsFreeAccount(account) {
    const tier = String(account?.subscriptionTier || account?.subscription_tier || "").toLowerCase();
    return tier === "premium" || tier === "founder";
  }

  // Show/hide sponsored slots based on account status and consent.
  function setSponsoredVisibility(showSponsored) {
    const consentApi = window.fishbatteryConsent;
    // If consent API is unavailable, default to true to avoid hiding unexpectedly.
    const hasConsent =
      !consentApi || typeof consentApi.hasAdConsent !== "function"
        ? true
        : !!consentApi.hasAdConsent();
    for (const el of document.querySelectorAll(".sponsored-slot")) {
      el.classList.toggle("hidden", !(showSponsored && hasConsent));
    }
  }

  // Prioritize previously successful API base for faster future calls.
  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES_DEFAULT.includes(resolved)) out.push(resolved);
    for (const base of API_BASES_DEFAULT) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  // Validate token by calling session endpoint on available API bases.
  async function tryRestoreAccountFromToken(token) {
    let sawTransientFailure = false;
    for (const base of getApiBases()) {
      try {
        const res = await fetch(`${base}/v1/auth/session`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            return { status: "invalid", account: null };
          }
          sawTransientFailure = true;
          continue;
        }
        const data = await res.json();
        const account = data?.account;
        if (!account) {
          sawTransientFailure = true;
          continue;
        }
        // Persist successful base and account cache.
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        localStorage.setItem("fishbattery.account", JSON.stringify(account));
        return { status: "ok", account };
      } catch {
        sawTransientFailure = true;
      }
    }
    return { status: sawTransientFailure ? "transient" : "invalid", account: null };
  }

  // Logged-in rendering:
  // - Account pill with avatar/initials.
  // - Logout button.
  // - Section visibility toggles.
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

  // Bootstrap:
  // If no token, render logged out immediately.
  const token = (localStorage.getItem("fishbattery.token") || "").trim();
  if (!token) {
    renderLoggedOut();
    return;
  }
  // While validating token, keep UI responsive and show temporary restoring state.
  setSponsoredVisibility(true);
  container.innerHTML = `<span class="hint">Restoring session...</span>`;
  // Resolve final nav state after token validation.
  tryRestoreAccountFromToken(token).then((result) => {
    if (result.status === "ok" && result.account) {
      renderLoggedIn(result.account);
      return;
    }

    if (result.status === "invalid") {
      clearSession();
      renderLoggedOut();
      return;
    }

    // Transient failure: keep current token and, if available, render cached account.
    try {
      const cached = JSON.parse(localStorage.getItem("fishbattery.account") || "null");
      if (cached && typeof cached === "object") {
        renderLoggedIn(cached);
        return;
      }
    } catch {
      // fall through to logged-out rendering without clearing session
    }
    renderLoggedOut();
  });
})();

