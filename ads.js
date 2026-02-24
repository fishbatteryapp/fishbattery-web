async function renderAdsenseSlots() {
  await loadAdsenseScript();

  // Wait a frame so layout is measurable (helps AdSense)
  await new Promise(requestAnimationFrame);

  let pushed = 0;

  for (const slot of slots) {
    const adElement = slot.querySelector("ins.adsbygoogle");
    if (!adElement) continue;
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
  if (!consented) {
    for (const slot of slots) slot.classList.add("hidden");
    return;
  }

  for (const slot of slots) slot.classList.remove("hidden");

  try {
    const count = await renderAdsenseSlots();

    // If nothing got pushed, fallback immediately.
    if (!count) {
      const ads = await loadFeed();
      renderFallback(ads);
      return;
    }

    // If AdSense pushes but doesn't fill, we can still fallback after a short delay:
    setTimeout(async () => {
      // If every ins is still empty-ish, fallback.
      const anyFilled = slots.some((slot) => {
        const ins = slot.querySelector("ins.adsbygoogle");
        if (!ins) return false;
        // Google sets this when it decides something; empty slots often remain tiny.
        return ins.getAttribute("data-adsbygoogle-status") === "done" || ins.offsetHeight > 40;
      });

      if (!anyFilled) {
        const ads = await loadFeed();
        renderFallback(ads);
      }
    }, 1500);
  } catch {
    const ads = await loadFeed();
    renderFallback(ads);
  }
}
