(function initAdDashboard() {
  const rangeSelect = document.getElementById("rangeSelect");
  const placementSelect = document.getElementById("placementSelect");
  const statusSelect = document.getElementById("statusSelect");
  const authHint = document.getElementById("dashboardAuthHint");

  const kpiImpressions = document.getElementById("kpiImpressions");
  const kpiClicks = document.getElementById("kpiClicks");
  const kpiCtr = document.getElementById("kpiCtr");
  const kpiRevenue = document.getElementById("kpiRevenue");
  const kpiEcpm = document.getElementById("kpiEcpm");
  const kpiConversions = document.getElementById("kpiConversions");
  const kpiConversionRate = document.getElementById("kpiConversionRate");
  const kpiAvgCpc = document.getElementById("kpiAvgCpc");
  const placementBars = document.getElementById("placementBars");
  const campaignRows = document.getElementById("campaignRows");
  const notice = document.getElementById("dashboardNotice");

  const btnExport = document.getElementById("btnExport");
  const btnRefresh = document.getElementById("btnRefresh");

  if (!rangeSelect || !placementSelect || !statusSelect || !campaignRows) return;

  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev ? [PUBLIC_API_BASE, "http://localhost:3000"] : [PUBLIC_API_BASE];

  let currentCampaignMetrics = [];
  let currentCampaignRows = [];
  const CPM_EUR = 1.5;
  const CPC_EUR = 0.3;
  const CPA_EUR = 2;

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
    return `EUR ${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function asFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function campaignPricingModel(row) {
    const raw = String(
      row?.pricingModel || row?.pricing_model || row?.billingModel || row?.billing_model || row?.model || "mixed"
    )
      .trim()
      .toLowerCase();
    if (raw === "cpm" || raw === "cpc" || raw === "cpa" || raw === "mixed") return raw;
    if (raw.includes("cpm")) return "cpm";
    if (raw.includes("cpc")) return "cpc";
    if (raw.includes("cpa")) return "cpa";
    return "mixed";
  }

  function campaignRates(row) {
    return {
      cpmEur: asFiniteNumber(row?.cpmEur ?? row?.cpm ?? row?.rateCpmEur, CPM_EUR),
      cpcEur: asFiniteNumber(row?.cpcEur ?? row?.cpc ?? row?.rateCpcEur, CPC_EUR),
      cpaEur: asFiniteNumber(row?.cpaEur ?? row?.cpa ?? row?.rateCpaEur, CPA_EUR)
    };
  }

  function conversionCount(row) {
    return asFiniteNumber(row?.conversions ?? row?.actions ?? row?.installs ?? row?.signups, 0);
  }

  function computeRevenueForRow(row) {
    const impressions = asFiniteNumber(row?.impressions, 0);
    const clicks = asFiniteNumber(row?.clicks, 0);
    const conversions = conversionCount(row);
    const model = campaignPricingModel(row);
    const rates = campaignRates(row);
    if (model === "cpm") return (impressions / 1000) * rates.cpmEur;
    if (model === "cpc") return clicks * rates.cpcEur;
    if (model === "cpa") return conversions * rates.cpaEur;
    return (impressions / 1000) * rates.cpmEur + clicks * rates.cpcEur + conversions * rates.cpaEur;
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

  function getAuthToken() {
    return String(localStorage.getItem("fishbattery.token") || "").trim();
  }

  function setNotice(message) {
    if (notice) notice.textContent = message;
  }

  function updateAuthHint() {
    if (!authHint) return;
    const hasToken = !!getAuthToken();
    if (hasToken) {
      authHint.textContent = "Signed in. Dashboard is scoped to your own campaign stats.";
      return;
    }
    authHint.textContent = "Sign in to view your campaign stats.";
  }

  async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;

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
    const impressions = asFiniteNumber(totals?.impressions, 0);
    const clicks = asFiniteNumber(totals?.clicks, 0);
    const conversions = asFiniteNumber(totals?.conversions ?? totals?.actions, 0);
    const ctr = asFiniteNumber(totals?.ctr, impressions > 0 ? (clicks / impressions) * 100 : 0);
    const revenue =
      asFiniteNumber(totals?.revenueEur ?? totals?.estimatedRevenueEur ?? totals?.spendEur ?? totals?.estimatedSpendEur, 0) ||
      currentCampaignRows.reduce((sum, row) => sum + asFiniteNumber(row?.revenueEur, 0), 0);
    const ecpm = impressions > 0 ? (revenue / impressions) * 1000 : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const avgCpc = clicks > 0 ? revenue / clicks : 0;
    if (kpiImpressions) kpiImpressions.textContent = formatNumber(impressions);
    if (kpiClicks) kpiClicks.textContent = formatNumber(clicks);
    if (kpiCtr) kpiCtr.textContent = `${ctr.toFixed(2)}%`;
    if (kpiRevenue) kpiRevenue.textContent = formatMoneyEur(revenue);
    if (kpiEcpm) kpiEcpm.textContent = formatMoneyEur(ecpm);
    if (kpiConversions) kpiConversions.textContent = formatNumber(conversions);
    if (kpiConversionRate) kpiConversionRate.textContent = `${conversionRate.toFixed(2)}%`;
    if (kpiAvgCpc) kpiAvgCpc.textContent = formatMoneyEur(avgCpc);
  }

  function renderPlacementBars(rows) {
    if (!placementBars) return;
    const listRaw = Array.isArray(rows) ? rows : [];
    const list = listRaw.filter((row) => Number(row?.impressions || 0) > 0 || Number(row?.clicks || 0) > 0);
    if (!list.length) {
      placementBars.innerHTML = `<p class="hint">No active placement traffic in this range yet.</p>`;
      return;
    }
    const totalImpressions = Math.max(
      1,
      list.reduce((sum, row) => sum + asFiniteNumber(row?.impressions, 0), 0)
    );
    placementBars.innerHTML = list
      .map((row) => {
        const placement = escapeHtml(placementLabel(row?.placement));
        const impressions = asFiniteNumber(row?.impressions, 0);
        const clicks = asFiniteNumber(row?.clicks, 0);
        const ctr = asFiniteNumber(row?.ctr, impressions > 0 ? (clicks / impressions) * 100 : 0);
        const share = (impressions / totalImpressions) * 100;
        const width = Math.max(8, Math.round(share));
        return `
          <div class="ads-bar-row">
            <div class="ads-bar-meta">
              <strong>${placement}</strong>
              <span>${share.toFixed(2)}% share (${formatNumber(impressions)} impressions) | ${formatNumber(clicks)} clicks | ${ctr.toFixed(2)}% CTR</span>
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
        pricingModel: campaignPricingModel(row),
        rates: campaignRates(row),
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenueEur: 0,
        budgetEur: asFiniteNumber(row?.budgetEur ?? row?.budget, 0),
        dailyLimitEur: asFiniteNumber(row?.dailyLimitEur ?? row?.dailyLimit, 0),
        placements: []
      };

      const placement = String(row?.placement || "").trim();
      if (placement && !existing.placements.includes(placement)) existing.placements.push(placement);
      const rowImpressions = asFiniteNumber(row?.impressions, 0);
      const rowClicks = asFiniteNumber(row?.clicks, 0);
      const rowConversions = conversionCount(row);
      const rowRevenue =
        asFiniteNumber(row?.revenueEur ?? row?.estimatedRevenueEur ?? row?.spendEur ?? row?.estimatedSpendEur, 0) ||
        computeRevenueForRow(row);

      existing.impressions += rowImpressions;
      existing.clicks += rowClicks;
      existing.conversions += rowConversions;
      existing.revenueEur += rowRevenue;
      if (!existing.budgetEur) existing.budgetEur = asFiniteNumber(row?.budgetEur ?? row?.budget, 0);
      if (!existing.dailyLimitEur) existing.dailyLimitEur = asFiniteNumber(row?.dailyLimitEur ?? row?.dailyLimit, 0);
      grouped.set(campaignId, existing);
    }

    currentCampaignRows = Array.from(grouped.values())
      .map((row) => ({
        ...row,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
        conversionRate: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
        avgCpc: row.clicks > 0 ? row.revenueEur / row.clicks : 0,
        spentEur: row.revenueEur,
        remainingBudgetEur: row.budgetEur > 0 ? Math.max(0, row.budgetEur - row.revenueEur) : 0
      }))
      .sort((a, b) => {
        if (b.impressions !== a.impressions) return b.impressions - a.impressions;
        return a.campaignName.localeCompare(b.campaignName);
      });

    if (!currentCampaignRows.length) {
      campaignRows.innerHTML = `<tr><td colspan="15">No campaign metrics match the selected filters.</td></tr>`;
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
        const pricingModel = String(row?.pricingModel || "mixed").toUpperCase();
        const impressions = asFiniteNumber(row?.impressions, 0);
        const clicks = asFiniteNumber(row?.clicks, 0);
        const ctr = asFiniteNumber(row?.ctr, 0);
        const conversions = asFiniteNumber(row?.conversions, 0);
        const conversionRate = asFiniteNumber(row?.conversionRate, 0);
        const avgCpc = asFiniteNumber(row?.avgCpc, 0);
        const revenue = asFiniteNumber(row?.revenueEur, 0);
        const budget = asFiniteNumber(row?.budgetEur, 0);
        const spent = asFiniteNumber(row?.spentEur, 0);
        const remaining = asFiniteNumber(row?.remainingBudgetEur, 0);
        const dailyLimit = asFiniteNumber(row?.dailyLimitEur, 0);
        return `
          <tr>
            <td><strong>${campaignName}</strong></td>
            <td>${placement}</td>
            <td><span class="status-pill status-${status}">${status}</span></td>
            <td>${pricingModel}</td>
            <td>${formatNumber(impressions)}</td>
            <td>${formatNumber(clicks)}</td>
            <td>${ctr.toFixed(2)}%</td>
            <td>${formatNumber(conversions)}</td>
            <td>${conversionRate.toFixed(2)}%</td>
            <td>${formatMoneyEur(avgCpc)}</td>
            <td>${formatMoneyEur(revenue)}</td>
            <td>${budget > 0 ? formatMoneyEur(budget) : "-"}</td>
            <td>${formatMoneyEur(spent)}</td>
            <td>${budget > 0 ? formatMoneyEur(remaining) : "-"}</td>
            <td>${dailyLimit > 0 ? `${formatMoneyEur(dailyLimit)}/day` : "-"}</td>
          </tr>
        `;
      })
      .join("");

    const totalsFromRows = currentCampaignRows.reduce(
      (acc, row) => {
        acc.impressions += asFiniteNumber(row?.impressions, 0);
        acc.clicks += asFiniteNumber(row?.clicks, 0);
        acc.conversions += asFiniteNumber(row?.conversions, 0);
        acc.revenueEur += asFiniteNumber(row?.revenueEur, 0);
        return acc;
      },
      { impressions: 0, clicks: 0, conversions: 0, revenueEur: 0 }
    );
    renderKpis({
      impressions: totalsFromRows.impressions,
      clicks: totalsFromRows.clicks,
      conversions: totalsFromRows.conversions,
      revenueEur: totalsFromRows.revenueEur
    });
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

  function toCsv(rows) {
    const head = [
      "campaign_id",
      "campaign_name",
      "placement",
      "status",
      "pricing_model",
      "impressions",
      "clicks",
      "ctr_percent",
      "conversions",
      "conversion_rate_percent",
      "avg_cpc_eur",
      "estimated_revenue_eur",
      "budget_eur",
      "spent_eur",
      "remaining_budget_eur",
      "daily_limit_eur"
    ];
    const lines = [head];
    for (const row of rows) {
      lines.push([
        String(row?.campaignId || ""),
        String(row?.campaignName || ""),
        String((Array.isArray(row?.placements) ? row.placements : []).join("|")),
        String(row?.status || ""),
        String(row?.pricingModel || "mixed"),
        String(Number(row?.impressions || 0)),
        String(Number(row?.clicks || 0)),
        Number(row?.ctr || 0).toFixed(2),
        String(Number(row?.conversions || 0)),
        Number(row?.conversionRate || 0).toFixed(2),
        String(Number(row?.avgCpc || 0).toFixed(2)),
        String(Number(row?.revenueEur || 0).toFixed(2)),
        String(Number(row?.budgetEur || 0).toFixed(2)),
        String(Number(row?.spentEur || 0).toFixed(2)),
        String(Number(row?.remainingBudgetEur || 0).toFixed(2)),
        String(Number(row?.dailyLimitEur || 0).toFixed(2))
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

  async function refreshAll() {
    try {
      updateAuthHint();
      setNotice("Loading dashboard...");
      await refreshSummary();
      setNotice("Dashboard loaded.");
    } catch (err) {
      renderKpis({ impressions: 0, clicks: 0, ctr: 0, conversions: 0, revenueEur: 0 });
      renderPlacementBars([]);
      renderMetricsTable([]);
      setNotice(`Unable to load dashboard: ${String(err?.message || err)}`);
    }
  }

  if (btnRefresh) btnRefresh.addEventListener("click", () => void refreshAll());
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const csv = toCsv(currentCampaignRows);
      downloadCsv(csv);
      setNotice("CSV export downloaded.");
    });
  }

  rangeSelect.addEventListener("change", () => void refreshSummary());
  placementSelect.addEventListener("change", () => void refreshSummary());
  statusSelect.addEventListener("change", () => void refreshSummary());
  updateAuthHint();
  void refreshAll();
})();
