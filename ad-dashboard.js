(function initAdDashboard() {
  const rangeSelect = document.getElementById("rangeSelect");
  const placementSelect = document.getElementById("placementSelect");
  const statusSelect = document.getElementById("statusSelect");
  const dashboardKeyInput = document.getElementById("dashboardKey");
  const authHint = document.getElementById("dashboardAuthHint");

  const kpiImpressions = document.getElementById("kpiImpressions");
  const kpiClicks = document.getElementById("kpiClicks");
  const kpiCtr = document.getElementById("kpiCtr");
  const kpiSpend = document.getElementById("kpiSpend");
  const placementBars = document.getElementById("placementBars");
  const campaignRows = document.getElementById("campaignRows");
  const ownedCampaignRows = document.getElementById("ownedCampaignRows");
  const notice = document.getElementById("dashboardNotice");

  const btnExport = document.getElementById("btnExport");
  const btnPause = document.getElementById("btnPause");
  const btnActivate = document.getElementById("btnActivate");
  const btnRefresh = document.getElementById("btnRefresh");

  const btnCreateCampaign = document.getElementById("btnCreateCampaign");
  const btnUpdateCampaign = document.getElementById("btnUpdateCampaign");
  const btnReloadMine = document.getElementById("btnReloadMine");
  const btnClearForm = document.getElementById("btnClearForm");

  const campaignIdInput = document.getElementById("campaignIdInput");
  const campaignNameInput = document.getElementById("campaignNameInput");
  const campaignStatusInput = document.getElementById("campaignStatusInput");
  const campaignLandingInput = document.getElementById("campaignLandingInput");
  const campaignMediaInput = document.getElementById("campaignMediaInput");
  const campaignTitleInput = document.getElementById("campaignTitleInput");
  const campaignBodyInput = document.getElementById("campaignBodyInput");
  const campaignCtaInput = document.getElementById("campaignCtaInput");

  if (!rangeSelect || !placementSelect || !statusSelect || !campaignRows) return;

  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev ? [PUBLIC_API_BASE, "http://localhost:3000"] : [PUBLIC_API_BASE];

  let currentCampaignMetrics = [];
  let currentOwnedCampaigns = [];
  let currentCampaignRows = [];

  const placementLabelMap = {
    "website-home-main": "Website home",
    "website-download-main": "Website download",
    "launcher-sidebar": "Launcher sidebar"
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function formatMoneyEur(value) {
    return `EUR ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  function formatDateMs(value) {
    const ms = Number(value || 0);
    if (!ms) return "n/a";
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return "n/a";
    }
  }

  function placementLabel(value) {
    const key = String(value || "").trim().toLowerCase();
    return placementLabelMap[key] || key || "Unknown";
  }

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES_DEFAULT.includes(resolved)) out.push(resolved);
    for (const base of API_BASES_DEFAULT) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  function getDashboardKey() {
    return String(dashboardKeyInput?.value || "").trim();
  }

  function getAuthToken() {
    return String(localStorage.getItem("fishbattery.token") || "").trim();
  }

  function saveDashboardKey() {
    if (!dashboardKeyInput) return;
    const key = getDashboardKey();
    if (key) {
      localStorage.setItem("fishbattery.ads.dashboardKey", key);
    } else {
      localStorage.removeItem("fishbattery.ads.dashboardKey");
    }
  }

  function loadDashboardKey() {
    if (!dashboardKeyInput) return;
    dashboardKeyInput.value = String(localStorage.getItem("fishbattery.ads.dashboardKey") || "");
  }

  function setNotice(message) {
    if (notice) notice.textContent = message;
  }

  function updateAuthHint() {
    if (!authHint) return;
    const hasToken = !!getAuthToken();
    const hasKey = !!getDashboardKey();
    if (hasToken && hasKey) {
      authHint.textContent = "Signed in and admin key set. You can manage your campaigns and view all-scope data.";
      return;
    }
    if (hasToken) {
      authHint.textContent = "Signed in. Dashboard is scoped to campaigns owned by your account.";
      return;
    }
    if (hasKey) {
      authHint.textContent = "Admin key set without account token. Analytics can load, but campaign ownership actions need login.";
      return;
    }
    authHint.textContent = "Sign in to manage your own campaigns. Dashboard key can optionally unlock admin-all view.";
  }

  function hasAdminKey() {
    return !!getDashboardKey();
  }

  function syncAdminOnlyControls() {
    const admin = hasAdminKey();
    if (campaignStatusInput) campaignStatusInput.disabled = !admin;
    if (btnPause) btnPause.disabled = !admin;
    if (btnActivate) btnActivate.disabled = !admin;
  }

  async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getAuthToken();
    const key = getDashboardKey();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (key) headers["x-ads-dashboard-key"] = key;

    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}${path}`, { ...options, headers });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (response.status < 500) {
            throw new Error(String(body?.message || `Request failed (${response.status})`));
          }
          continue;
        }
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        return response;
      } catch (err) {
        if (String(err?.message || "").includes("Request failed")) throw err;
      }
    }
    throw new Error("Could not reach analytics API");
  }

  function renderKpis(totals) {
    if (kpiImpressions) kpiImpressions.textContent = formatNumber(totals?.impressions || 0);
    if (kpiClicks) kpiClicks.textContent = formatNumber(totals?.clicks || 0);
    if (kpiCtr) kpiCtr.textContent = `${Number(totals?.ctr || 0).toFixed(2)}%`;
    if (kpiSpend) kpiSpend.textContent = formatMoneyEur(totals?.bookedPlacementFeesEur || 0);
  }

  function renderPlacementBars(rows) {
    if (!placementBars) return;
    const listRaw = Array.isArray(rows) ? rows : [];
    const list = listRaw.filter((row) => Number(row?.impressions || 0) > 0 || Number(row?.clicks || 0) > 0);
    if (!list.length) {
      placementBars.innerHTML = `<p class="hint">No active placement traffic in this range yet.</p>`;
      return;
    }
    const maxImpressions = Math.max(...list.map((x) => Number(x?.impressions || 0)), 1);
    placementBars.innerHTML = list
      .map((row) => {
        const placement = escapeHtml(placementLabel(row?.placement));
        const impressions = Number(row?.impressions || 0);
        const clicks = Number(row?.clicks || 0);
        const ctr = Number(row?.ctr || 0);
        const width = Math.max(8, Math.round((impressions / maxImpressions) * 100));
        return `
          <div class="ads-bar-row">
            <div class="ads-bar-meta">
              <strong>${placement}</strong>
              <span>${formatNumber(impressions)} impressions | ${formatNumber(clicks)} clicks | ${ctr.toFixed(2)}% CTR</span>
            </div>
            <div class="ads-bar-track">
              <span class="ads-bar-fill" style="width:${width}%"></span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderMetricsTable(rows) {
    currentCampaignMetrics = Array.isArray(rows) ? rows : [];
    const grouped = new Map();

    for (const row of currentCampaignMetrics) {
      const campaignId = String(row?.campaignId || "").trim();
      if (!campaignId) continue;

      const existing = grouped.get(campaignId) || {
        campaignId,
        campaignName: String(row?.campaignName || ""),
        status: String(row?.status || "review"),
        impressions: 0,
        clicks: 0,
        placementFeeEur: 0,
        placements: []
      };

      const placement = String(row?.placement || "").trim();
      if (placement && !existing.placements.includes(placement)) existing.placements.push(placement);
      existing.impressions += Number(row?.impressions || 0);
      existing.clicks += Number(row?.clicks || 0);
      existing.placementFeeEur += Number(row?.placementFeeEur || 0);
      grouped.set(campaignId, existing);
    }

    currentCampaignRows = Array.from(grouped.values())
      .map((row) => ({
        ...row,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0
      }))
      .sort((a, b) => {
        if (b.impressions !== a.impressions) return b.impressions - a.impressions;
        return a.campaignName.localeCompare(b.campaignName);
      });

    if (!currentCampaignRows.length) {
      campaignRows.innerHTML = `<tr><td colspan="8">No campaign metrics match the selected filters.</td></tr>`;
      return;
    }
    campaignRows.innerHTML = currentCampaignRows
      .map((row) => {
        const campaignId = escapeHtml(row?.campaignId || "");
        const campaignName = escapeHtml(row?.campaignName || "");
        const placement = escapeHtml(
          (Array.isArray(row?.placements) ? row.placements : [])
            .map((p) => placementLabel(p))
            .join(", ")
        );
        const status = escapeHtml(row?.status || "review");
        const impressions = Number(row?.impressions || 0);
        const clicks = Number(row?.clicks || 0);
        const ctr = Number(row?.ctr || 0);
        const fee = Number(row?.placementFeeEur || 0);
        return `
          <tr>
            <td><input type="checkbox" class="campaign-select" value="${campaignId}" /></td>
            <td><strong>${campaignName}</strong></td>
            <td>${placement}</td>
            <td><span class="status-pill status-${status}">${status}</span></td>
            <td>${formatNumber(impressions)}</td>
            <td>${formatNumber(clicks)}</td>
            <td>${ctr.toFixed(2)}%</td>
            <td>${formatMoneyEur(fee)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderOwnedCampaigns(rows) {
    if (!ownedCampaignRows) return;
    currentOwnedCampaigns = Array.isArray(rows) ? rows : [];
    if (!currentOwnedCampaigns.length) {
      ownedCampaignRows.innerHTML = `<tr><td colspan="6">No owned campaigns yet.</td></tr>`;
      return;
    }

    ownedCampaignRows.innerHTML = currentOwnedCampaigns
      .map((campaign) => {
        const placements = Array.isArray(campaign?.placements) ? campaign.placements : [];
        const placementsLabel = placements
          .map((p) => `${escapeHtml(p?.placement || "")} (${formatMoneyEur(p?.feeEur || 0)})`)
          .join(", ");
        return `
          <tr>
            <td>${escapeHtml(campaign?.campaignId || "")}</td>
            <td>${escapeHtml(campaign?.name || "")}</td>
            <td><span class="status-pill status-${escapeHtml(campaign?.status || "review")}">${escapeHtml(campaign?.status || "review")}</span></td>
            <td>${placementsLabel || "n/a"}</td>
            <td>${formatDateMs(campaign?.updatedAt)}</td>
            <td><button class="btn btn-edit-owned" type="button" data-campaign-id="${escapeHtml(campaign?.campaignId || "")}">Load into form</button></td>
          </tr>
        `;
      })
      .join("");

    for (const button of document.querySelectorAll(".btn-edit-owned")) {
      button.addEventListener("click", (event) => {
        const campaignId = String(event.currentTarget?.getAttribute("data-campaign-id") || "").trim();
        const campaign = currentOwnedCampaigns.find((c) => String(c?.campaignId || "") === campaignId);
        if (!campaign) return;
        loadCampaignIntoForm(campaign);
        setNotice(`Loaded ${campaignId} into form.`);
      });
    }
  }

  function getSelectedCampaignIds() {
    return Array.from(document.querySelectorAll(".campaign-select:checked"))
      .map((node) => String(node.value || "").trim())
      .filter(Boolean);
  }

  function getSelectedPlacementsFromForm() {
    return Array.from(document.querySelectorAll(".campaign-placement:checked"))
      .map((node) => String(node.value || "").trim())
      .filter(Boolean);
  }

  function clearCampaignForm() {
    if (campaignIdInput) campaignIdInput.value = "";
    if (campaignNameInput) campaignNameInput.value = "";
    if (campaignStatusInput) campaignStatusInput.value = "review";
    if (campaignLandingInput) campaignLandingInput.value = "";
    if (campaignMediaInput) campaignMediaInput.value = "";
    if (campaignTitleInput) campaignTitleInput.value = "";
    if (campaignBodyInput) campaignBodyInput.value = "";
    if (campaignCtaInput) campaignCtaInput.value = "";
    for (const node of document.querySelectorAll(".campaign-placement")) {
      node.checked = false;
    }
  }

  function loadCampaignIntoForm(campaign) {
    if (campaignIdInput) campaignIdInput.value = String(campaign?.campaignId || "");
    if (campaignNameInput) campaignNameInput.value = String(campaign?.name || "");
    if (campaignStatusInput) campaignStatusInput.value = String(campaign?.status || "review");
    if (campaignLandingInput) campaignLandingInput.value = String(campaign?.landingUrl || "");
    if (campaignMediaInput) campaignMediaInput.value = String(campaign?.media || "");
    if (campaignTitleInput) campaignTitleInput.value = String(campaign?.title || "");
    if (campaignBodyInput) campaignBodyInput.value = String(campaign?.body || "");
    if (campaignCtaInput) campaignCtaInput.value = String(campaign?.cta || "");

    const placementSet = new Set(
      Array.isArray(campaign?.placements) ? campaign.placements.map((x) => String(x?.placement || "").trim()) : []
    );
    for (const node of document.querySelectorAll(".campaign-placement")) {
      node.checked = placementSet.has(String(node.value || "").trim());
    }
  }

  function collectFormPayload() {
    const admin = hasAdminKey();
    return {
      campaignId: String(campaignIdInput?.value || "").trim(),
      name: String(campaignNameInput?.value || "").trim(),
      status: admin ? String(campaignStatusInput?.value || "review").trim() : "review",
      landingUrl: String(campaignLandingInput?.value || "").trim(),
      media: String(campaignMediaInput?.value || "").trim(),
      title: String(campaignTitleInput?.value || "").trim(),
      body: String(campaignBodyInput?.value || "").trim(),
      cta: String(campaignCtaInput?.value || "").trim(),
      placements: getSelectedPlacementsFromForm()
    };
  }

  async function refreshSummary() {
    const query = new URLSearchParams({
      range: rangeSelect.value || "30d",
      placement: placementSelect.value || "all",
      status: statusSelect.value || "all"
    });
    const response = await apiFetch(`/v1/ads/dashboard/summary?${query.toString()}`);
    const data = await response.json();
    renderKpis(data?.totals || {});
    renderPlacementBars(data?.byPlacement || []);
    renderMetricsTable(data?.campaigns || []);
  }

  async function refreshOwnedCampaigns() {
    const token = getAuthToken();
    if (!token) {
      renderOwnedCampaigns([]);
      return;
    }
    const response = await apiFetch("/v1/ads/campaigns/mine");
    const data = await response.json();
    renderOwnedCampaigns(data?.campaigns || []);
  }

  function toCsv(rows) {
    const head = ["campaign_id", "campaign_name", "placement", "status", "impressions", "clicks", "ctr_percent", "placement_fee_eur"];
    const lines = [head];
    for (const row of rows) {
      lines.push([
        String(row?.campaignId || ""),
        String(row?.campaignName || ""),
        String((Array.isArray(row?.placements) ? row.placements : []).join("|")),
        String(row?.status || ""),
        String(Number(row?.impressions || 0)),
        String(Number(row?.clicks || 0)),
        Number(row?.ctr || 0).toFixed(2),
        String(Number(row?.placementFeeEur || 0))
      ]);
    }
    return lines
      .map((cols) => cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  function downloadCsv(content) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fishbattery-ads-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function setSelectedCampaignStatus(status) {
    if (!hasAdminKey()) {
      setNotice("Admin dashboard key is required to change campaign status.");
      return;
    }
    const ids = getSelectedCampaignIds();
    if (!ids.length) {
      setNotice("Select one or more campaign rows first.");
      return;
    }
    await apiFetch("/v1/ads/campaigns/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignIds: ids, status })
    });
    setNotice(`Updated ${ids.length} campaign(s) to ${status}.`);
    await refreshAll();
  }

  async function createCampaignFromForm() {
    const token = getAuthToken();
    if (!token) {
      setNotice("Sign in before creating campaigns.");
      return;
    }
    const payload = collectFormPayload();
    await apiFetch("/v1/ads/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setNotice(`Created campaign ${payload.campaignId || "(auto-generated id)"} successfully.`);
    await refreshAll();
  }

  async function updateCampaignFromForm() {
    const token = getAuthToken();
    if (!token) {
      setNotice("Sign in before updating campaigns.");
      return;
    }
    const payload = collectFormPayload();
    if (!payload.campaignId) {
      setNotice("Campaign ID is required for update.");
      return;
    }
    await apiFetch(`/v1/ads/campaigns/${encodeURIComponent(payload.campaignId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setNotice(`Updated campaign ${payload.campaignId}.`);
    await refreshAll();
  }

  async function refreshAll() {
    try {
      saveDashboardKey();
      updateAuthHint();
      setNotice("Loading dashboard...");
      await Promise.all([refreshSummary(), refreshOwnedCampaigns()]);
      setNotice("Dashboard loaded.");
    } catch (err) {
      renderKpis({ impressions: 0, clicks: 0, ctr: 0, bookedPlacementFeesEur: 0 });
      renderPlacementBars([]);
      renderMetricsTable([]);
      renderOwnedCampaigns([]);
      setNotice(`Unable to load dashboard: ${String(err?.message || err)}`);
    }
  }

  if (btnRefresh) btnRefresh.addEventListener("click", () => void refreshAll());
  if (btnPause) btnPause.addEventListener("click", () => void setSelectedCampaignStatus("paused"));
  if (btnActivate) btnActivate.addEventListener("click", () => void setSelectedCampaignStatus("active"));
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const csv = toCsv(currentCampaignRows);
      downloadCsv(csv);
      setNotice("CSV export downloaded.");
    });
  }
  if (btnCreateCampaign) btnCreateCampaign.addEventListener("click", () => void createCampaignFromForm());
  if (btnUpdateCampaign) btnUpdateCampaign.addEventListener("click", () => void updateCampaignFromForm());
  if (btnReloadMine) btnReloadMine.addEventListener("click", () => void refreshOwnedCampaigns());
  if (btnClearForm) {
    btnClearForm.addEventListener("click", () => {
      clearCampaignForm();
      setNotice("Campaign form cleared.");
    });
  }

  rangeSelect.addEventListener("change", () => void refreshSummary());
  placementSelect.addEventListener("change", () => void refreshSummary());
  statusSelect.addEventListener("change", () => void refreshSummary());
  if (dashboardKeyInput) {
    dashboardKeyInput.addEventListener("change", () => {
      saveDashboardKey();
      updateAuthHint();
      syncAdminOnlyControls();
      void refreshSummary();
    });
  }

  loadDashboardKey();
  updateAuthHint();
  syncAdminOnlyControls();
  void refreshAll();
})();
