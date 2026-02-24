(function initConsentManager() {
  const STORAGE_KEY = "fishbattery.consent.v2"; // bump version to reset old choices if needed

  function readConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.advertising !== "boolean") return null;
      return {
        advertising: parsed.advertising,
        updatedAt: Number(parsed.updatedAt || 0) || Date.now()
      };
    } catch {
      return null;
    }
  }

  function writeConsent(advertising) {
    const next = { advertising: !!advertising, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent("fishbattery:consent-changed", {
        detail: { advertising: next.advertising, updatedAt: next.updatedAt }
      })
    );
    return next;
  }

  function hasAdConsent() {
    return !!readConsent()?.advertising;
  }

  function ensureBannerStylesHooked(root) {
    // Optional: allow ESC to close banner without consenting (keeps it shown next load)
    function onKeyDown(e) {
      if (e.key === "Escape") root.remove();
    }
    window.addEventListener("keydown", onKeyDown);
    root.addEventListener("remove", () => window.removeEventListener("keydown", onKeyDown));
  }

  function createBanner() {
    // If consent already decided, no banner.
    if (readConsent()) return;

    const root = document.createElement("aside");
    root.className = "consent-banner";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Cookie consent");

    root.innerHTML = `
      <div class="consent-banner-copy">
        <h2 class="consent-banner-title">We use cookies</h2>
        <p>
          We use essential cookies to keep the site working.
          With your permission, we also use advertising cookies to show sponsored content.
        </p>
      </div>
      <div class="consent-banner-actions">
        <button class="btn btn-primary" type="button" data-consent-choice="accept">Accept</button>
        <button class="btn" type="button" data-consent-choice="reject">Reject</button>
        <button class="btn consent-settings-btn" type="button" data-consent-action="settings">Cookie settings</button>
      </div>
    `;

    // Accept / Reject
    for (const button of root.querySelectorAll("[data-consent-choice]")) {
      button.addEventListener("click", () => {
        const choice = String(button.getAttribute("data-consent-choice") || "");
        writeConsent(choice === "accept");
        root.remove();
      });
    }

    // Settings = go to privacy section
    const settingsBtn = root.querySelector("[data-consent-action='settings']");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        const current = String(window.location.pathname || "").toLowerCase();
        if (current.endsWith("/privacy.html") || current.endsWith("privacy.html")) {
          window.location.hash = "cookies-and-tracking";
        } else {
          window.location.href = "./privacy.html#cookies-and-tracking";
        }
      });
    }

    document.body.appendChild(root);
    ensureBannerStylesHooked(root);
  }

  // Public API (add a revoke helper)
  window.fishbatteryConsent = {
    hasAdConsent,
    get: readConsent,
    setAdvertising: (value) => writeConsent(!!value),
    revokeAdvertising: () => writeConsent(false),
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("fishbattery:consent-changed", { detail: { advertising: false } }));
      createBanner();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createBanner, { once: true });
  } else {
    createBanner();
  }
})();
