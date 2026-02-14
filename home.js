(async function initHomeDownloadButton() {
  const primaryCta = document.getElementById("heroPrimaryCta");
  if (!primaryCta) return;

  try {
    const response = await fetch(
      "https://api.github.com/repos/fishbatteryapp/FishbatteryLauncher/releases/latest",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!response.ok) return;
    const release = await response.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const windowsAsset = assets.find(
      (asset) =>
        typeof asset?.name === "string" &&
        asset.name.toLowerCase().endsWith(".exe") &&
        typeof asset?.browser_download_url === "string"
    );
    if (!windowsAsset) return;

    primaryCta.href = windowsAsset.browser_download_url;
    primaryCta.setAttribute("target", "_blank");
    primaryCta.setAttribute("rel", "noreferrer");
  } catch {
    // Keep fallback href to /download.html
  }
})();

(function initPreviewLightbox() {
  const previewImages = Array.from(document.querySelectorAll(".preview-clickable"));
  if (!previewImages.length) return;

  const existing = document.getElementById("downloadLightbox");
  if (!existing) {
    const shell = document.createElement("div");
    shell.id = "downloadLightbox";
    shell.className = "download-lightbox hidden";
    shell.setAttribute("aria-hidden", "true");
    shell.innerHTML = `
      <div class="download-lightbox-backdrop"></div>
      <div class="download-lightbox-stage">
        <img id="downloadLightboxImage" alt="" />
        <button id="downloadLightboxClose" class="download-lightbox-close" type="button" aria-label="Close image preview">&times;</button>
      </div>
    `;
    document.body.appendChild(shell);
  }

  const lightbox = document.getElementById("downloadLightbox");
  const lightboxImg = document.getElementById("downloadLightboxImage");
  const lightboxClose = document.getElementById("downloadLightboxClose");
  if (!lightbox || !lightboxImg || !lightboxClose) return;
  let activeSourceImg = null;
  let animating = false;

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

  async function open(sourceImg) {
    if (animating) return;
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

  async function close() {
    if (!activeSourceImg || animating) return;
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

  for (const img of previewImages) {
    img.addEventListener("click", () => {
      void open(img);
    });
  }

  lightbox.addEventListener("click", (ev) => {
    const target = ev.target;
    if (target && target.classList?.contains("download-lightbox-backdrop")) {
      void close();
    }
  });

  lightboxClose.addEventListener("click", () => {
    void close();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !lightbox.classList.contains("hidden")) {
      void close();
    }
  });
})();
