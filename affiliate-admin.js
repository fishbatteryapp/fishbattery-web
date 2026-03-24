(function initAdminDashboard() {
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev ? [PUBLIC_API_BASE, "http://localhost:3000"] : [PUBLIC_API_BASE];
  const $ = (id) => document.getElementById(id);
  const ui = {
    adminKeyInput: $("adminKeyInput"),
    adminActorInput: $("adminActorInput"),
    saveAdminAccessBtn: $("saveAdminAccess"),
    refreshAdminDataBtn: $("refreshAdminData"),
    exportAffiliateCsvBtn: $("exportAffiliateCsv"),
    adminNotice: $("adminNotice"),
    affiliateAdminRows: $("affiliateAdminRows"),
    affiliatePayoutRows: $("affiliatePayoutRows"),
    affiliateConversionRows: $("affiliateConversionRows"),
    advertiserRows: $("advertiserRows"),
    advertiserCampaignBudgetRows: $("advertiserCampaignBudgetRows"),
    manualCreditAffiliateSelect: $("manualCreditAffiliateSelect"),
    manualCreditAmountInput: $("manualCreditAmountInput"),
    manualCreditStatusSelect: $("manualCreditStatusSelect"),
    manualCreditNoteInput: $("manualCreditNoteInput"),
    submitManualCreditBtn: $("submitManualCredit"),
    advertiserAccountSelect: $("advertiserAccountSelect"),
    advertiserStatusSelect: $("advertiserStatusSelect"),
    advertiserBudgetInput: $("advertiserBudgetInput"),
    advertiserDailyLimitInput: $("advertiserDailyLimitInput"),
    adminAdvertiserPlacementPicker: $("adminAdvertiserPlacementPicker"),
    saveAdvertiserConfigBtn: $("saveAdvertiserConfig"),
    advertiserEditorHint: $("advertiserEditorHint"),
    adminCampaignIdInput: $("adminCampaignIdInput"),
    adminCampaignStatusSelect: $("adminCampaignStatusSelect"),
    adminCampaignBudgetAllocationInput: $("adminCampaignBudgetAllocationInput"),
    adminCampaignMediaInput: $("adminCampaignMediaInput"),
    adminCampaignNameInput: $("adminCampaignNameInput"),
    adminCampaignLandingUrlInput: $("adminCampaignLandingUrlInput"),
    adminCampaignTitleInput: $("adminCampaignTitleInput"),
    adminCampaignCtaInput: $("adminCampaignCtaInput"),
    adminCampaignBodyInput: $("adminCampaignBodyInput"),
    adminCampaignImageUrlInput: $("adminCampaignImageUrlInput"),
    createAdvertiserCampaignBtn: $("createAdvertiserCampaign"),
    adminCampaignCreateHint: $("adminCampaignCreateHint"),
    adminKpiAffiliates: $("adminKpiAffiliates"),
    adminKpiAdvertisers: $("adminKpiAdvertisers"),
    adminKpiReady: $("adminKpiReady"),
    adminKpiApproved: $("adminKpiApproved"),
    adminKpiPaid: $("adminKpiPaid"),
    adminKpiAdvertiserCampaigns: $("adminKpiAdvertiserCampaigns")
  };
  const state = { affiliates: [], payouts: [], conversions: [], advertisers: [], placements: [], advertiserCampaigns: [] };

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES_DEFAULT.includes(resolved)) out.push(resolved);
    for (const base of API_BASES_DEFAULT) if (!out.includes(base)) out.push(base);
    return out;
  }
  function getStoredAdminKey() { return String(localStorage.getItem("fishbattery.adminApiKey") || "").trim(); }
  function getStoredAdminActor() { return String(localStorage.getItem("fishbattery.adminActor") || "").trim(); }
  function setNotice(message) { if (ui.adminNotice) ui.adminNotice.textContent = String(message || ""); }
  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function formatUsdFromCents(cents) { return `USD $${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`; }
  function formatMoneyEur(value) {
    return `EUR ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function formatDate(value) {
    const n = Number(value || 0);
    if (!n) return "-";
    try { return new Date(n).toLocaleString(); } catch { return "-"; }
  }
  function payoutMethodLabel(value) {
    const raw = String(value || "").trim();
    if (!raw) return "Not set";
    if (raw === "paypal") return "PayPal";
    if (raw === "stripe_connect") return "Stripe Connect";
    if (raw === "bank_transfer") return "Bank transfer";
    return raw;
  }
  function placementLabels(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return "None assigned";
    return list.map((item) => String(item?.placement || item || "")).filter(Boolean).join(", ");
  }
  async function parseResponse(response) {
    const text = await response.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch {}
    if (!response.ok) throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    return parsed;
  }
  async function request(path, init) {
    let lastError = new Error("Request failed");
    const adminKey = getStoredAdminKey();
    const adminActor = getStoredAdminActor();
    if (!adminKey) throw new Error("Save your admin key first.");
    for (const base of getApiBases()) {
      try {
        const headers = { ...(init?.headers || {}), "x-admin-key": adminKey, ...(adminActor ? { "x-admin-actor": adminActor } : {}) };
        const response = await fetch(`${base}${path}`, { ...init, headers });
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
  function renderKpis() {
    const readyCents = state.affiliates.reduce((sum, item) => sum + Number(item.stats?.readyCents || 0), 0);
    const approvedCents = state.affiliates.reduce((sum, item) => sum + Number(item.stats?.approvedCents || 0), 0);
    const paidCents = state.affiliates.reduce((sum, item) => sum + Number(item.stats?.paidCents || 0), 0);
    const advertiserCampaigns = state.advertisers.reduce((sum, item) => sum + Number(item.stats?.campaignCount || 0), 0);
    if (ui.adminKpiAffiliates) ui.adminKpiAffiliates.textContent = String(state.affiliates.length);
    if (ui.adminKpiAdvertisers) ui.adminKpiAdvertisers.textContent = String(state.advertisers.length);
    if (ui.adminKpiReady) ui.adminKpiReady.textContent = formatUsdFromCents(readyCents);
    if (ui.adminKpiApproved) ui.adminKpiApproved.textContent = formatUsdFromCents(approvedCents);
    if (ui.adminKpiPaid) ui.adminKpiPaid.textContent = formatUsdFromCents(paidCents);
    if (ui.adminKpiAdvertiserCampaigns) ui.adminKpiAdvertiserCampaigns.textContent = String(advertiserCampaigns);
  }
  function renderManualCreditOptions() {
    if (!ui.manualCreditAffiliateSelect) return;
    const previous = String(ui.manualCreditAffiliateSelect.value || "");
    if (!state.affiliates.length) {
      ui.manualCreditAffiliateSelect.innerHTML = `<option value="">Load affiliate data first</option>`;
      return;
    }
    ui.manualCreditAffiliateSelect.innerHTML = [
      `<option value="">Choose an affiliate</option>`,
      ...state.affiliates.map((item) => `<option value="${escapeHtml(item.userId)}">${escapeHtml(`${item.displayName || "Unknown"} (${item.email || item.affiliateCode || ""}) | ${item.affiliateCode || ""} | ${item.status || "pending"}`)}</option>`)
    ].join("");
    if (previous && state.affiliates.some((item) => String(item.userId) === previous)) ui.manualCreditAffiliateSelect.value = previous;
  }
  function renderAdvertiserEditor() {
    if (!ui.advertiserAccountSelect) return;
    const previous = String(ui.advertiserAccountSelect.value || "");
    if (!state.advertisers.length) {
      ui.advertiserAccountSelect.innerHTML = `<option value="">Load advertiser data first</option>`;
      if (ui.adminAdvertiserPlacementPicker) ui.adminAdvertiserPlacementPicker.innerHTML = `<p class="hint">No placement inventory loaded yet.</p>`;
      return;
    }
    ui.advertiserAccountSelect.innerHTML = [
      `<option value="">Choose an advertiser</option>`,
      ...state.advertisers.map((item) => `<option value="${escapeHtml(item.userId)}">${escapeHtml(`${item.companyName || item.displayName || "Unknown"} | ${item.status} | ${item.email || item.billingEmail || ""}`)}</option>`)
    ].join("");
    if (ui.adminAdvertiserPlacementPicker) {
      ui.adminAdvertiserPlacementPicker.innerHTML = state.placements.map((item) => `
        <label>
          <input type="checkbox" value="${escapeHtml(item.placement || "")}" data-advertiser-placement />
          <span>${escapeHtml(item.placement || "")}</span>
        </label>`).join("") || `<p class="hint">No placement inventory found.</p>`;
    }
    if (previous && state.advertisers.some((item) => String(item.userId) === previous)) {
      ui.advertiserAccountSelect.value = previous;
      loadAdvertiserIntoEditor(previous);
    }
  }
  function loadAdvertiserIntoEditor(userId) {
    const advertiser = state.advertisers.find((item) => String(item.userId) === String(userId));
    if (!advertiser) {
      if (ui.advertiserEditorHint) ui.advertiserEditorHint.textContent = "Choose an advertiser to assign access, budgets, and allowed placements.";
      return;
    }
    if (ui.advertiserAccountSelect) ui.advertiserAccountSelect.value = String(advertiser.userId || "");
    if (ui.advertiserStatusSelect) ui.advertiserStatusSelect.value = String(advertiser.status || "pending");
    if (ui.advertiserBudgetInput) ui.advertiserBudgetInput.value = String(Number(advertiser.budget?.budgetEur || 0));
    if (ui.advertiserDailyLimitInput) ui.advertiserDailyLimitInput.value = String(Number(advertiser.budget?.dailyLimitEur || 0));
    const allowed = new Set((Array.isArray(advertiser.allowedPlacements) ? advertiser.allowedPlacements : []).map((item) => String(item?.placement || item || "")));
    if (ui.adminAdvertiserPlacementPicker) {
      for (const input of ui.adminAdvertiserPlacementPicker.querySelectorAll("[data-advertiser-placement]")) input.checked = allowed.has(String(input.value || ""));
    }
    if (ui.advertiserEditorHint) ui.advertiserEditorHint.textContent = `${advertiser.companyName || advertiser.displayName || "Advertiser"} requested ${placementLabels(advertiser.application?.requestedPlacements)}.`;
    if (ui.adminCampaignCreateHint) ui.adminCampaignCreateHint.textContent = `Creating campaigns for ${advertiser.companyName || advertiser.displayName || "this advertiser"}. They will run across all assigned slots: ${placementLabels(advertiser.allowedPlacements)}.`;
    void loadAdvertiserCampaignBudgets(userId);
  }
  function renderAffiliates() {
    if (!ui.affiliateAdminRows) return;
    if (!state.affiliates.length) {
      ui.affiliateAdminRows.innerHTML = `<tr><td colspan="10">No affiliate accounts found.</td></tr>`;
      return;
    }
    ui.affiliateAdminRows.innerHTML = state.affiliates.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.displayName || "Unknown")}</strong><br /><span>${escapeHtml(item.email || "")}</span></td>
        <td>${escapeHtml(item.affiliateCode || "")}</td>
        <td><span class="status-pill status-${escapeHtml(item.status || "pending")}">${escapeHtml(item.status || "pending")}</span></td>
        <td>${escapeHtml(String(item.stats?.clicks || 0))}</td>
        <td>${escapeHtml(String(item.stats?.conversions || 0))}</td>
        <td>${escapeHtml(formatUsdFromCents(item.stats?.readyCents || 0))}</td>
        <td>${escapeHtml(formatUsdFromCents(item.stats?.approvedCents || 0))}</td>
        <td>${escapeHtml(formatUsdFromCents(item.stats?.paidCents || 0))}</td>
        <td>${escapeHtml(payoutMethodLabel(item.payoutMethod))}</td>
        <td>
          <div class="actions">
            <select data-affiliate-status="${escapeHtml(item.userId)}">
              <option value="pending"${item.status === "pending" ? " selected" : ""}>Pending</option>
              <option value="approved"${item.status === "approved" ? " selected" : ""}>Approved</option>
              <option value="rejected"${item.status === "rejected" ? " selected" : ""}>Rejected</option>
              <option value="suspended"${item.status === "suspended" ? " selected" : ""}>Suspended</option>
            </select>
            <button class="btn" type="button" data-save-affiliate-status="${escapeHtml(item.userId)}">Save</button>
            <button class="btn" type="button" data-approve-ready="${escapeHtml(item.userId)}">Approve ready</button>
            <button class="btn btn-primary" type="button" data-record-payout="${escapeHtml(item.userId)}">Record payout</button>
          </div>
        </td>
      </tr>`).join("");
    for (const button of ui.affiliateAdminRows.querySelectorAll("[data-save-affiliate-status]")) {
      button.addEventListener("click", async () => {
        const userId = String(button.getAttribute("data-save-affiliate-status") || "");
        const select = ui.affiliateAdminRows.querySelector(`[data-affiliate-status="${userId}"]`);
        if (!select) return;
        try {
          setNotice("Saving affiliate status...");
          const data = await request(`/v1/admin/affiliates/${encodeURIComponent(userId)}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: String(select.value || "pending") }) });
          state.affiliates = Array.isArray(data?.affiliates) ? data.affiliates : state.affiliates;
          renderKpis(); renderAffiliates(); renderManualCreditOptions(); setNotice("Affiliate status updated.");
        } catch (error) { setNotice(`Could not save affiliate status: ${String(error?.message || error)}`); }
      });
    }
    for (const button of ui.affiliateAdminRows.querySelectorAll("[data-approve-ready]")) {
      button.addEventListener("click", async () => {
        const userId = String(button.getAttribute("data-approve-ready") || "");
        try {
          setNotice("Approving ready conversions...");
          const data = await request(`/v1/admin/affiliates/${encodeURIComponent(userId)}/conversions/approve-ready`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          state.affiliates = Array.isArray(data?.affiliates) ? data.affiliates : state.affiliates;
          renderKpis(); renderAffiliates(); setNotice(`Approved ${Number(data?.approvedCount || 0)} ready conversions.`);
        } catch (error) { setNotice(`Could not approve ready conversions: ${String(error?.message || error)}`); }
      });
    }
    for (const button of ui.affiliateAdminRows.querySelectorAll("[data-record-payout]")) {
      button.addEventListener("click", async () => {
        const userId = String(button.getAttribute("data-record-payout") || "");
        const externalReference = window.prompt("Payout reference", "") || "";
        const notes = window.prompt("Optional payout note", "") || "";
        try {
          setNotice("Recording payout...");
          const data = await request(`/v1/admin/affiliates/${encodeURIComponent(userId)}/payouts/create`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ externalReference, notes }) });
          state.affiliates = Array.isArray(data?.affiliates) ? data.affiliates : state.affiliates;
          state.payouts = Array.isArray(data?.payouts) ? data.payouts : state.payouts;
          renderKpis(); renderAffiliates(); renderPayouts(); setNotice(`Recorded payout ${formatUsdFromCents(data?.amountCents || 0)}.`);
        } catch (error) { setNotice(`Could not record payout: ${String(error?.message || error)}`); }
      });
    }
  }
  function renderPayouts() {
    if (!ui.affiliatePayoutRows) return;
    if (!state.payouts.length) {
      ui.affiliatePayoutRows.innerHTML = `<tr><td colspan="7">No payouts recorded yet.</td></tr>`;
      return;
    }
    ui.affiliatePayoutRows.innerHTML = state.payouts.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.displayName || "Unknown")}</strong><br /><span>${escapeHtml(item.email || "")}</span></td>
        <td>${escapeHtml(formatDate(item.paidAt))}</td>
        <td>${escapeHtml(formatUsdFromCents(item.amountCents || 0))}</td>
        <td>${escapeHtml(String(item.conversionCount || 0))}</td>
        <td>${escapeHtml(payoutMethodLabel(item.payoutMethod))}</td>
        <td>${escapeHtml(item.externalReference || "-")}</td>
        <td>${escapeHtml(item.createdBy || "-")}</td>
      </tr>`).join("");
  }
  function renderConversions() {
    if (!ui.affiliateConversionRows) return;
    if (!state.conversions.length) {
      ui.affiliateConversionRows.innerHTML = `<tr><td colspan="9">No conversions recorded yet.</td></tr>`;
      return;
    }
    ui.affiliateConversionRows.innerHTML = state.conversions.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.affiliateDisplayName || "Unknown")}</strong><br /><span>${escapeHtml(item.referralCode || "")}</span></td>
        <td>${escapeHtml(item.referredDisplayName || item.referredEmail || item.referredUserId || "-")}</td>
        <td>${escapeHtml(String(item.plan || "premium").toUpperCase())}</td>
        <td><span class="status-pill status-${escapeHtml(item.status || "pending")}">${escapeHtml(item.status || "pending")}</span></td>
        <td>${escapeHtml(formatUsdFromCents(item.commissionCents || 0))}</td>
        <td>${escapeHtml(formatDate(item.convertedAt))}</td>
        <td>${escapeHtml(formatDate(item.availableAt))}</td>
        <td>${escapeHtml(item.notes || "-")}</td>
        <td>${item.status === "paid" ? `<span class="hint">Paid</span>` : `<div class="actions">${item.status === "approved" ? `<button class="btn" type="button" data-pending-conversion="${escapeHtml(item.id)}">Pending</button>` : `<button class="btn" type="button" data-approve-conversion="${escapeHtml(item.id)}">Approve</button>`}<button class="btn" type="button" data-reverse-conversion="${escapeHtml(item.id)}">Reverse</button></div>`}</td>
      </tr>`).join("");
    for (const button of ui.affiliateConversionRows.querySelectorAll("[data-approve-conversion]")) {
      button.addEventListener("click", async () => {
        const conversionId = String(button.getAttribute("data-approve-conversion") || "");
        try {
          setNotice("Approving conversion...");
          const data = await request(`/v1/admin/affiliates/conversions/${encodeURIComponent(conversionId)}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          state.affiliates = Array.isArray(data?.affiliates) ? data.affiliates : state.affiliates;
          state.conversions = Array.isArray(data?.conversions) ? data.conversions : state.conversions;
          renderKpis(); renderAffiliates(); renderConversions(); setNotice(String(data?.message || "Conversion approved."));
        } catch (error) { setNotice(`Could not approve conversion: ${String(error?.message || error)}`); }
      });
    }
    for (const button of ui.affiliateConversionRows.querySelectorAll("[data-pending-conversion]")) {
      button.addEventListener("click", async () => {
        const conversionId = String(button.getAttribute("data-pending-conversion") || "");
        try {
          setNotice("Moving conversion to pending...");
          const data = await request(`/v1/admin/affiliates/conversions/${encodeURIComponent(conversionId)}/pending`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          state.affiliates = Array.isArray(data?.affiliates) ? data.affiliates : state.affiliates;
          state.conversions = Array.isArray(data?.conversions) ? data.conversions : state.conversions;
          renderKpis(); renderAffiliates(); renderConversions(); setNotice(String(data?.message || "Conversion moved to pending."));
        } catch (error) { setNotice(`Could not move conversion to pending: ${String(error?.message || error)}`); }
      });
    }
    for (const button of ui.affiliateConversionRows.querySelectorAll("[data-reverse-conversion]")) {
      button.addEventListener("click", async () => {
        const conversionId = String(button.getAttribute("data-reverse-conversion") || "");
        const note = window.prompt("Reason for reversal", "Duplicate test conversion") || "";
        try {
          setNotice("Reversing conversion...");
          const data = await request(`/v1/admin/affiliates/conversions/${encodeURIComponent(conversionId)}/reverse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
          state.affiliates = Array.isArray(data?.affiliates) ? data.affiliates : state.affiliates;
          state.conversions = Array.isArray(data?.conversions) ? data.conversions : state.conversions;
          renderKpis(); renderAffiliates(); renderConversions(); setNotice(String(data?.message || "Conversion reversed."));
        } catch (error) { setNotice(`Could not reverse conversion: ${String(error?.message || error)}`); }
      });
    }
  }
  function renderAdvertisers() {
    if (!ui.advertiserRows) return;
    if (!state.advertisers.length) {
      ui.advertiserRows.innerHTML = `<tr><td colspan="8">No advertiser accounts found.</td></tr>`;
      return;
    }
    ui.advertiserRows.innerHTML = state.advertisers.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.companyName || item.displayName || "Unknown")}</strong><br /><span>${escapeHtml(item.contactName || item.displayName || "")}</span><br /><span>${escapeHtml(item.billingEmail || item.email || "")}</span></td>
        <td><span class="status-pill status-${escapeHtml(item.status || "pending")}">${escapeHtml(item.status || "pending")}</span></td>
        <td>${escapeHtml(placementLabels(item.application?.requestedPlacements))}</td>
        <td>${escapeHtml(placementLabels(item.allowedPlacements))}</td>
        <td>${escapeHtml(String(item.stats?.campaignCount || 0))} total<br /><span>${escapeHtml(String(item.stats?.activeCount || 0))} active</span></td>
        <td>${escapeHtml(formatMoneyEur(item.budget?.budgetEur || 0))}</td>
        <td>${escapeHtml(formatMoneyEur(item.budget?.dailyLimitEur || 0))}</td>
        <td><div class="actions"><button class="btn" type="button" data-load-advertiser="${escapeHtml(item.userId)}">Load</button></div></td>
      </tr>`).join("");
    for (const button of ui.advertiserRows.querySelectorAll("[data-load-advertiser]")) {
      button.addEventListener("click", () => {
        loadAdvertiserIntoEditor(String(button.getAttribute("data-load-advertiser") || ""));
        if (ui.advertiserAccountSelect) ui.advertiserAccountSelect.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }
  function renderAdvertiserCampaignBudgets() {
    if (!ui.advertiserCampaignBudgetRows) return;
    if (!state.advertiserCampaigns.length) {
      ui.advertiserCampaignBudgetRows.innerHTML = `<tr><td colspan="8">Choose an advertiser above to load campaign budgets.</td></tr>`;
      return;
    }
    const selectedAdvertiser = state.advertisers.find((item) => String(item.userId) === String(ui.advertiserAccountSelect?.value || ""));
    const advertiserLabel = selectedAdvertiser ? (selectedAdvertiser.companyName || selectedAdvertiser.displayName || "Advertiser") : "Advertiser";
    ui.advertiserCampaignBudgetRows.innerHTML = state.advertiserCampaigns.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row?.name || "")}</strong></td>
        <td>${escapeHtml(advertiserLabel)}</td>
        <td><span class="status-pill status-${escapeHtml(row?.status || "review")}">${escapeHtml(row?.status || "review")}</span></td>
        <td>${escapeHtml((Array.isArray(row?.placements) ? row.placements : []).map((item) => item?.placement || "").filter(Boolean).join(", ") || "-")}</td>
        <td>${escapeHtml(formatMoneyEur(row?.spentEur || 0))}</td>
        <td><input type="number" min="0" step="0.01" value="${escapeHtml(String(Number(row?.budgetAllocationEur || 0)))}" data-admin-campaign-budget-input="${escapeHtml(row?.campaignId || "")}" /></td>
        <td>${escapeHtml(row?.remainingAllocationEur === null ? "-" : formatMoneyEur(row?.remainingAllocationEur || 0))}</td>
        <td><button class="btn btn-primary" type="button" data-admin-save-campaign-budget="${escapeHtml(row?.campaignId || "")}">Save</button></td>
      </tr>`).join("");
    for (const button of ui.advertiserCampaignBudgetRows.querySelectorAll("[data-admin-save-campaign-budget]")) {
      button.addEventListener("click", async () => {
        const campaignId = String(button.getAttribute("data-admin-save-campaign-budget") || "");
        const userId = String(ui.advertiserAccountSelect?.value || "").trim();
        const input = ui.advertiserCampaignBudgetRows.querySelector(`[data-admin-campaign-budget-input="${campaignId}"]`);
        if (!campaignId || !userId || !input) return;
        try {
          setNotice("Saving advertiser campaign allocation...");
          const data = await request(`/v1/admin/advertisers/${encodeURIComponent(userId)}/campaigns/${encodeURIComponent(campaignId)}/budget`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ budgetAllocationEur: Number(input.value || 0) })
          });
          state.advertiserCampaigns = Array.isArray(data?.campaigns) ? data.campaigns : state.advertiserCampaigns;
          renderAdvertiserCampaignBudgets();
          setNotice("Advertiser campaign allocation updated.");
        } catch (error) { setNotice(`Could not save advertiser campaign allocation: ${String(error?.message || error)}`); }
      });
    }
  }
  async function loadAdvertiserCampaignBudgets(userId) {
    if (!userId) {
      state.advertiserCampaigns = [];
      renderAdvertiserCampaignBudgets();
      return;
    }
    try {
      const data = await request(`/v1/admin/advertisers/${encodeURIComponent(userId)}/campaigns`);
      state.advertiserCampaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
      renderAdvertiserCampaignBudgets();
    } catch (error) {
      state.advertiserCampaigns = [];
      renderAdvertiserCampaignBudgets();
      setNotice(`Could not load advertiser campaigns: ${String(error?.message || error)}`);
    }
  }
  function clearCampaignCreateForm() {
    if (ui.adminCampaignIdInput) ui.adminCampaignIdInput.value = "";
    if (ui.adminCampaignStatusSelect) ui.adminCampaignStatusSelect.value = "review";
    if (ui.adminCampaignBudgetAllocationInput) ui.adminCampaignBudgetAllocationInput.value = "";
    if (ui.adminCampaignMediaInput) ui.adminCampaignMediaInput.value = "";
    if (ui.adminCampaignNameInput) ui.adminCampaignNameInput.value = "";
    if (ui.adminCampaignLandingUrlInput) ui.adminCampaignLandingUrlInput.value = "";
    if (ui.adminCampaignTitleInput) ui.adminCampaignTitleInput.value = "";
    if (ui.adminCampaignCtaInput) ui.adminCampaignCtaInput.value = "";
    if (ui.adminCampaignBodyInput) ui.adminCampaignBodyInput.value = "";
    if (ui.adminCampaignImageUrlInput) ui.adminCampaignImageUrlInput.value = "";
  }
  function toCsv() {
    const rows = [["Affiliate", "Email", "Status", "Code", "Clicks", "Conversions", "Ready USD", "Approved USD", "Paid USD", "Payout Method"]];
    for (const item of state.affiliates) rows.push([String(item.displayName || ""), String(item.email || ""), String(item.status || ""), String(item.affiliateCode || ""), String(Number(item.stats?.clicks || 0)), String(Number(item.stats?.conversions || 0)), (Number(item.stats?.readyCents || 0) / 100).toFixed(2), (Number(item.stats?.approvedCents || 0) / 100).toFixed(2), (Number(item.stats?.paidCents || 0) / 100).toFixed(2), String(payoutMethodLabel(item.payoutMethod))]);
    return `\uFEFF${rows.map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
  }
  function downloadCsv() {
    const blob = new Blob([toCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fishbattery-affiliates-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  async function refreshAll() {
    try {
      setNotice("Loading admin data...");
      const [affiliateData, advertiserData] = await Promise.all([request("/v1/admin/affiliates/overview"), request("/v1/admin/advertisers/overview")]);
      state.affiliates = Array.isArray(affiliateData?.affiliates) ? affiliateData.affiliates : [];
      state.payouts = Array.isArray(affiliateData?.payouts) ? affiliateData.payouts : [];
      state.conversions = Array.isArray(affiliateData?.conversions) ? affiliateData.conversions : [];
      state.advertisers = Array.isArray(advertiserData?.advertisers) ? advertiserData.advertisers : [];
      state.placements = Array.isArray(advertiserData?.placements) ? advertiserData.placements : [];
      renderKpis(); renderManualCreditOptions(); renderAffiliates(); renderPayouts(); renderConversions(); renderAdvertiserEditor(); renderAdvertisers(); renderAdvertiserCampaignBudgets(); setNotice("Admin data loaded.");
    } catch (error) {
      setNotice(`Could not load admin data: ${String(error?.message || error)}`);
      if (ui.affiliateAdminRows) ui.affiliateAdminRows.innerHTML = `<tr><td colspan="10">Enter a valid admin key to load affiliate data.</td></tr>`;
      if (ui.affiliatePayoutRows) ui.affiliatePayoutRows.innerHTML = `<tr><td colspan="7">No payout data loaded.</td></tr>`;
      if (ui.affiliateConversionRows) ui.affiliateConversionRows.innerHTML = `<tr><td colspan="9">No conversion data loaded.</td></tr>`;
      if (ui.advertiserRows) ui.advertiserRows.innerHTML = `<tr><td colspan="8">Enter a valid admin key to load advertiser data.</td></tr>`;
      renderManualCreditOptions(); renderAdvertiserEditor(); renderAdvertiserCampaignBudgets();
    }
  }
  ui.adminKeyInput.value = getStoredAdminKey();
  ui.adminActorInput.value = getStoredAdminActor();
  ui.saveAdminAccessBtn?.addEventListener("click", () => {
    localStorage.setItem("fishbattery.adminApiKey", String(ui.adminKeyInput.value || "").trim());
    localStorage.setItem("fishbattery.adminActor", String(ui.adminActorInput.value || "").trim());
    setNotice("Admin access saved locally in this browser.");
  });
  ui.refreshAdminDataBtn?.addEventListener("click", () => {
    localStorage.setItem("fishbattery.adminApiKey", String(ui.adminKeyInput.value || "").trim());
    localStorage.setItem("fishbattery.adminActor", String(ui.adminActorInput.value || "").trim());
    void refreshAll();
  });
  ui.exportAffiliateCsvBtn?.addEventListener("click", () => {
    if (!state.affiliates.length) return void setNotice("Load affiliate data first.");
    downloadCsv(); setNotice("Affiliate CSV exported.");
  });
  ui.submitManualCreditBtn?.addEventListener("click", async () => {
    const userId = String(ui.manualCreditAffiliateSelect?.value || "").trim();
    const usdAmount = Number(ui.manualCreditAmountInput?.value || 0);
    const amountCents = Math.round(usdAmount * 100);
    const status = String(ui.manualCreditStatusSelect?.value || "approved").trim().toLowerCase();
    const note = String(ui.manualCreditNoteInput?.value || "").trim();
    if (!userId) return void setNotice("Choose an affiliate before adding a manual credit.");
    if (!Number.isFinite(amountCents) || amountCents <= 0) return void setNotice("Enter a valid credit amount greater than 0.");
    try {
      setNotice("Creating manual credit...");
      const data = await request(`/v1/admin/affiliates/${encodeURIComponent(userId)}/manual-credit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents, status, note }) });
      state.affiliates = Array.isArray(data?.affiliates) ? data.affiliates : state.affiliates;
      state.conversions = Array.isArray(data?.conversions) ? data.conversions : state.conversions;
      renderKpis(); renderManualCreditOptions(); renderAffiliates(); renderConversions();
      if (ui.manualCreditAmountInput) ui.manualCreditAmountInput.value = "";
      if (ui.manualCreditNoteInput) ui.manualCreditNoteInput.value = "";
      setNotice(String(data?.message || "Manual credit created."));
    } catch (error) { setNotice(`Could not create manual credit: ${String(error?.message || error)}`); }
  });
  ui.advertiserAccountSelect?.addEventListener("change", () => loadAdvertiserIntoEditor(String(ui.advertiserAccountSelect.value || "")));
  ui.saveAdvertiserConfigBtn?.addEventListener("click", async () => {
    const userId = String(ui.advertiserAccountSelect?.value || "").trim();
    if (!userId) return void setNotice("Choose an advertiser before saving settings.");
    const placements = ui.adminAdvertiserPlacementPicker ? Array.from(ui.adminAdvertiserPlacementPicker.querySelectorAll("[data-advertiser-placement]:checked")).map((input) => String(input.value || "")) : [];
    const status = String(ui.advertiserStatusSelect?.value || "pending").trim().toLowerCase();
    const budgetEur = Number(ui.advertiserBudgetInput?.value || 0);
    const dailyLimitEur = Number(ui.advertiserDailyLimitInput?.value || 0);
    if (!Number.isFinite(budgetEur) || budgetEur < 0 || !Number.isFinite(dailyLimitEur) || dailyLimitEur < 0) return void setNotice("Budget and daily limit must be zero or greater.");
    try {
      setNotice("Saving advertiser settings...");
      let data = await request(`/v1/admin/advertisers/${encodeURIComponent(userId)}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      state.advertisers = Array.isArray(data?.advertisers) ? data.advertisers : state.advertisers;
      data = await request(`/v1/admin/advertisers/${encodeURIComponent(userId)}/placements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placements }) });
      state.advertisers = Array.isArray(data?.advertisers) ? data.advertisers : state.advertisers;
      data = await request(`/v1/admin/advertisers/${encodeURIComponent(userId)}/budget`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budgetEur, dailyLimitEur }) });
      state.advertisers = Array.isArray(data?.advertisers) ? data.advertisers : state.advertisers;
      renderKpis(); renderAdvertiserEditor(); renderAdvertisers(); loadAdvertiserIntoEditor(userId); setNotice("Advertiser settings updated.");
    } catch (error) { setNotice(`Could not save advertiser settings: ${String(error?.message || error)}`); }
  });
  ui.createAdvertiserCampaignBtn?.addEventListener("click", async () => {
    const userId = String(ui.advertiserAccountSelect?.value || "").trim();
    if (!userId) return void setNotice("Choose an advertiser before creating a campaign.");
    try {
      setNotice("Creating advertiser campaign...");
      const data = await request(`/v1/admin/advertisers/${encodeURIComponent(userId)}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: String(ui.adminCampaignIdInput?.value || "").trim(),
          status: String(ui.adminCampaignStatusSelect?.value || "review").trim().toLowerCase(),
          budgetAllocationEur: ui.adminCampaignBudgetAllocationInput?.value === "" ? null : Number(ui.adminCampaignBudgetAllocationInput?.value || 0),
          media: String(ui.adminCampaignMediaInput?.value || "").trim(),
          name: String(ui.adminCampaignNameInput?.value || "").trim(),
          landingUrl: String(ui.adminCampaignLandingUrlInput?.value || "").trim(),
          title: String(ui.adminCampaignTitleInput?.value || "").trim(),
          cta: String(ui.adminCampaignCtaInput?.value || "").trim(),
          body: String(ui.adminCampaignBodyInput?.value || "").trim(),
          imageUrl: String(ui.adminCampaignImageUrlInput?.value || "").trim()
        })
      });
      state.advertiserCampaigns = Array.isArray(data?.campaigns) ? data.campaigns : state.advertiserCampaigns;
      state.advertisers = Array.isArray(data?.advertisers) ? data.advertisers : state.advertisers;
      renderKpis();
      renderAdvertisers();
      renderAdvertiserCampaignBudgets();
      clearCampaignCreateForm();
      loadAdvertiserIntoEditor(userId);
      setNotice(`Advertiser campaign created${data?.campaignId ? `: ${data.campaignId}` : "."}`);
    } catch (error) {
      setNotice(`Could not create advertiser campaign: ${String(error?.message || error)}`);
    }
  });
  if (getStoredAdminKey()) void refreshAll();
  else {
    if (ui.affiliateAdminRows) ui.affiliateAdminRows.innerHTML = `<tr><td colspan="10">Save your admin key above to start.</td></tr>`;
    if (ui.affiliatePayoutRows) ui.affiliatePayoutRows.innerHTML = `<tr><td colspan="7">Save your admin key above to load payout history.</td></tr>`;
    if (ui.affiliateConversionRows) ui.affiliateConversionRows.innerHTML = `<tr><td colspan="9">Save your admin key above to load conversion history.</td></tr>`;
    if (ui.advertiserRows) ui.advertiserRows.innerHTML = `<tr><td colspan="8">Save your admin key above to load advertiser accounts.</td></tr>`;
    renderManualCreditOptions(); renderAdvertiserEditor(); renderAdvertiserCampaignBudgets();
  }
})();
