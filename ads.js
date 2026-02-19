(function initSponsoredAds() {
  // Purpose:
  // Render sponsored slots in a consent-aware way.
  //
  // Flow:
  // 1) If no ad slots exist on page, exit.
  // 2) Wait for consent state.
  // 3) If consented: try AdSense script + ins slots.
  // 4) If AdSense fails: render fallback ad feed from JSON.

  // All supported ad placeholders on the current page.
  const slots = Array.from(document.querySelectorAll(".sponsored-slot[data-ad-placement]"));
  if (!slots.length) return;

  // Fallback ad feeds (local first, hosted second).
  const FEED_URLS = ["./assets/ads.json", "https://fishbatteryapp.github.io/fishbattery-web/assets/ads.json"];
  // AdSense bootstrap source.
  const ADSENSE_SRC =
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8826985281954941";
  // Keep one shared in-flight promise to avoid duplicate script insertions.
  let adsenseLoadPromise = null;

  // Validate and normalize raw feed entry into a predictable shape.
  function normalizeAd(ad) {
    const title = String(ad?.title || "").trim();
    const body = String(ad?.body || "").trim();
    const cta = String(ad?.cta || "Learn more").trim();
    const link = String(ad?.link || "").trim();
    const media = String(ad?.media || "Sponsored").trim();
    const placements = Array.isArray(ad?.placements) ? ad.placements.map((x) => String(x || "").trim()) : [];
    const active = ad?.active !== false;
    if (!active || !title || !body || !/^https?:\/\//i.test(link)) return null;
    return { title, body, cta, link, media, placements };
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

  // Apply selected ad copy/URL into a slot's fallback text elements.
  function applyAdToSlot(slot, ad) {
    const titleEl = slot.querySelector(".sponsored-title");
    const bodyEl = slot.querySelector(".sponsored-body");
    const ctaEl = slot.querySelector(".sponsored-cta");
    const kickerEl = slot.querySelector(".sponsored-kicker");
    if (titleEl) titleEl.textContent = ad.title;
    if (bodyEl) bodyEl.textContent = ad.body;
    if (ctaEl) {
      ctaEl.textContent = ad.cta;
      ctaEl.href = ad.link;
      ctaEl.setAttribute("target", "_blank");
      ctaEl.setAttribute("rel", "noreferrer");
    }
    if (kickerEl) kickerEl.textContent = `Sponsored - ${ad.media}`;
  }

  // Render fallback ads into all slots when feed data is available.
  function renderFallback(ads) {
    if (!ads.length) return;
    for (const slot of slots) {
      const placement = String(slot.getAttribute("data-ad-placement") || "").trim();
      if (!placement) continue;
      const ad = pickAdForPlacement(ads, placement);
      if (!ad) continue;
      applyAdToSlot(slot, ad);
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
    for (const slot of slots) {
      const adElement = slot.querySelector("ins.adsbygoogle");
      // Skip missing slot or already rendered slot.
      if (!adElement || adElement.getAttribute("data-adsbygoogle-status")) continue;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Keep going: fallback feed path will handle display if AdSense fails overall.
      }
    }
  }

  // Fetch and normalize the first valid fallback feed.
  async function loadFeed() {
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
    if (!consented) {
      // No optional ad consent: hard-hide all sponsored slots.
      for (const slot of slots) slot.classList.add("hidden");
      return;
    }
    // Optional ad consent granted: reveal slots and attempt rendering.
    for (const slot of slots) slot.classList.remove("hidden");
    try {
      await renderAdsenseSlots();
    } catch {
      // If AdSense cannot load, use internal fallback ad feed.
      const ads = await loadFeed();
      renderFallback(ads);
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
