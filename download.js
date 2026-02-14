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
  const notesModal = document.getElementById("releaseNotesModal");
  const notesPanel = notesModal?.querySelector(".release-notes-panel");
  const notesClose = document.getElementById("releaseNotesClose");
  const notesBody = document.getElementById("releaseNotesBody");
  const notesMeta = document.getElementById("releaseNotesMeta");
  const shotImages = Array.from(document.querySelectorAll(".download-shot-image"));
  let activeSourceImg = null;
  let animating = false;
  let notesAnimating = false;
  let releaseLoaded = false;

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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInline(text) {
    const chunks = [];
    const src = String(text || "");
    const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0;
    let match;
    while ((match = re.exec(src))) {
      chunks.push(escapeHtml(src.slice(last, match.index)));
      chunks.push(
        `<a href="${escapeHtml(match[2])}" target="_blank" rel="noreferrer">${escapeHtml(match[1])}</a>`
      );
      last = match.index + match[0].length;
    }
    chunks.push(escapeHtml(src.slice(last)));
    return chunks.join("").replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function renderReleaseBody(markdown) {
    const source = String(markdown || "").trim();
    if (!source) {
      return '<p class="hint">No release notes were provided for this version.</p>';
    }

    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let listType = null;

    function closeList() {
      if (!listType) return;
      out.push(listType === "ol" ? "</ol>" : "</ul>");
      listType = null;
    }

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        closeList();
        i += 1;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        closeList();
        const level = Math.min(heading[1].length, 3);
        out.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
        i += 1;
        continue;
      }

      const ulItem = line.match(/^[-*]\s+(.*)$/);
      if (ulItem) {
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          out.push("<ul>");
        }
        out.push(`<li>${formatInline(ulItem[1])}</li>`);
        i += 1;
        continue;
      }

      const olItem = line.match(/^\d+\.\s+(.*)$/);
      if (olItem) {
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          out.push("<ol>");
        }
        out.push(`<li>${formatInline(olItem[1])}</li>`);
        i += 1;
        continue;
      }

      closeList();
      const para = [];
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) break;
        if (/^(#{1,6})\s+/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next)) break;
        para.push(next);
        i += 1;
      }
      out.push(`<p>${formatInline(para.join(" "))}</p>`);
    }

    closeList();
    return out.join("");
  }

  function formatPublishedDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
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
      ? `Latest stable: ${tag} - ${availableTargets.join(" / ")}`
      : `Latest stable: ${tag} (no downloadable assets found)`;

    wireButton(windowsBtn, windowsAsset, windowsAsset ? `Download ${windowsAsset.name}` : "");
    wireButton(windowsBtnSecondary, windowsAsset, "Download latest");
    wireButton(macBtn, macAsset, "Download latest");
    wireButton(linuxBtn, linuxAsset, "Download latest");

    const notesUrl = String(release.html_url || "").trim();
    if (notesUrl) {
      notesBtn.href = notesUrl;
      notesBtn.setAttribute("target", "_blank");
    } else {
      notesBtn.classList.add("btn-disabled");
      notesBtn.removeAttribute("href");
    }

    if (notesBody) {
      notesBody.innerHTML = renderReleaseBody(release.body);
    }
    if (notesMeta) {
      const published = formatPublishedDate(release.published_at);
      notesMeta.textContent = published
        ? `${tag} - published ${published}`
        : `${tag}`;
    }
    releaseLoaded = true;
  } catch {
    summary.textContent =
      "Could not load release information right now. Please try again shortly.";
    disableButton(windowsBtn, "Unavailable");
    disableButton(windowsBtnSecondary, "Unavailable");
    disableButton(macBtn, "Unavailable");
    disableButton(linuxBtn, "Unavailable");
    notesBtn.href = "https://github.com/fishbatteryapp/FishbatteryLauncher/releases";
    notesBtn.setAttribute("target", "_blank");
    if (notesBody) {
      notesBody.innerHTML =
        '<p class="hint">Could not load release notes right now. You can still read them on GitHub.</p>';
    }
    if (notesMeta) {
      notesMeta.textContent = "GitHub releases";
    }
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

  function makeNotesAnimClone(rect, radius) {
    const clone = document.createElement("div");
    clone.style.position = "fixed";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.borderRadius = `${radius}px`;
    clone.style.border = "1px solid rgba(89, 168, 219, 0.45)";
    clone.style.background = "rgba(9, 23, 37, 0.9)";
    clone.style.boxShadow = "0 18px 42px rgba(0, 0, 0, 0.46)";
    clone.style.zIndex = "1305";
    clone.style.pointerEvents = "none";
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

  async function animateNotesClone(clone, fromRect, toRect, fromRadius, toRadius, duration) {
    const animation = clone.animate(
      [
        {
          left: `${fromRect.left}px`,
          top: `${fromRect.top}px`,
          width: `${fromRect.width}px`,
          height: `${fromRect.height}px`,
          borderRadius: `${fromRadius}px`
        },
        {
          left: `${toRect.left}px`,
          top: `${toRect.top}px`,
          width: `${toRect.width}px`,
          height: `${toRect.height}px`,
          borderRadius: `${toRadius}px`
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

  async function openNotesModal() {
    if (!notesModal || !notesPanel || !notesBtn || notesAnimating) return;
    notesAnimating = true;

    const startRect = notesBtn.getBoundingClientRect();
    const clone = makeNotesAnimClone(startRect, 999);
    document.body.appendChild(clone);

    notesModal.classList.remove("hidden");
    notesModal.setAttribute("aria-hidden", "false");
    const targetRect = notesPanel.getBoundingClientRect();
    requestAnimationFrame(() => notesModal.classList.add("is-open"));

    await animateNotesClone(clone, startRect, targetRect, 999, 16, 320);
    clone.remove();
    notesAnimating = false;
  }

  async function closeNotesModal() {
    if (!notesModal || !notesPanel || !notesBtn || notesAnimating || notesModal.classList.contains("hidden")) {
      return;
    }
    notesAnimating = true;

    const startRect = notesPanel.getBoundingClientRect();
    const endRect = notesBtn.getBoundingClientRect();
    const clone = makeNotesAnimClone(startRect, 16);
    document.body.appendChild(clone);

    notesModal.classList.remove("is-open");
    await animateNotesClone(clone, startRect, endRect, 16, 999, 280);
    clone.remove();
    notesModal.classList.add("hidden");
    notesModal.setAttribute("aria-hidden", "true");
    notesAnimating = false;
  }

  for (const img of shotImages) {
    img.addEventListener("click", () => {
      void openLightbox(img);
    });
  }

  if (notesBtn) {
    notesBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (releaseLoaded || (notesBody && notesBody.innerHTML.trim())) {
        void openNotesModal();
        return;
      }
      const href = notesBtn.getAttribute("href");
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
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

  if (notesModal) {
    notesModal.addEventListener("click", (ev) => {
      const target = ev.target;
      if (target && target.classList?.contains("release-notes-backdrop")) {
        void closeNotesModal();
      }
    });
  }

  if (notesClose) {
    notesClose.addEventListener("click", () => {
      void closeNotesModal();
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (notesModal && !notesModal.classList.contains("hidden")) {
      void closeNotesModal();
      return;
    }
    if (lightbox && !lightbox.classList.contains("hidden")) {
      void closeLightbox();
    }
  });
})();
