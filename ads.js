(function initSponsoredAds() {
  // Purpose:
  // Render sponsored slots in a consent-aware way.
  //
  // Flow:
  // 1) If no ad slots exist on page, exit.
  // 2) Wait for consent state.
  // 3) If consented:
  //    - In test mode: render fallback feed
  //    - Otherwise: try AdSense; if no-fill/fail -> fallback feed

  // All supported ad placeholders on the current page.
  const slots = Array.from(document.querySelectorAll(".sponsored-slot[data-ad-placement]"));
  if (!slots.length) return;

  // Static fallback feeds (used when API feed is unavailable).
  const FEED_URLS = ["./assets/ads.json", "https://fishbatteryapp.github.io/fishbattery-web/assets/ads.json"];

  // AdSense bootstrap source.
  const ADSENSE_SRC =
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8826985281954941";
  // Shared auth API base used for analytics ingestion.
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];

  // Keep one shared in-flight promise to avoid duplicate script insertions.
  let adsenseLoadPromise = null;

  // Fallback scheduling guards
  let fallbackTimer = null;
  let fallbackRendered = false;
  let trackedImpressionKeys = new Set();

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES_DEFAULT.includes(resolved)) out.push(resolved);
    for (const base of API_BASES_DEFAULT) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  function getSessionId() {
    const key = "fishbattery.ads.sessionId";
    let value = String(localStorage.getItem(key) || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{8,128}$/.test(value)) {
      value = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(key, value);
    }
    return value;
  }

  async function postAdEvent(eventType, campaignId, placement) {
    const payload = {
      eventType,
      campaignId: String(campaignId || "").trim().toLowerCase(),
      placement: String(placement || "").trim().toLowerCase(),
      pagePath: window.location.pathname || "/",
      sessionId: getSessionId(),
      referrerHost: (() => {
        try {
          return document.referrer ? new URL(document.referrer).hostname : "";
        } catch {
          return "";
        }
      })()
    };
    if (!payload.campaignId || !payload.placement) return;

    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}/v1/ads/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) continue;
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        return;
      } catch {
        // try next base
      }
    }
  }

  function campaignIdFromPlacement(placement) {
    return `network-${String(placement || "").trim().toLowerCase()}`;
  }

  function observeAndTrackSlot(slot, campaignId, placement) {
    const key = `${campaignId}|${placement}|${window.location.pathname || "/"}`;
    if (trackedImpressionKeys.has(key)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries?.length) return;
        const top = entries[0];
        if (!top.isIntersecting || top.intersectionRatio < 0.45) return;
        trackedImpressionKeys.add(key);
        observer.disconnect();
        void postAdEvent("impression", campaignId, placement);
      },
      { threshold: [0.45] }
    );
    observer.observe(slot);
  }

  function isTestMode() {
    try {
      const qp = new URLSearchParams(window.location.search);
      if (qp.get("ads_test") === "1") return true;
      if (localStorage.getItem("fishbattery.ads.test") === "1") return true;
    } catch {
      // ignore
    }
    return false;
  }

  // Validate and normalize raw feed entry into a predictable shape.
  function normalizeAd(ad) {
    const idRaw = String(ad?.id || "").trim().toLowerCase();
    const id = /^[a-z0-9][a-z0-9_-]{1,63}$/.test(idRaw) ? idRaw : "your-ad-here";
    const title = String(ad?.title || "").trim();
    const body = String(ad?.body || "").trim();
    const cta = String(ad?.cta || "Learn more").trim();
    const link = String(ad?.link || "").trim();
    const media = String(ad?.media || "Sponsored").trim();
    const placements = Array.isArray(ad?.placements) ? ad.placements.map((x) => String(x || "").trim()) : [];
    const active = ad?.active !== false;

    if (!active || !title || !body || !/^https?:\/\//i.test(link)) return null;
    return { id, title, body, cta, link, media, placements };
  }

  // Pick one ad for a given placement, rotating deterministically via localStorage cursor.
  function pickAdForPlacement(ads, placement) {
    const matching = ads.filter((ad) => ad.placements.includes(placement));
    if (!matching.length) return null;

    const key = `fishbattery.ad.index.${placement}`;
    const cursor = Number(localStorage.getItem(key) || 0);
    const idx = Number.isFinite(cursor) ? Math.abs(cursor) % matching.length : 0;
    localStorage.setItem(key, String(idx + 1));

    return matching[idx];
  }

  // Ensure fallback markup exists, then apply ad content.
  function applyAdToSlot(slot, ad) {
    let wrap = slot.querySelector(".sponsored-fallback");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "sponsored-fallback";
      wrap.innerHTML = `
        <div class="sponsored-fallback-inner">
          <div class="sponsored-fallback-meta">
            <span class="sponsored-fallback-label">Sponsored</span>
            <span class="sponsored-fallback-media"></span>
          </div>
  
          <div class="sponsored-fallback-title"></div>
          <div class="sponsored-fallback-body"></div>
  
          <div class="sponsored-fallback-actions">
            <a class="btn sponsored-fallback-cta" href="#" target="_blank" rel="noreferrer">Learn more</a>
          </div>
        </div>
      `;
  
      // Put fallback exactly where ads would render
      const host = slot.querySelector(".sponsored-adsense-wrap") || slot;
      host.appendChild(wrap);
    }
  
    // Fill
    const mediaEl = wrap.querySelector(".sponsored-fallback-media");
    const titleEl = wrap.querySelector(".sponsored-fallback-title");
    const bodyEl = wrap.querySelector(".sponsored-fallback-body");
    const ctaEl = wrap.querySelector(".sponsored-fallback-cta");
    const kickerEl = slot.querySelector(".sponsored-kicker");
  
    if (mediaEl) mediaEl.textContent = ad.media ? `- ${ad.media}` : "";
    if (titleEl) titleEl.textContent = ad.title;
    if (bodyEl) bodyEl.textContent = ad.body;
    if (ctaEl) {
      ctaEl.textContent = ad.cta || "Learn more";
      ctaEl.href = ad.link;
      if (!ctaEl.dataset.adTracked) {
        ctaEl.dataset.adTracked = "1";
        ctaEl.addEventListener("click", () => {
          const placement = String(slot.getAttribute("data-ad-placement") || "").trim().toLowerCase();
          void postAdEvent("click", ad.id || campaignIdFromPlacement(placement), placement);
        });
      }
    }
    if (kickerEl) kickerEl.textContent = ad.media ? `Sponsored - ${ad.media}` : "Sponsored";
  }


  // Render fallback ads into all slots when feed data is available.
  function renderFallback(ads, { hideAdsenseIns = false } = {}) {
    if (!Array.isArray(ads) || !ads.length) return;

    for (const slot of slots) {
      const placement = String(slot.getAttribute("data-ad-placement") || "").trim();
      if (!placement) continue;

      const ad = pickAdForPlacement(ads, placement);
      if (!ad) continue;

      if (hideAdsenseIns) {
        const ins = slot.querySelector("ins.adsbygoogle");
        if (ins) ins.style.display = "none";
      }

      applyAdToSlot(slot, ad);
      observeAndTrackSlot(slot, ad.id || campaignIdFromPlacement(placement), placement);
    }
  }

  // Lazy-load AdSense JS exactly once.
  function loadAdsenseScript() {
    // Already initialized by page or previous run.
    if (window.adsbygoogle) return Promise.resolve();

    // Reuse existing pending load.
    if (adsenseLoadPromise) return adsenseLoadPromise;

    adsenseLoadPromise = new Promise((resolve, reject) => {
      // If script tag already exists, hook into it instead of appending another.
      const existing = document.querySelector(`script[src^="${ADSENSE_SRC}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("adsense_script_load_failed")), { once: true });
        return;
      }

      // Insert AdSense loader script.
      const script = document.createElement("script");
      script.async = true;
      script.src = ADSENSE_SRC;
      script.crossOrigin = "anonymous";
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error("adsense_script_load_failed")), { once: true });
      document.head.appendChild(script);
    });

    return adsenseLoadPromise;
  }

  // Push AdSense render calls for each slot's <ins class="adsbygoogle">.
  async function renderAdsenseSlots() {
    await loadAdsenseScript();

    // Wait a frame so layout is measurable (helps AdSense)
    await new Promise(requestAnimationFrame);

    let pushed = 0;

    for (const slot of slots) {
      const adElement = slot.querySelector("ins.adsbygoogle");
      if (!adElement) continue;

      // Skip already rendered
      if (adElement.getAttribute("data-adsbygoogle-status")) continue;

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed++;
      } catch {
        // ignore; we'll fallback
      }
    }

    return pushed;
  }

  async function loadApiFeedByPlacement(placement) {
    if (!placement) return [];
    for (const base of getApiBases()) {
      try {
        const response = await fetch(
          `${base}/v1/ads/feed?placement=${encodeURIComponent(placement)}&limit=5`,
          { cache: "no-store" }
        );
        if (!response.ok) continue;
        const json = await response.json();
        const adsRaw = Array.isArray(json?.ads) ? json.ads : [];
        const ads = adsRaw.map(normalizeAd).filter(Boolean);
        if (ads.length) {
          localStorage.setItem("fishbattery.apiBaseResolved", base);
          return ads;
        }
      } catch {
        // try next base
      }
    }
    return [];
  }

  // Fetch and normalize fallback feed.
  async function loadFeed() {
    // Prefer live API feed so campaign updates appear immediately.
    const placementSet = Array.from(
      new Set(
        slots
          .map((slot) => String(slot.getAttribute("data-ad-placement") || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const fromApi = [];
    for (const placement of placementSet) {
      const ads = await loadApiFeedByPlacement(placement);
      if (ads.length) fromApi.push(...ads);
    }
    if (fromApi.length) return fromApi;

    // Fall back to static JSON if API feed is unavailable.
    for (const url of FEED_URLS) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        const json = await response.json();
        const adsRaw = Array.isArray(json?.ads) ? json.ads : [];
        const ads = adsRaw.map(normalizeAd).filter(Boolean);
        if (ads.length) return ads;
      } catch {
        // try next source
      }
    }
    return [];
  }

  // Single render entry for consent state transitions.
  async function renderForConsentState(consented) {
    // reset per-run state
    fallbackRendered = false;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    if (!consented) {
      // No optional ad consent: hard-hide all sponsored slots.
      for (const slot of slots) slot.classList.add("hidden");
      return;
    }

    // Optional ad consent granted: reveal slots and attempt rendering.
    for (const slot of slots) slot.classList.remove("hidden");

    // TEST MODE: bypass AdSense entirely so you can test UI without authorization
    if (isTestMode()) {
      const ads = await loadFeed();
      renderFallback(ads, { hideAdsenseIns: true });
      fallbackRendered = true;
      return;
    }

    try {
      const count = await renderAdsenseSlots();

      // If nothing got pushed, fallback immediately.
      if (!count) {
        const ads = await loadFeed();
        renderFallback(ads);
        fallbackRendered = true;
        return;
      }

      // AdSense slots are still first-party placements for impression analytics.
      for (const slot of slots) {
        const placement = String(slot.getAttribute("data-ad-placement") || "").trim().toLowerCase();
        if (!placement) continue;
        observeAndTrackSlot(slot, campaignIdFromPlacement(placement), placement);
      }

      // If AdSense pushes but doesn't fill, fallback after a short delay.
      fallbackTimer = setTimeout(async () => {
        if (fallbackRendered) return;

        const anyFilled = slots.some((slot) => {
          const ins = slot.querySelector("ins.adsbygoogle");
          if (!ins) return false;

          // Explicit unfilled signal from AdSense should always trigger fallback.
          const adStatus = (ins.getAttribute("data-ad-status") || "").toLowerCase();
          if (adStatus === "unfilled") return false;

          const status = ins.getAttribute("data-adsbygoogle-status") || "";
          // Treat only "done" as filled; others can be "unfilled"
          if (status) return status === "done";

          // Heuristic: if it gained height, it's probably filled
          return ins.offsetHeight >= 50;
        });

        if (!anyFilled) {
          const ads = await loadFeed();
          renderFallback(ads);
          fallbackRendered = true;
        }
      }, 1500);
    } catch {
      // If AdSense cannot load, use internal fallback ad feed.
      const ads = await loadFeed();
      renderFallback(ads);
      fallbackRendered = true;
    }
  }

  // Initial render using current consent snapshot.
  const consentApi = window.fishbatteryConsent;
  if (consentApi && typeof consentApi.hasAdConsent === "function") {
    void renderForConsentState(consentApi.hasAdConsent());
  }

  // Live updates whenever user accepts/rejects through the consent banner.
  window.addEventListener("fishbattery:consent-changed", (event) => {
    const consented = !!event?.detail?.advertising;
    void renderForConsentState(consented);
  });
})();
