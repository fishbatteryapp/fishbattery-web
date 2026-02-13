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
