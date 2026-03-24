(function initSponsoredAds() {
  // Purpose:
  // Render sponsored slots from internal API while keeping tracking consent-aware.
  //
  // Flow:
  // 1) If no ad slots exist on page, exit.
  // 2) Render sponsored slots from API.
  // 3) Only send impression/click events when optional ad consent is granted.

  // All supported ad placeholders on the current page.
  const slots = Array.from(document.querySelectorAll(".sponsored-slot[data-ad-placement]"));
  if (!slots.length) return;

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
  const FEED_TIMEOUT_MS = 2200;
  const EVENT_FLUSH_MS = 8000;
  const EVENT_BATCH_MAX = 20;
  let eventQueue = [];
  let flushTimer = null;
  function getConsentApi() {
    return window.fishbatteryConsent;
  }

  function hasTrackingConsent() {
    const consentApi = getConsentApi();
    if (!consentApi || typeof consentApi.hasAdConsent !== "function") return false;
    return !!consentApi.hasAdConsent();
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

  function getSessionId() {
    const key = "fishbattery.ads.sessionId";
    let value = String(localStorage.getItem(key) || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{8,128}$/.test(value)) {
      value = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(key, value);
    }
    return value;
  }

  function buildAdEventPayload(eventType, campaignId, placement) {
    return {
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
  }

  async function flushAdEvents() {
    if (!eventQueue.length) return;
    const batch = eventQueue.splice(0, EVENT_BATCH_MAX);
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}/v1/ads/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch })
        });
        if (!response.ok) continue;
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        return;
      } catch {
        // try next base
      }
    }
    eventQueue = [...batch.slice(-EVENT_BATCH_MAX), ...eventQueue].slice(0, 200);
  }

  function queueAdEvent(eventType, campaignId, placement) {
    const payload = buildAdEventPayload(eventType, campaignId, placement);
    if (!payload.campaignId || !payload.placement) return;
    eventQueue.push(payload);
    if (eventType === "click") {
      void flushAdEvents();
      return;
    }
    if (eventQueue.length >= EVENT_BATCH_MAX) {
      void flushAdEvents();
      return;
    }
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushAdEvents();
      }, EVENT_FLUSH_MS);
    }
  }

  function flushAdEventsOnUnload() {
    if (!eventQueue.length) return;
    const batch = eventQueue.splice(0, EVENT_BATCH_MAX);
    const body = JSON.stringify({ events: batch });
    for (const base of getApiBases()) {
      try {
        const ok = navigator.sendBeacon?.(`${base}/v1/ads/events`, new Blob([body], { type: "application/json" }));
        if (ok) return;
      } catch {
        // try next base
      }
    }
  }

  async function postAdEvent(eventType, campaignId, placement) {
    // Sponsored content can render without optional consent, but tracking is consent-gated.
    if (!hasTrackingConsent()) return;
    queueAdEvent(eventType, campaignId, placement);
  }

  async function fetchJsonWithTimeout(url, timeoutMs = FEED_TIMEOUT_MS, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timer);
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
    const imageUrl = String(ad?.imageUrl || "").trim();
    const placements = Array.isArray(ad?.placements) ? ad.placements.map((x) => String(x || "").trim()) : [];
    const active = ad?.active !== false;
    const hasRenderableContent = !!(title || body || imageUrl);

    if (!active || !hasRenderableContent || !/^https?:\/\//i.test(link)) return null;
    return { id, title, body, cta, link, media, imageUrl, placements };
  }

  // Pick one ad for a given placement.
  function pickAdForPlacement(ads, placement) {
    const matching = ads.filter((ad) => ad.placements.includes(placement));
    if (!matching.length) return null;
    // Feed is already weighted server-side; prefer top returned candidate.
    return matching[0];
  }

  // Ensure fallback markup exists, then apply ad content.
  function applyAdToSlot(slot, ad) {
    let wrap = slot.querySelector(".sponsored-fallback");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "sponsored-fallback";
      wrap.innerHTML = `
        <div class="sponsored-fallback-inner">
          <div class="sponsored-fallback-image" aria-hidden="true"></div>
  
          <div class="sponsored-fallback-title"></div>
          <div class="sponsored-fallback-body"></div>
        </div>
      `;
  
      // Put fallback exactly where ads would render
      const host = slot.querySelector(".sponsored-adsense-wrap") || slot;
      host.appendChild(wrap);
    }
  
    // Fill
    const titleEl = wrap.querySelector(".sponsored-fallback-title");
    const bodyEl = wrap.querySelector(".sponsored-fallback-body");
    const imageEl = wrap.querySelector(".sponsored-fallback-image");
    const kickerEl = slot.querySelector(".sponsored-kicker");

    const cleanTitle = String(ad.title || "")
      .replace(/^\s*sponsored\s*:\s*/i, "")
      .trim();
    if (titleEl) {
      titleEl.textContent = cleanTitle || "";
      titleEl.style.display = cleanTitle ? "" : "none";
    }
    if (bodyEl) {
      const cleanBody = String(ad.body || "").trim();
      bodyEl.textContent = cleanBody;
      bodyEl.style.display = cleanBody ? "" : "none";
    }
    wrap.style.cursor = "pointer";
    wrap.setAttribute("role", "link");
    wrap.setAttribute("tabindex", "0");
    wrap.dataset.adLink = ad.link;
    wrap.dataset.adId = ad.id || campaignIdFromPlacement(String(slot.getAttribute("data-ad-placement") || "").trim().toLowerCase());
    wrap.dataset.adPlacement = String(slot.getAttribute("data-ad-placement") || "").trim().toLowerCase();
    if (!wrap.dataset.adTracked) {
      wrap.dataset.adTracked = "1";
      wrap.addEventListener("click", () => {
        const placement = String(wrap.dataset.adPlacement || "").trim().toLowerCase();
        const campaignId = String(wrap.dataset.adId || campaignIdFromPlacement(placement));
        const target = String(wrap.dataset.adLink || "").trim();
        void postAdEvent("click", campaignId, placement);
        if (target) window.open(target, "_blank", "noopener,noreferrer");
      });
      wrap.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const placement = String(wrap.dataset.adPlacement || "").trim().toLowerCase();
        const campaignId = String(wrap.dataset.adId || campaignIdFromPlacement(placement));
        const target = String(wrap.dataset.adLink || "").trim();
        void postAdEvent("click", campaignId, placement);
        if (target) window.open(target, "_blank", "noopener,noreferrer");
      });
    }
    if (kickerEl) kickerEl.textContent = ad.media ? `Sponsored • ${ad.media}` : "Sponsored";
    if (imageEl) {
      if (/^(https?:\/\/|data:image\/)/i.test(ad.imageUrl || "")) {
        imageEl.style.backgroundImage =
          `linear-gradient(180deg, rgba(4,10,18,0.08), rgba(4,10,18,0.5)), url("${ad.imageUrl}")`;
        wrap.classList.add("has-image");
      } else {
        imageEl.style.backgroundImage = "";
        wrap.classList.remove("has-image");
      }
    }
  }


  // Render fallback ads into all slots when feed data is available.
  function renderFallback(ads, { hideAdsenseIns = false } = {}) {
    if (!Array.isArray(ads) || !ads.length) {
      for (const slot of slots) slot.classList.add("hidden");
      return;
    }

    for (const slot of slots) {
      const placement = String(slot.getAttribute("data-ad-placement") || "").trim();
      if (!placement) continue;

      const ad = pickAdForPlacement(ads, placement);
      if (!ad) continue;
      slot.classList.remove("hidden");

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
        const response = await fetchJsonWithTimeout(
          `${base}/v1/ads/feed?placement=${encodeURIComponent(placement)}&limit=5&sessionId=${encodeURIComponent(getSessionId())}`,
          FEED_TIMEOUT_MS,
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

  // Fetch and normalize API feed.
  async function loadFeed() {
    const placementSet = Array.from(
      new Set(
        slots
          .map((slot) => String(slot.getAttribute("data-ad-placement") || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const apiResults = await Promise.all(placementSet.map((placement) => loadApiFeedByPlacement(placement)));
    const fromApi = apiResults.flat().filter(Boolean);
    if (fromApi.length) return fromApi;
    return [];
  }

  // Single render entry for consent state transitions.
  async function renderForConsentState(_consented) {
    // reset per-run state
    fallbackRendered = false;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    // Sponsored slots are always allowed to render. Consent only controls event tracking.
    for (const slot of slots) slot.classList.remove("hidden");

    // TEST MODE: bypass AdSense entirely so you can test UI without authorization
    if (isTestMode()) {
      const ads = await loadFeed();
      renderFallback(ads, { hideAdsenseIns: true });
      fallbackRendered = true;
      return;
    }

    const ads = await loadFeed();
    renderFallback(ads, { hideAdsenseIns: true });
    fallbackRendered = true;
  }

  // Initial render using current consent snapshot.
  const initialConsentApi = getConsentApi();
  if (initialConsentApi && typeof initialConsentApi.hasAdConsent === "function") {
    void renderForConsentState(initialConsentApi.hasAdConsent());
  } else {
    void renderForConsentState(false);
  }

  // Live updates whenever user accepts/rejects through the consent banner.
  window.addEventListener("fishbattery:consent-changed", (event) => {
    const consented = !!event?.detail?.advertising;
    void renderForConsentState(consented);
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushAdEventsOnUnload();
    }
  });
  window.addEventListener("beforeunload", () => {
    flushAdEventsOnUnload();
  });
})();
