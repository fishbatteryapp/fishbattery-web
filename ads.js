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

let fallbackTimer = null;
let fallbackRendered = false;

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

async function renderForConsentState(consented) {
  // reset per-run state
  fallbackRendered = false;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  if (!consented) {
    for (const slot of slots) slot.classList.add("hidden");
    return;
  }

  for (const slot of slots) slot.classList.remove("hidden");

  // ✅ TEST MODE: bypass AdSense entirely so you can test UI without authorization
  if (isTestMode()) {
    const ads = await loadFeed();
    renderFallback(ads);
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

    // If AdSense pushes but doesn't fill, fallback after a short delay.
    fallbackTimer = setTimeout(async () => {
      if (fallbackRendered) return;

      const anyFilled = slots.some((slot) => {
        const ins = slot.querySelector("ins.adsbygoogle");
        if (!ins) return false;

        const status = ins.getAttribute("data-adsbygoogle-status") || "";
        // Common statuses: "done", "unfilled", etc.
        if (status) return status === "done"; // only treat "done" as filled

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
    const ads = await loadFeed();
    renderFallback(ads);
    fallbackRendered = true;
  }
}
