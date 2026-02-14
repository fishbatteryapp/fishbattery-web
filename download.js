(async function initDownloadPage() {
  const summary = document.getElementById("downloadSummary");
  const windowsBtn = document.getElementById("windowsDownload");
  const windowsBtnSecondary = document.getElementById("windowsDownloadSecondary");
  const macBtn = document.getElementById("macDownload");
  const linuxBtn = document.getElementById("linuxDownload");
  const notesBtn = document.getElementById("releaseNotes");
  const lightbox = document.getElementById("downloadLightbox");
  const lightboxImg = document.getElementById("downloadLightboxImage");
  const lightboxClose = document.getElementById("downloadLightboxClose");
  const shotImages = Array.from(document.querySelectorAll(".download-shot-image"));
  let activeSourceImg = null;
  let animating = false;

  function disableButton(btn, label) {
    if (!btn) return;
    btn.classList.add("btn-disabled");
    btn.removeAttribute("href");
    if (label) btn.textContent = label;
  }

  function wireButton(btn, asset, fallbackLabel) {
    if (!btn) return;
    if (asset?.browser_download_url) {
      btn.classList.remove("btn-disabled");
      btn.href = asset.browser_download_url;
      btn.textContent = fallbackLabel || `Download ${asset.name}`;
      return;
    }
    disableButton(btn, "Not available");
  }

  try {
    const response = await fetch(
      "https://api.github.com/repos/fishbatteryapp/FishbatteryLauncher/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json"
        }
      }
    );
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const release = await response.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const byExt = (exts) =>
      assets.find(
        (a) =>
          typeof a.name === "string" &&
          exts.some((ext) => a.name.toLowerCase().endsWith(ext))
      ) || null;

    const windowsAsset = byExt([".exe"]);
    const macAsset = byExt([".dmg", ".zip"]);
    const linuxAsset = byExt([".appimage", ".deb", ".rpm", ".tar.gz"]);

    const tag = String(release.tag_name || "latest");
    const availableTargets = [
      windowsAsset ? "Windows" : null,
      macAsset ? "macOS" : null,
      linuxAsset ? "Linux" : null
    ].filter(Boolean);

    summary.textContent = availableTargets.length
      ? `Latest stable: ${tag} • ${availableTargets.join(" / ")}`
      : `Latest stable: ${tag} (no downloadable assets found)`;

    wireButton(windowsBtn, windowsAsset, windowsAsset ? `Download ${windowsAsset.name}` : "");
    wireButton(windowsBtnSecondary, windowsAsset, "Download latest");
    wireButton(macBtn, macAsset, "Download latest");
    wireButton(linuxBtn, linuxAsset, "Download latest");

    const notesUrl = String(release.html_url || "").trim();
    if (notesUrl) {
      notesBtn.href = notesUrl;
    } else {
      notesBtn.classList.add("btn-disabled");
      notesBtn.removeAttribute("href");
    }
  } catch {
    summary.textContent =
      "Could not load release information right now. Please try again shortly.";
    disableButton(windowsBtn, "Unavailable");
    disableButton(windowsBtnSecondary, "Unavailable");
    disableButton(macBtn, "Unavailable");
    disableButton(linuxBtn, "Unavailable");
    notesBtn.href = "https://github.com/fishbatteryapp/FishbatteryLauncher/releases";
  }

  function fitRectFromSource(sourceImg) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxW = Math.min(vw * 0.9, 1400);
    const maxH = vh * 0.88;
    const sourceW = sourceImg.naturalWidth || sourceImg.clientWidth || 1;
    const sourceH = sourceImg.naturalHeight || sourceImg.clientHeight || 1;
    const ratio = sourceW / sourceH;

    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }

    return {
      left: (vw - width) / 2,
      top: (vh - height) / 2,
      width,
      height
    };
  }

  function makeAnimClone(srcImg, rect) {
    const clone = srcImg.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.objectFit = "cover";
    clone.style.borderRadius = "14px";
    clone.style.border = "1px solid rgba(89, 168, 219, 0.35)";
    clone.style.boxShadow = "0 28px 60px rgba(0, 0, 0, 0.6)";
    clone.style.zIndex = "1301";
    clone.style.pointerEvents = "none";
    clone.style.background = "rgba(7, 19, 31, 0.96)";
    return clone;
  }

  async function animateBetweenRects(el, fromRect, toRect, duration) {
    const animation = el.animate(
      [
        {
          left: `${fromRect.left}px`,
          top: `${fromRect.top}px`,
          width: `${fromRect.width}px`,
          height: `${fromRect.height}px`
        },
        {
          left: `${toRect.left}px`,
          top: `${toRect.top}px`,
          width: `${toRect.width}px`,
          height: `${toRect.height}px`
        }
      ],
      {
        duration,
        easing: "cubic-bezier(.2,.7,.2,1)",
        fill: "forwards"
      }
    );
    await animation.finished;
  }

  async function openLightbox(sourceImg) {
    if (!lightbox || !lightboxImg || animating) return;
    animating = true;
    activeSourceImg = sourceImg;
    lightboxImg.src = sourceImg.currentSrc || sourceImg.src;
    lightboxImg.alt = sourceImg.alt || "Preview image";

    const startRect = sourceImg.getBoundingClientRect();
    const endRect = fitRectFromSource(sourceImg);
    const clone = makeAnimClone(sourceImg, startRect);
    document.body.appendChild(clone);

    lightbox.classList.remove("hidden");
    lightbox.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => lightbox.classList.add("is-open"));

    await animateBetweenRects(clone, startRect, endRect, 340);
    clone.remove();
    animating = false;
  }

  async function closeLightbox() {
    if (!lightbox || !lightboxImg || !activeSourceImg || animating) return;
    animating = true;

    const endSourceRect = activeSourceImg.getBoundingClientRect();
    const startRect = fitRectFromSource(activeSourceImg);
    const clone = makeAnimClone(activeSourceImg, startRect);
    clone.src = lightboxImg.currentSrc || lightboxImg.src;
    document.body.appendChild(clone);

    lightbox.classList.remove("is-open");
    await animateBetweenRects(clone, startRect, endSourceRect, 300);
    clone.remove();
    lightbox.classList.add("hidden");
    lightbox.setAttribute("aria-hidden", "true");
    activeSourceImg = null;
    animating = false;
  }

  for (const img of shotImages) {
    img.addEventListener("click", () => {
      void openLightbox(img);
    });
  }

  if (lightbox) {
    lightbox.addEventListener("click", (ev) => {
      const target = ev.target;
      if (target && target.classList?.contains("download-lightbox-backdrop")) {
        void closeLightbox();
      }
    });
  }

  if (lightboxClose) {
    lightboxClose.addEventListener("click", () => {
      void closeLightbox();
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && lightbox && !lightbox.classList.contains("hidden")) {
      void closeLightbox();
    }
  });
})();
