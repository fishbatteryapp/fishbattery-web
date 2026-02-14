(async function initDownloadPage() {
  const summary = document.getElementById("downloadSummary");
  const windowsBtn = document.getElementById("windowsDownload");
  const windowsBtnSecondary = document.getElementById("windowsDownloadSecondary");
  const macBtn = document.getElementById("macDownload");
  const linuxBtn = document.getElementById("linuxDownload");
  const notesBtn = document.getElementById("releaseNotes");

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
})();
