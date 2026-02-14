(function initSponsoredAds() {
  const slots = Array.from(document.querySelectorAll(".sponsored-slot[data-ad-placement]"));
  if (!slots.length) return;

  const FEED_URLS = ["./assets/ads.json", "https://fishbatteryapp.github.io/fishbattery-web/assets/ads.json"];

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

  function pickAdForPlacement(ads, placement) {
    const matching = ads.filter((ad) => ad.placements.includes(placement));
    if (!matching.length) return null;
    const key = `fishbattery.ad.index.${placement}`;
    const cursor = Number(localStorage.getItem(key) || 0);
    const idx = Number.isFinite(cursor) ? Math.abs(cursor) % matching.length : 0;
    localStorage.setItem(key, String(idx + 1));
    return matching[idx];
  }

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
    if (kickerEl) kickerEl.textContent = `Sponsored • ${ad.media}`;
  }

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

  (async () => {
    const ads = await loadFeed();
    if (!ads.length) return;
    for (const slot of slots) {
      const placement = String(slot.getAttribute("data-ad-placement") || "").trim();
      if (!placement) continue;
      const ad = pickAdForPlacement(ads, placement);
      if (!ad) continue;
      applyAdToSlot(slot, ad);
    }
  })();
})();

