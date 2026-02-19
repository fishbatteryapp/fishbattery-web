function decodePayload(raw) {
  const normalized = String(raw || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padLen = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

function text(el, value) {
  if (!el) return;
  el.textContent = String(value ?? "");
}

function render() {
  const params = new URLSearchParams(window.location.search);
  const payloadRaw = params.get("p");
  const missing = document.getElementById("profileMissing");
  const root = document.getElementById("profileRoot");

  if (!payloadRaw) {
    if (missing) missing.style.display = "";
    if (root) root.style.display = "none";
    return;
  }

  let payload = null;
  try {
    payload = decodePayload(payloadRaw);
  } catch {
    if (missing) missing.style.display = "";
    if (root) root.style.display = "none";
    return;
  }

  if (!payload || typeof payload !== "object") {
    if (missing) missing.style.display = "";
    if (root) root.style.display = "none";
    return;
  }

  if (missing) missing.style.display = "none";
  if (root) root.style.display = "";

  const name = payload.player?.displayName || "Fishbattery Player";
  const tier = payload.player?.tier || "free";
  const generatedAt = payload.generatedAt ? new Date(payload.generatedAt).toLocaleString() : "Unknown";
  text(document.getElementById("profileName"), name);
  text(document.getElementById("profileMeta"), `Tier: ${tier} | Shared: ${generatedAt}`);

  const stats = [
    ["Playtime", payload.totals?.playtime ?? "0m"],
    ["Installed Mods", payload.totals?.installedMods ?? 0],
    ["Instances", payload.totals?.instances ?? 0],
    ["Sessions", payload.totals?.sessions ?? 0],
    ["Active Preset", payload.activePreset ?? "None"],
    [
      "Hardware (Public)",
      `${payload.hardware?.cpuCores ?? "?"} cores / ${payload.hardware?.ram ?? "?"} RAM / GPU ${payload.hardware?.gpu ?? "Unknown"}`
    ]
  ];

  const statsRoot = document.getElementById("profileStats");
  if (statsRoot) {
    statsRoot.innerHTML = "";
    for (const [label, value] of stats) {
      const card = document.createElement("div");
      card.className = "account-card";
      card.style.padding = "12px";
      const h = document.createElement("strong");
      h.textContent = String(label);
      const p = document.createElement("p");
      p.className = "lead";
      p.style.marginTop = "6px";
      p.textContent = String(value);
      card.appendChild(h);
      card.appendChild(p);
      statsRoot.appendChild(card);
    }
  }

  const bm = payload.benchmark;
  text(
    document.getElementById("profileBenchmark"),
    bm
      ? `${bm.avgFps} FPS avg / ${bm.low1Fps} 1% low (${bm.profile}) on ${bm.instanceName}`
      : "No benchmark available."
  );

  const setupsRoot = document.getElementById("profileSetups");
  if (setupsRoot) {
    setupsRoot.innerHTML = "";
    const setups = Array.isArray(payload.setups) ? payload.setups : [];
    if (!setups.length) {
      const p = document.createElement("p");
      p.className = "lead";
      p.textContent = "No setups shared.";
      setupsRoot.appendChild(p);
    } else {
      for (const setup of setups) {
        const row = document.createElement("div");
        row.className = "account-card";
        row.style.padding = "10px 12px";
        const title = document.createElement("strong");
        title.textContent = `${setup.name || "Instance"} (${setup.version || "unknown"} ${setup.loader || "loader"})`;
        const meta = document.createElement("p");
        meta.className = "lead";
        meta.style.marginTop = "4px";
        meta.textContent =
          `${setup.installedMods ?? 0} mods | ${setup.playtime ?? "0m"} | ${setup.preset || "None"}` +
          (setup.benchmarkFps != null ? ` | ${setup.benchmarkFps} FPS` : "");
        row.appendChild(title);
        row.appendChild(meta);
        setupsRoot.appendChild(row);
      }
    }
  }
}

render();
