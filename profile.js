// Public profile page renderer.
// Input:
// - Preferred: stable profile id from ?u=... (fetched from API).
// - Legacy fallback: compact snapshot payload from ?p=....

const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const API_BASES = isLocalDev
  ? [PUBLIC_API_BASE, "http://localhost:3000"]
  : [PUBLIC_API_BASE];

function getApiBases() {
  const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
  const out = [];
  if (resolved && API_BASES.includes(resolved)) out.push(resolved);
  for (const base of API_BASES) {
    if (!out.includes(base)) out.push(base);
  }
  return out;
}

async function requestPublicProfile(shareId) {
  let lastError = new Error("Profile lookup failed");
  for (const base of getApiBases()) {
    try {
      const res = await fetch(`${base}/v1/profile/public/${encodeURIComponent(String(shareId || "").trim())}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        const text = await res.text();
        throw new Error(text || `Profile API ${res.status}`);
      }
      const payload = await res.json();
      localStorage.setItem("fishbattery.apiBaseResolved", base);
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError;
}

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

function initialsFor(name) {
  const cleaned = String(name || "").trim();
  if (!cleaned) return "FP";
  return cleaned
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTierLabel(tierRaw) {
  const tier = String(tierRaw || "free").trim().toLowerCase();
  if (tier === "founder") return "Founder";
  if (tier === "premium") return "Premium";
  return "Free";
}

function render() {
  const params = new URLSearchParams(window.location.search);
  const shareId = String(params.get("u") || params.get("id") || "").trim();
  const payloadRaw = params.get("p");
  const missing = document.getElementById("profileMissing");
  const root = document.getElementById("profileRoot");

  const renderPayload = (payload) => {
    if (!payload || typeof payload !== "object") {
      if (missing) missing.style.display = "";
      if (root) root.style.display = "none";
      return;
    }
    if (missing) missing.style.display = "none";
    if (root) root.style.display = "grid";

    const name = payload.player?.displayName || "Fishbattery Player";
    const tier = formatTierLabel(payload.player?.tier);
    const generatedAt = payload.generatedAt
      ? new Date(payload.generatedAt).toLocaleString()
      : "Unknown";

    text(document.getElementById("profileName"), name);
    text(document.getElementById("profileMeta"), `Shared on ${generatedAt}`);
    text(document.getElementById("profileTierBadge"), tier);

    const avatarUrl = String(payload.player?.avatarUrl || "").trim();
    const avatar = document.getElementById("profileAvatar");
    const avatarFallback = document.getElementById("profileAvatarFallback");
    if (avatar && avatarFallback) {
      if (avatarUrl) {
        avatar.src = avatarUrl;
        avatar.classList.remove("hidden");
        avatarFallback.classList.add("hidden");
      } else {
        avatar.removeAttribute("src");
        avatar.classList.add("hidden");
        avatarFallback.classList.remove("hidden");
        avatarFallback.textContent = initialsFor(name);
      }
    }

    const stats = [
      ["Playtime", payload.totals?.playtime ?? "0m"],
      ["Installed mods", payload.totals?.installedMods ?? 0],
      ["Instances", payload.totals?.instances ?? 0],
      ["Sessions", payload.totals?.sessions ?? 0],
      ["Active preset", payload.activePreset ?? "None"],
      [
        "Hardware",
        `${payload.hardware?.cpuCores ?? "?"} cores / ${payload.hardware?.ram ?? "?"} RAM / GPU ${payload.hardware?.gpu ?? "Detected"}`
      ]
    ];

    const statsRoot = document.getElementById("profileStats");
    if (statsRoot) {
      statsRoot.innerHTML = "";
      for (const [label, value] of stats) {
        const card = document.createElement("article");
        card.className = "profile-stat-card";

        const h = document.createElement("h3");
        h.className = "profile-stat-label";
        h.textContent = String(label);

        const p = document.createElement("p");
        p.className = "profile-stat-value";
        p.textContent = String(value);

        card.append(h, p);
        statsRoot.appendChild(card);
      }
    }

    const bm = payload.benchmark;
    text(
      document.getElementById("profileBenchmark"),
      bm
        ? `${bm.avgFps} FPS avg / ${bm.low1Fps} 1% low (${bm.profile}) on ${bm.instanceName}`
        : "No benchmark data was shared for this profile."
    );

    const setupsRoot = document.getElementById("profileSetups");
    if (setupsRoot) {
      setupsRoot.innerHTML = "";
      const setups = Array.isArray(payload.setups) ? payload.setups : [];

      if (!setups.length) {
        const empty = document.createElement("p");
        empty.className = "hint";
        empty.textContent = "No setups shared.";
        setupsRoot.appendChild(empty);
      } else {
        for (const setup of setups) {
          const card = document.createElement("article");
          card.className = "profile-setup-card";

          const title = document.createElement("h3");
          title.className = "profile-setup-title";
          title.textContent = `${setup.name || "Instance"} (${setup.version || "unknown"} ${setup.loader || "loader"})`;

          const meta = document.createElement("p");
          meta.className = "profile-setup-meta";
          meta.textContent =
            `${setup.installedMods ?? 0} mods | ${setup.playtime ?? "0m"} | ${setup.preset || "None"}` +
            (setup.benchmarkFps != null ? ` | ${setup.benchmarkFps} FPS` : "");

          card.append(title, meta);
          setupsRoot.appendChild(card);
        }
      }
    }
  };

  if (shareId) {
    requestPublicProfile(shareId)
      .then((response) => {
        const payload = response?.payload;
        renderPayload(payload);
      })
      .catch(() => {
        if (missing) missing.style.display = "";
        if (root) root.style.display = "none";
      });
    return;
  }

  if (!payloadRaw) {
    if (missing) missing.style.display = "";
    if (root) root.style.display = "none";
    return;
  }

  try {
    renderPayload(decodePayload(payloadRaw));
  } catch {
    if (missing) missing.style.display = "";
    if (root) root.style.display = "none";
  }
}

render();
