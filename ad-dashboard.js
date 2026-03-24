(function initAdvertiserDashboard() {
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const API_BASES = isLocalDev ? [PUBLIC_API_BASE, "http://localhost:3000"] : [PUBLIC_API_BASE];
  const $ = (id) => document.getElementById(id);
  const token = (localStorage.getItem("fishbattery.token") || "").trim();
  if (!token) { window.location.href = "./login.html"; return; }
  const ui = {
    dashboardAuthHint: $("dashboardAuthHint"),
    programSummary: $("programSummary"),
    programPlacementGrid: $("programPlacementGrid"),
    advertiserStatusSummary: $("advertiserStatusSummary"),
    advertiserStatusDetail: $("advertiserStatusDetail"),
    applicationSection: $("applicationSection"),
    approvedOverview: $("approvedOverview"),
    analyticsControlsSection: $("analyticsControlsSection"),
    analyticsKpisSection: $("analyticsKpisSection"),
    analyticsPlacementSection: $("analyticsPlacementSection"),
    analyticsCampaignsSection: $("analyticsCampaignsSection"),
    campaignBudgetSection: $("campaignBudgetSection"),
    analyticsToolsSection: $("analyticsToolsSection"),
    approvedPlacementList: $("approvedPlacementList"),
    approvedBudget: $("approvedBudget"),
    approvedDailyLimit: $("approvedDailyLimit"),
    applicationCompanyName: $("applicationCompanyName"),
    applicationWebsiteUrl: $("applicationWebsiteUrl"),
    applicationContactName: $("applicationContactName"),
    applicationBillingEmail: $("applicationBillingEmail"),
    applicationIndustry: $("applicationIndustry"),
    applicationPlacementPicker: $("applicationPlacementPicker"),
    applicationProductSummary: $("applicationProductSummary"),
    applicationCampaignGoals: $("applicationCampaignGoals"),
    applicationNotes: $("applicationNotes"),
    submitAdvertiserApplication: $("submitAdvertiserApplication"),
    applicationStatusText: $("applicationStatusText"),
    rangeSelect: $("rangeSelect"),
    placementSelect: $("placementSelect"),
    statusSelect: $("statusSelect"),
    kpiImpressions: $("kpiImpressions"),
    kpiClicks: $("kpiClicks"),
    kpiCtr: $("kpiCtr"),
    kpiRevenue: $("kpiRevenue"),
    kpiEcpm: $("kpiEcpm"),
    kpiConversions: $("kpiConversions"),
    kpiConversionRate: $("kpiConversionRate"),
    kpiAvgCpc: $("kpiAvgCpc"),
    kpiAccountBudget: $("kpiAccountBudget"),
    kpiAccountRemaining: $("kpiAccountRemaining"),
    kpiAccountDailyLimit: $("kpiAccountDailyLimit"),
    placementBars: $("placementBars"),
    campaignRows: $("campaignRows"),
    campaignBudgetRows: $("campaignBudgetRows"),
    notice: $("dashboardNotice"),
    btnExport: $("btnExport"),
    btnRefresh: $("btnRefresh"),
    btnAddBudget: $("btnAddBudget"),
    budgetTopupAmount: $("budgetTopupAmount")
  };
  const state = { advertiser: null, placements: [], currentCampaignRows: [], campaignBudgets: [] };

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES.includes(resolved)) out.push(resolved);
    for (const base of API_BASES) if (!out.includes(base)) out.push(base);
    return out;
  }
  function setNotice(message) { if (ui.notice) ui.notice.textContent = String(message || ""); }
  function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function formatNumber(value) { return Number(value || 0).toLocaleString("en-US"); }
  function formatMoneyEur(value) { return `EUR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  function asFiniteNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function placementLabel(value) { return String(value || "").trim() || "Unknown"; }
  async function parseResponse(response) {
    const text = await response.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch {}
    if (!response.ok) throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    return parsed;
  }
  async function request(path, init = {}) {
    let lastError = new Error("Request failed");
    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
        const parsed = await parseResponse(response);
        localStorage.setItem("fishbattery.apiBaseResolved", base);
        return parsed;
      } catch (error) {
        const msg = String((error && error.message) || error || "").toLowerCase();
        const isNetworkError = msg.includes("failed to fetch") || msg.includes("name_not_resolved") || msg.includes("err_connection_refused") || msg.includes("networkerror");
        if (!isNetworkError) throw (error instanceof Error ? error : new Error(String(error)));
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError;
  }
  function selectedRequestedPlacements() {
    if (!ui.applicationPlacementPicker) return [];
    return Array.from(ui.applicationPlacementPicker.querySelectorAll("[data-application-placement]:checked")).map((input) => String(input.value || ""));
  }
  function showApprovedUi(show) {
    for (const el of [ui.approvedOverview, ui.analyticsControlsSection, ui.analyticsKpisSection, ui.analyticsPlacementSection, ui.analyticsCampaignsSection, ui.campaignBudgetSection, ui.analyticsToolsSection]) {
      el?.classList.toggle("hidden", !show);
    }
    ui.applicationSection?.classList.toggle("hidden", show);
  }
  function renderProgram() {
    if (ui.dashboardAuthHint) ui.dashboardAuthHint.textContent = "Signed in. Your advertiser dashboard is scoped to your own account.";
    if (ui.programSummary) ui.programSummary.textContent = "Fishbattery reviews every advertiser account first, then manually assigns the placements your campaigns are allowed to use.";
    if (ui.programPlacementGrid) {
      ui.programPlacementGrid.innerHTML = state.placements.map((item) => `
        <article class="ads-placement-card">
          <h3>${escapeHtml(placementLabel(item.placement))}</h3>
          <p class="hint">Usage-based placement approved manually by Fishbattery.</p>
          <p class="ads-placement-meta">Placement ID: <code>${escapeHtml(item.placement || "")}</code></p>
        </article>`).join("");
    }
    if (ui.applicationPlacementPicker) {
      ui.applicationPlacementPicker.innerHTML = state.placements.map((item) => `
        <label>
          <input type="checkbox" value="${escapeHtml(item.placement || "")}" data-application-placement />
          <span>${escapeHtml(item.placement || "")}</span>
        </label>`).join("");
    }
  }
  function renderAdvertiserState(payload) {
    state.advertiser = payload?.advertiser || null;
    state.placements = Array.isArray(payload?.program?.placements) ? payload.program.placements : [];
    renderProgram();
    const advertiser = state.advertiser;
    if (!advertiser) {
      if (ui.advertiserStatusSummary) ui.advertiserStatusSummary.textContent = "You have not applied as an advertiser yet.";
      if (ui.advertiserStatusDetail) ui.advertiserStatusDetail.textContent = "Submit the form below to request access and tell us which placements you want.";
      showApprovedUi(false);
      return;
    }
    const status = String(advertiser.status || "pending");
    if (ui.advertiserStatusSummary) ui.advertiserStatusSummary.textContent = `Status: ${status.charAt(0).toUpperCase()}${status.slice(1)}`;
    if (ui.applicationCompanyName) ui.applicationCompanyName.value = String(advertiser.application?.companyName || advertiser.companyName || "");
    if (ui.applicationWebsiteUrl) ui.applicationWebsiteUrl.value = String(advertiser.application?.websiteUrl || advertiser.websiteUrl || "");
    if (ui.applicationContactName) ui.applicationContactName.value = String(advertiser.application?.contactName || advertiser.contactName || "");
    if (ui.applicationBillingEmail) ui.applicationBillingEmail.value = String(advertiser.application?.billingEmail || advertiser.billingEmail || "");
    if (ui.applicationIndustry) ui.applicationIndustry.value = String(advertiser.application?.industry || "");
    if (ui.applicationProductSummary) ui.applicationProductSummary.value = String(advertiser.application?.productSummary || "");
    if (ui.applicationCampaignGoals) ui.applicationCampaignGoals.value = String(advertiser.application?.campaignGoals || "");
    if (ui.applicationNotes) ui.applicationNotes.value = String(advertiser.application?.notes || "");
    const requested = new Set(Array.isArray(advertiser.application?.requestedPlacements) ? advertiser.application.requestedPlacements : []);
    for (const input of ui.applicationPlacementPicker?.querySelectorAll("[data-application-placement]") || []) input.checked = requested.has(String(input.value || ""));
    if (status === "approved") {
      if (ui.advertiserStatusDetail) ui.advertiserStatusDetail.textContent = "Your advertiser account is approved. Analytics below are scoped to your assigned Fishbattery ad slots.";
      if (ui.approvedPlacementList) ui.approvedPlacementList.textContent = advertiser.allowedPlacements?.length ? advertiser.allowedPlacements.join(", ") : "No slots assigned yet";
      if (ui.approvedBudget) ui.approvedBudget.textContent = formatMoneyEur(advertiser.budget?.budgetEur || 0);
      if (ui.approvedDailyLimit) ui.approvedDailyLimit.textContent = formatMoneyEur(advertiser.budget?.dailyLimitEur || 0);
      showApprovedUi(true);
      return;
    }
    if (ui.advertiserStatusDetail) {
      ui.advertiserStatusDetail.textContent = status === "rejected"
        ? "Your advertiser application was not approved at this time. You can update it and resubmit when ready."
        : status === "suspended"
          ? "Your advertiser access is currently suspended. Contact ads@fishbattery.app if you think this is a mistake."
          : "Your advertiser application is under review. Campaign tools unlock after approval and slot assignment.";
    }
    showApprovedUi(false);
  }
  function renderKpis(totals, accountBudget) {
    const impressions = asFiniteNumber(totals?.impressions, 0);
    const clicks = asFiniteNumber(totals?.clicks, 0);
    const conversions = asFiniteNumber(totals?.conversions, 0);
    const revenue = asFiniteNumber(totals?.estimatedRevenueEur ?? totals?.revenueEur ?? totals?.spendEur, 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const ecpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const avgCpc = clicks > 0 ? revenue / clicks : 0;
    if (ui.kpiImpressions) ui.kpiImpressions.textContent = formatNumber(impressions);
    if (ui.kpiClicks) ui.kpiClicks.textContent = formatNumber(clicks);
    if (ui.kpiCtr) ui.kpiCtr.textContent = `${ctr.toFixed(2)}%`;
    if (ui.kpiRevenue) ui.kpiRevenue.textContent = formatMoneyEur(revenue);
    if (ui.kpiEcpm) ui.kpiEcpm.textContent = formatMoneyEur(ecpm);
    if (ui.kpiConversions) ui.kpiConversions.textContent = formatNumber(conversions);
    if (ui.kpiConversionRate) ui.kpiConversionRate.textContent = `${conversionRate.toFixed(2)}%`;
    if (ui.kpiAvgCpc) ui.kpiAvgCpc.textContent = formatMoneyEur(avgCpc);
    if (ui.kpiAccountBudget) ui.kpiAccountBudget.textContent = formatMoneyEur(accountBudget?.budgetEur || 0);
    if (ui.kpiAccountRemaining) ui.kpiAccountRemaining.textContent = formatMoneyEur(accountBudget?.remainingBudgetEur || 0);
    if (ui.kpiAccountDailyLimit) ui.kpiAccountDailyLimit.textContent = `${formatMoneyEur(accountBudget?.dailyLimitEur || 0)}/day`;
  }
  function renderPlacementBars(rows) {
    if (!ui.placementBars) return;
    const list = (Array.isArray(rows) ? rows : []).filter((row) => Number(row?.impressions || 0) > 0 || Number(row?.clicks || 0) > 0);
    if (!list.length) return void (ui.placementBars.innerHTML = `<p class="hint">No active placement traffic in this range yet.</p>`);
    const totalImpressions = Math.max(1, list.reduce((sum, row) => sum + asFiniteNumber(row?.impressions, 0), 0));
    ui.placementBars.innerHTML = list.map((row) => {
      const impressions = asFiniteNumber(row?.impressions, 0);
      const clicks = asFiniteNumber(row?.clicks, 0);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const share = (impressions / totalImpressions) * 100;
      return `<div class="ads-bar-row"><div class="ads-bar-meta"><strong>${escapeHtml(placementLabel(row?.placement))}</strong><span>${share.toFixed(2)}% share (${formatNumber(impressions)} impressions) | ${formatNumber(clicks)} clicks | ${ctr.toFixed(2)}% CTR</span></div><div class="ads-bar-track"><span class="ads-bar-fill" style="width:${Math.max(8, Math.round(share))}%"></span></div></div>`;
    }).join("");
  }
  function aggregateCampaignRows(rows) {
    const grouped = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const campaignId = String(row?.campaignId || row?.id || row?.campaignName || "").trim();
      if (!campaignId) continue;
      if (!grouped.has(campaignId)) {
        grouped.set(campaignId, {
          campaignId,
          campaignName: String(row?.campaignName || row?.name || "Untitled campaign"),
          status: String(row?.status || "review"),
          pricingModel: String(row?.pricingModel || "MIXED").toUpperCase(),
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenueEur: 0,
          slots: []
        });
      }
      const entry = grouped.get(campaignId);
      const impressions = asFiniteNumber(row?.impressions, 0);
      const clicks = asFiniteNumber(row?.clicks, 0);
      const conversions = asFiniteNumber(row?.conversions, 0);
      const revenueEur = asFiniteNumber(row?.estimatedRevenueEur ?? row?.revenueEur ?? row?.spendEur, 0);
      entry.impressions += impressions;
      entry.clicks += clicks;
      entry.conversions += conversions;
      entry.revenueEur += revenueEur;
      entry.slots.push({
        placement: String(row?.placement || ""),
        placementLabel: placementLabel(row?.placement || ""),
        impressions,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        conversions,
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
        revenueEur
      });
    }
    return Array.from(grouped.values()).map((entry) => {
      entry.slots.sort((a, b) => (b.impressions - a.impressions) || (b.clicks - a.clicks) || a.placementLabel.localeCompare(b.placementLabel));
      entry.ctr = entry.impressions > 0 ? (entry.clicks / entry.impressions) * 100 : 0;
      entry.conversionRate = entry.clicks > 0 ? (entry.conversions / entry.clicks) * 100 : 0;
      entry.averageCpcEur = entry.clicks > 0 ? entry.revenueEur / entry.clicks : 0;
      return entry;
    }).sort((a, b) => (b.impressions - a.impressions) || a.campaignName.localeCompare(b.campaignName));
  }
  function renderCampaignRows(rows) {
    state.currentCampaignRows = aggregateCampaignRows(rows);
    if (!ui.campaignRows) return;
    if (!state.currentCampaignRows.length) return void (ui.campaignRows.innerHTML = `<tr><td colspan="10">No campaign metrics match the selected filters.</td></tr>`);
    ui.campaignRows.innerHTML = state.currentCampaignRows.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row?.campaignName || "")}</strong></td>
        <td><span class="status-pill status-${escapeHtml(row?.status || "review")}">${escapeHtml(row?.status || "review")}</span></td>
        <td class="campaign-performance-cell">
          <div class="campaign-slot-breakdown">
            ${Array.isArray(row?.slots) && row.slots.length ? row.slots.map((slot) => `
              <div class="campaign-slot-item">
                <strong>${escapeHtml(slot.placementLabel || "")}</strong>
                <span>${formatNumber(slot.impressions)} imp</span>
                <span>${formatNumber(slot.clicks)} clicks</span>
                <span>${slot.ctr.toFixed(2)}% CTR</span>
              </div>`).join("") : `<span class="hint">No slot data yet.</span>`}
          </div>
        </td>
        <td>${formatNumber(row?.impressions || 0)}</td>
        <td>${formatNumber(row?.clicks || 0)}</td>
        <td>${asFiniteNumber(row?.ctr, 0).toFixed(2)}%</td>
        <td>${formatNumber(row?.conversions || 0)}</td>
        <td>${asFiniteNumber(row?.conversionRate, 0).toFixed(2)}%</td>
        <td>${formatMoneyEur(row?.averageCpcEur ?? row?.avgCpc ?? 0)}</td>
        <td>${formatMoneyEur(row?.estimatedRevenueEur ?? row?.revenueEur ?? row?.spendEur ?? 0)}</td>
      </tr>`).join("");
  }
  function renderCampaignBudgetRows() {
    if (!ui.campaignBudgetRows) return;
    if (!state.campaignBudgets.length) {
      ui.campaignBudgetRows.innerHTML = `<tr><td colspan="7">No advertiser campaigns found yet.</td></tr>`;
      return;
    }
    ui.campaignBudgetRows.innerHTML = state.campaignBudgets.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row?.name || "")}</strong></td>
        <td><span class="status-pill status-${escapeHtml(row?.status || "review")}">${escapeHtml(row?.status || "review")}</span></td>
        <td>${escapeHtml((Array.isArray(row?.placements) ? row.placements : []).map((item) => item?.placement || "").filter(Boolean).join(", ") || "-")}</td>
        <td>${formatMoneyEur(row?.spentEur || 0)}</td>
        <td><input type="number" min="0" step="0.01" value="${escapeHtml(String(Number(row?.budgetAllocationEur || 0)))}" data-campaign-budget-input="${escapeHtml(row?.campaignId || "")}" /></td>
        <td>${row?.remainingAllocationEur === null ? "-" : formatMoneyEur(row?.remainingAllocationEur || 0)}</td>
        <td><button class="btn btn-primary" type="button" data-save-campaign-budget="${escapeHtml(row?.campaignId || "")}">Save</button></td>
      </tr>`).join("");
    for (const button of ui.campaignBudgetRows.querySelectorAll("[data-save-campaign-budget]")) {
      button.addEventListener("click", async () => {
        const campaignId = String(button.getAttribute("data-save-campaign-budget") || "");
        const input = ui.campaignBudgetRows.querySelector(`[data-campaign-budget-input="${campaignId}"]`);
        if (!input) return;
        try {
          setNotice("Saving campaign allocation...");
          await request(`/v1/ads/campaigns/${encodeURIComponent(campaignId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.name || "",
              status: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.status || "review",
              media: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.media || "Banner",
              title: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.title || "Campaign",
              body: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.body || "Campaign body",
              cta: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.cta || "Learn more",
              landingUrl: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.landingUrl || "https://fishbattery.app",
              imageUrl: state.campaignBudgets.find((item) => item.campaignId === campaignId)?.imageUrl || "",
              budgetAllocationEur: Number(input.value || 0)
            })
          });
          await loadCampaignBudgets();
          setNotice("Campaign allocation updated.");
        } catch (error) { setNotice(`Could not save campaign allocation: ${String(error?.message || error)}`); }
      });
    }
  }
  async function loadCampaignBudgets() {
    const data = await request("/v1/ads/campaigns/mine");
    state.campaignBudgets = Array.isArray(data?.campaigns) ? data.campaigns : [];
    renderCampaignBudgetRows();
  }
  async function refreshSummary() {
    const data = await request(`/v1/ads/dashboard/summary?${new URLSearchParams({ range: ui.rangeSelect?.value || "30d", placement: ui.placementSelect?.value || "all", status: ui.statusSelect?.value || "all" }).toString()}`);
    renderKpis(data?.totals || {}, data?.accountBudget || {});
    renderPlacementBars(data?.byPlacement || []);
    renderCampaignRows(data?.campaigns || []);
    await loadCampaignBudgets();
    setNotice("Analytics refreshed.");
  }
  async function addBudget(amountEur) {
    const amount = asFiniteNumber(amountEur, 0);
    if (amount <= 0) return void setNotice("Enter a valid budget amount.");
    setNotice(`Opening secure checkout for ${formatMoneyEur(amount)}...`);
    const successUrl = `${window.location.origin}${window.location.pathname}?topup=success`;
    const cancelUrl = `${window.location.origin}${window.location.pathname}?topup=cancel`;
    const data = await request("/v1/ads/account-budget/topup-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountEur: Math.round(amount * 100) / 100, successUrl, cancelUrl }) });
    const url = String(data?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("Checkout URL missing from server response");
    window.location.href = url;
  }
  function downloadCsv() {
    const rows = [["Campaign", "Status", "Slot performance", "Impressions", "Clicks", "CTR", "Conversions", "ConvRate", "Revenue EUR"]];
    for (const row of state.currentCampaignRows) rows.push([
      row?.campaignName || "",
      row?.status || "",
      (Array.isArray(row?.slots) ? row.slots : []).map((slot) => `${slot.placementLabel}: ${formatNumber(slot.impressions)} imp, ${formatNumber(slot.clicks)} clicks, ${slot.ctr.toFixed(2)}% CTR`).join(" | "),
      String(row?.impressions || 0),
      String(row?.clicks || 0),
      String(asFiniteNumber(row?.ctr, 0).toFixed(2)),
      String(row?.conversions || 0),
      String(asFiniteNumber(row?.conversionRate, 0).toFixed(2)),
      String(asFiniteNumber(row?.estimatedRevenueEur ?? row?.revenueEur ?? row?.spendEur, 0).toFixed(2))
    ]);
    const csv = `\uFEFF${rows.map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `fishbattery-advertiser-report-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  ui.submitAdvertiserApplication?.addEventListener("click", async () => {
    try {
      ui.applicationStatusText.textContent = "Submitting advertiser application...";
      const data = await request("/v1/advertiser/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application: {
            companyName: String(ui.applicationCompanyName?.value || "").trim(),
            websiteUrl: String(ui.applicationWebsiteUrl?.value || "").trim(),
            contactName: String(ui.applicationContactName?.value || "").trim(),
            billingEmail: String(ui.applicationBillingEmail?.value || "").trim(),
            industry: String(ui.applicationIndustry?.value || "").trim(),
            requestedPlacements: selectedRequestedPlacements(),
            productSummary: String(ui.applicationProductSummary?.value || "").trim(),
            campaignGoals: String(ui.applicationCampaignGoals?.value || "").trim(),
            notes: String(ui.applicationNotes?.value || "").trim()
          }
        })
      });
      ui.applicationStatusText.textContent = String(data?.message || "Advertiser application submitted.");
      renderAdvertiserState(data);
    } catch (error) {
      ui.applicationStatusText.textContent = `Could not submit application: ${String(error?.message || error)}`;
    }
  });
  ui.rangeSelect?.addEventListener("change", () => { if (state.advertiser?.status === "approved") void refreshSummary(); });
  ui.placementSelect?.addEventListener("change", () => { if (state.advertiser?.status === "approved") void refreshSummary(); });
  ui.statusSelect?.addEventListener("change", () => { if (state.advertiser?.status === "approved") void refreshSummary(); });
  ui.btnRefresh?.addEventListener("click", () => { if (state.advertiser?.status === "approved") void refreshSummary(); });
  ui.btnExport?.addEventListener("click", () => {
    if (!state.currentCampaignRows.length) return void setNotice("No analytics loaded yet.");
    downloadCsv(); setNotice("CSV report exported.");
  });
  ui.btnAddBudget?.addEventListener("click", async () => {
    try { await addBudget(ui.budgetTopupAmount?.value || 0); } catch (error) { setNotice(`Could not open checkout: ${String(error?.message || error)}`); }
  });

  request("/v1/advertiser/me").then(async (data) => {
    renderAdvertiserState(data);
    if (state.advertiser?.status === "approved") {
      try { await refreshSummary(); } catch (error) { setNotice(`Could not load analytics: ${String(error?.message || error)}`); }
    }
  }).catch((error) => {
    if (ui.advertiserStatusSummary) ui.advertiserStatusSummary.textContent = "Could not load your advertiser dashboard right now.";
    if (ui.advertiserStatusDetail) ui.advertiserStatusDetail.textContent = String(error?.message || error || "Please refresh and try again.");
  });
})();
