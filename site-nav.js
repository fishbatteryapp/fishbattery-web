(function initSiteNav() {
  // Purpose:
  // Keep top navigation/auth actions consistent across all website pages.
  //
  // Responsibilities:
  // - Restore session from token (if present).
  // - Render logged-out CTA or logged-in account pill + logout.
  // - Toggle sponsored sections by subscription status.

  function applyPerformanceMode() {
    const root = document.documentElement;
    if (!root) return;
    try {
      const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = !!(navigator.connection && navigator.connection.saveData);
      const lowMemory = Number(navigator.deviceMemory || 0) > 0 && Number(navigator.deviceMemory || 0) <= 4;
      const lowCores = Number(navigator.hardwareConcurrency || 0) > 0 && Number(navigator.hardwareConcurrency || 0) <= 4;
      const lowPerf = reducedMotion || saveData || lowMemory || lowCores;
      root.classList.toggle("low-perf", lowPerf);
      root.classList.toggle("reduced-motion", reducedMotion);
    } catch {
      // Keep default visuals if capability detection fails.
    }
  }

  applyPerformanceMode();

  function ensurePhotoCredit() {
    const legalCopy = document.querySelector(".legal-footer .legal-copy");
    if (!legalCopy || legalCopy.querySelector(".photo-credit")) return;
    const credit = document.createElement("span");
    credit.className = "photo-credit";
    credit.innerHTML =
      'Photo by <a href="https://unsplash.com/@_actually_?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer">Ali Abdul Rahman</a> on <a href="https://unsplash.com/photos/blue-body-of-water-during-daytime-Xva-TYqwHhA?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer">Unsplash</a>';
    legalCopy.appendChild(credit);
  }

  ensurePhotoCredit();

  // Primary hosted API endpoint.
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  // Local development fallback logic.
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];
  // All pages that use this script provide an auth action container.
  const container = document.getElementById("authActions");
  if (!container) return;

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

  // Show/hide sponsored slots based on account status only.
  function setSponsoredVisibility(showSponsored) {
    for (const el of document.querySelectorAll(".sponsored-slot")) {
      el.classList.toggle("hidden", !showSponsored);
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

  async function requestJson(path, init) {
    let lastError = new Error("Request failed");
    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}${path}`, init);
        const text = await response.text();
        let parsed = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep text
        }
        if (!response.ok) {
          throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
        }
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

  function getAffiliateSessionId() {
    const existing = (localStorage.getItem("fishbattery.affiliateSessionId") || "").trim();
    if (existing) return existing;
    const created = `aff_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem("fishbattery.affiliateSessionId", created);
    return created;
  }

  function storeAffiliateReferral(code) {
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) return;
    const now = Date.now();
    try {
      const current = JSON.parse(localStorage.getItem("fishbattery.affiliateReferral") || "null") || {};
      const next = {
        code: normalized,
        firstSeenAt: Number(current.firstSeenAt || now) || now,
        lastSeenAt: now
      };
      localStorage.setItem("fishbattery.affiliateReferral", JSON.stringify(next));
    } catch {
      localStorage.setItem("fishbattery.affiliateReferral", JSON.stringify({
        code: normalized,
        firstSeenAt: now,
        lastSeenAt: now
      }));
    }
  }

  async function trackAffiliateReferralFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const referralCode = String(params.get("ref") || "").trim().toUpperCase();
    if (!referralCode) return;

    storeAffiliateReferral(referralCode);
    const payload = {
      referralCode,
      sessionId: getAffiliateSessionId(),
      path: `${window.location.pathname}${window.location.search}`,
      referrerHost: (() => {
        try {
          return document.referrer ? new URL(document.referrer).host : "";
        } catch {
          return "";
        }
      })()
    };

    const authToken = (localStorage.getItem("fishbattery.token") || "").trim();
    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}/v1/affiliate/visit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          localStorage.setItem("fishbattery.apiBaseResolved", base);
          break;
        }
      } catch {
        // Ignore tracking failures; never block navigation rendering.
      }
    }
  }

  function ensureAffiliateTermsModal() {
    let modal = document.getElementById("affiliateTermsModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "affiliateTermsModal";
    modal.className = "affiliate-terms-modal hidden";
    modal.innerHTML = `
      <div class="affiliate-terms-modal-backdrop"></div>
      <section class="affiliate-terms-modal-panel" role="dialog" aria-modal="true" aria-labelledby="affiliateTermsModalTitle">
        <p class="kicker">Affiliate update</p>
        <h2 id="affiliateTermsModalTitle">Affiliate terms updated</h2>
        <p id="affiliateTermsModalLead" class="lead">You need to accept the updated terms before continuing as a Fishbattery affiliate.</p>
        <p id="affiliateTermsModalMeta" class="hint"></p>
        <div class="checkbox-row">
          <input id="affiliateTermsModalCheckbox" class="checkbox-input" type="checkbox" />
          <label for="affiliateTermsModalCheckbox" id="affiliateTermsModalCheckboxLabel" class="checkbox-label"></label>
        </div>
        <div class="actions">
          <a class="btn" href="./affiliate-terms.html" target="_blank" rel="noreferrer">Read updated terms</a>
          <button id="affiliateTermsModalAgree" class="btn btn-primary" type="button">Agree and continue</button>
        </div>
        <p id="affiliateTermsModalStatus" class="hint"></p>
      </section>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function showAffiliateTermsModal(data, token) {
    const modal = ensureAffiliateTermsModal();
    const checkbox = document.getElementById("affiliateTermsModalCheckbox");
    const checkboxLabel = document.getElementById("affiliateTermsModalCheckboxLabel");
    const meta = document.getElementById("affiliateTermsModalMeta");
    const status = document.getElementById("affiliateTermsModalStatus");
    const agreeBtn = document.getElementById("affiliateTermsModalAgree");
    if (!checkbox || !checkboxLabel || !meta || !status || !agreeBtn) return;

    checkbox.checked = false;
    checkboxLabel.textContent = String(data?.checkboxLabel || "I agree to the updated affiliate terms.");
    meta.textContent = `Accepted version: ${String(data?.acceptedTermsVersion || "none")} • Current version: ${String(data?.currentTermsVersion || "current")} • Effective date: ${String(data?.effectiveDate || "")}`;
    status.textContent = "Accept the updated terms to keep using your affiliate account.";
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    agreeBtn.onclick = async () => {
      if (!checkbox.checked) {
        status.textContent = "Tick the checkbox first.";
        return;
      }
      try {
        status.textContent = "Saving your acceptance...";
        agreeBtn.setAttribute("disabled", "disabled");
        await requestJson("/v1/affiliate/accept-terms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ acceptedTerms: true })
        });
        status.textContent = "Updated terms accepted.";
        modal.classList.add("hidden");
        document.body.style.overflow = "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.textContent = `Could not save your acceptance: ${message}`;
      } finally {
        agreeBtn.removeAttribute("disabled");
      }
    };
  }

  async function maybePromptAffiliateTerms(token) {
    try {
      const data = await requestJson("/v1/affiliate/terms-status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!data?.hasAffiliateAccount || !data?.needsAcceptance) return;
      showAffiliateTermsModal(data, token);
    } catch {
      // Non-blocking if the affiliate terms check fails.
    }
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
        const refreshedToken = String(data?.accessToken || "").trim();
        // Persist successful base and account cache.
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        if (refreshedToken) {
          localStorage.setItem("fishbattery.token", refreshedToken);
        }
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

  void trackAffiliateReferralFromQuery();

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
      void maybePromptAffiliateTerms((localStorage.getItem("fishbattery.token") || "").trim() || token);
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

