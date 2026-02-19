(function initConsentManager() {
  // Purpose:
  // Manage user consent for optional advertising cookies/scripts.
  //
  // Design:
  // - Persist consent in localStorage so choice survives reloads.
  // - Expose a tiny runtime API on window (`fishbatteryConsent`) for other modules.
  // - Broadcast updates through a custom event so ads/nav can react immediately.

  // Versioned storage key lets us migrate behavior later without clobbering unrelated data.
  const STORAGE_KEY = "fishbattery.consent.v1";

  // Read persisted consent. Returns:
  // - { advertising: boolean, updatedAt: number } when valid
  // - null when missing/invalid
  function readConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Strict validation: if advertising is not explicit boolean, treat as no consent.
      if (typeof parsed?.advertising !== "boolean") return null;
      return {
        advertising: parsed.advertising,
        // Keep a best-effort timestamp to help future auditing/debugging.
        updatedAt: Number(parsed.updatedAt || 0) || Date.now()
      };
    } catch {
      // If localStorage/JSON fails, continue safely with "unknown consent".
      return null;
    }
  }

  // Persist consent and emit a global event for live UI updates.
  function writeConsent(advertising) {
    const next = { advertising: !!advertising, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Consumers (ads.js/site-nav.js) listen to this event and update without reload.
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

  // Build and insert the visible cookie banner for first-time visitors.
  function createBanner() {
    const root = document.createElement("aside");
    root.className = "consent-banner";
    // Keep markup static/simple so the style layer controls appearance.
    root.innerHTML = `
      <div class="consent-banner-copy">
        <h2 class="consent-banner-title">We use cookies</h2>
        <p>
          We use essential cookies to keep the site working, and optional advertising cookies to show sponsored content.
          Click <strong>Accept</strong> to allow optional cookies, or <strong>Reject</strong> to continue with essential cookies only.
        </p>
      </div>
      <div class="consent-banner-actions">
        <button class="btn btn-primary" type="button" data-consent-choice="accept">Accept</button>
        <button class="btn" type="button" data-consent-choice="reject">Reject</button>
        <button class="btn consent-settings-btn" type="button" data-consent-action="settings">Cookie settings</button>
      </div>
    `;
    // Wire Accept/Reject actions.
    for (const button of root.querySelectorAll("[data-consent-choice]")) {
      button.addEventListener("click", () => {
        const choice = String(button.getAttribute("data-consent-choice") || "");
        writeConsent(choice === "accept");
        // Remove banner after explicit choice.
        root.remove();
      });
    }
    // "Cookie settings" links users to the policy section.
    const settingsBtn = root.querySelector("[data-consent-action='settings']");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        const current = String(window.location.pathname || "").toLowerCase();
        // If already on privacy page, just jump to section.
        if (current.endsWith("/privacy.html") || current.endsWith("privacy.html")) {
          window.location.hash = "cookies-and-tracking";
          return;
        }
        // Otherwise navigate there directly.
        window.location.href = "./privacy.html#cookies-and-tracking";
      });
    }
    document.body.appendChild(root);
  }

  // Public runtime API used by other scripts.
  window.fishbatteryConsent = {
    hasAdConsent,
    get: readConsent,
    setAdvertising: (value) => writeConsent(!!value)
  };

  // Show banner only when no prior choice exists.
  if (!readConsent()) {
    // If DOM is still loading, wait to avoid injecting before body exists.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createBanner, { once: true });
    } else {
      createBanner();
    }
  }
})();
