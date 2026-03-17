(function initDiscordLinkPage() {
  const summary = document.getElementById("discordLinkSummary");
  const detail = document.getElementById("discordLinkDetail");
  const returnBtn = document.getElementById("discordLinkReturn");

  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];

  let authToken = (localStorage.getItem("fishbattery.token") || "").trim();

  function write(headline, body) {
    if (summary) summary.textContent = String(headline || "");
    if (detail) detail.textContent = String(body || "");
  }

  function showReturn() {
    if (returnBtn) returnBtn.classList.remove("hidden");
  }

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES.includes(resolved)) out.push(resolved);
    for (const base of API_BASES) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  async function parseResponse(response) {
    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // plain text response
    }
    if (!response.ok) {
      const err = new Error(typeof parsed === "string" ? parsed : String(parsed?.message || JSON.stringify(parsed)));
      err.statusCode = Number(response.status || 0);
      throw err;
    }
    return parsed;
  }

  async function request(path, init) {
    let lastError = new Error("Request failed");
    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}${path}`, init);
        const parsed = await parseResponse(response);
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        return parsed;
      } catch (error) {
        const msg = String((error && error.message) || error || "").toLowerCase();
        const isNetworkError =
          msg.includes("failed to fetch") ||
          msg.includes("name_not_resolved") ||
          msg.includes("err_connection_refused") ||
          msg.includes("networkerror");
        if (!isNetworkError) throw (error instanceof Error ? error : new Error(String(error)));
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError;
  }

  function redirectToAccount(params) {
    const query = new URLSearchParams(params);
    window.location.href = `./account.html?${query.toString()}`;
  }

  async function run() {
    if (!authToken) {
      write("You need to sign in first.", "Sign in to your Fishbattery account, then try linking Discord again.");
      showReturn();
      window.setTimeout(() => {
        window.location.href = "./login.html";
      }, 1600);
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const code = String(query.get("code") || "").trim();
    const state = String(query.get("state") || "").trim();
    const oauthError = String(query.get("error") || "").trim();

    if (oauthError) {
      const reason = String(query.get("error_description") || oauthError).trim() || "Discord authorization was cancelled.";
      write("Discord link cancelled.", reason);
      showReturn();
      window.setTimeout(() => redirectToAccount({ discord_error: oauthError, detail: reason }), 1200);
      return;
    }

    if (!code || !state) {
      write("Missing Discord callback data.", "The link could not be completed because the callback was incomplete.");
      showReturn();
      window.setTimeout(() => redirectToAccount({ discord_error: "missing_callback", detail: "Discord did not return the expected code and state." }), 1200);
      return;
    }

    try {
      write("Finishing Discord link...", "Saving your Discord account and syncing your role if needed.");
      const result = await request("/v1/account/discord/link/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ code, state })
      });
      const username = String(result?.username || "").trim();
      const roleSync = String(result?.roleSync || "").trim();
      const roleMessage = String(result?.roleSyncMessage || "").trim();
      write(
        "Discord linked successfully.",
        roleSync === "failed"
          ? roleMessage || "Your Discord account was linked, but role sync failed."
          : username
            ? `Linked as ${username}.`
            : "Your Discord account is now linked."
      );
      showReturn();
      window.setTimeout(
        () =>
          redirectToAccount({
            discord: "linked",
            detail:
              roleSync === "failed"
                ? roleMessage || "Discord linked, but role sync failed."
                : username
                  ? `Discord linked as ${username}.`
                  : "Discord linked successfully."
          }),
        1200
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      write("Could not finish Discord linking.", message || "Please try again.");
      showReturn();
      window.setTimeout(() => redirectToAccount({ discord_error: "link_failed", detail: message || "Could not finish Discord linking." }), 1500);
    }
  }

  run();
})();
