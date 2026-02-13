(async function initDownloadPage() {
  const summary = document.getElementById("downloadSummary");
  const windowsBtn = document.getElementById("windowsDownload");
  const notesBtn = document.getElementById("releaseNotes");

  function setUnavailable(message) {
    summary.textContent = message;
    windowsBtn.classList.add("btn-disabled");
    windowsBtn.removeAttribute("href");
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
    const windowsAsset =
      assets.find((a) => typeof a.name === "string" && a.name.toLowerCase().endsWith(".exe")) ||
      null;

    const tag = String(release.tag_name || "latest");
    summary.textContent = windowsAsset
      ? `Latest stable: ${tag}`
      : `Latest stable: ${tag} (Windows download not found)`;

    if (windowsAsset?.browser_download_url) {
      windowsBtn.href = windowsAsset.browser_download_url;
      windowsBtn.textContent = `Download ${windowsAsset.name}`;
    } else {
      setUnavailable("Could not find a Windows installer in the latest stable release.");
    }

    const notesUrl = String(release.html_url || "").trim();
    if (notesUrl) {
      notesBtn.href = notesUrl;
    } else {
      notesBtn.classList.add("btn-disabled");
      notesBtn.removeAttribute("href");
    }
  } catch {
    setUnavailable(
      "Could not load release information right now. Please try again shortly."
    );
    notesBtn.href = "https://github.com/fishbatteryapp/FishbatteryLauncher/releases";
  }
})();
