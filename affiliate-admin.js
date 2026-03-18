(function initAffiliateAdmin() {
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const API_BASES_DEFAULT = isLocalDev ? [PUBLIC_API_BASE, "http://localhost:3000"] : [PUBLIC_API_BASE];

  const adminKeyInput = document.getElementById("adminKeyInput");
  const adminActorInput = document.getElementById("adminActorInput");
  const saveAdminAccessBtn = document.getElementById("saveAdminAccess");
  const refreshAdminDataBtn = document.getElementById("refreshAdminData");
  const exportAffiliateCsvBtn = document.getElementById("exportAffiliateCsv");
  const adminNotice = document.getElementById("adminNotice");
  const affiliateAdminRows = document.getElementById("affiliateAdminRows");
  const affiliatePayoutRows = document.getElementById("affiliatePayoutRows");
  const affiliateConversionRows = document.getElementById("affiliateConversionRows");
  const adminKpiAffiliates = document.getElementById("adminKpiAffiliates");
  const adminKpiReady = document.getElementById("adminKpiReady");
  const adminKpiApproved = document.getElementById("adminKpiApproved");
  const adminKpiPaid = document.getElementById("adminKpiPaid");

  let currentAffiliates = [];
  let currentPayouts = [];
  let currentConversions = [];

  function getApiBases() {
    const resolved = (localStorage.getItem("fishbattery.apiBaseResolved") || "").trim();
    const out = [];
    if (resolved && API_BASES_DEFAULT.includes(resolved)) out.push(resolved);
    for (const base of API_BASES_DEFAULT) {
      if (!out.includes(base)) out.push(base);
    }
    return out;
  }

  function getStoredAdminKey() {
    return String(localStorage.getItem("fishbattery.adminApiKey") || "").trim();
  }

  function getStoredAdminActor() {
    return String(localStorage.getItem("fishbattery.adminActor") || "").trim();
  }

  function setNotice(message) {
    if (adminNotice) adminNotice.textContent = String(message || "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatUsdFromCents(cents) {
    return `USD $${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
  }

  function formatDate(value) {
    const n = Number(value || 0);
    if (!n) return "-";
    try {
      return new Date(n).toLocaleString();
    } catch {
      return "-";
    }
  }

  async function parseResponse(response) {
    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep text
    }
    if (!response.ok) {
      throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    }
    return parsed;
  }

  async function request(path, init) {
    let lastError = new Error("Request failed");
    const adminKey = getStoredAdminKey();
    const adminActor = getStoredAdminActor();
    if (!adminKey) throw new Error("Save your admin key first.");

    for (const base of getApiBases()) {
      try {
        const headers = {
          ...(init?.headers || {}),
          "x-admin-key": adminKey,
          ...(adminActor ? { "x-admin-actor": adminActor } : {})
        };
        const response = await fetch(`${base}${path}`, { ...init, headers });
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

  function renderKpis() {
    const affiliateCount = currentAffiliates.length;
    const readyCents = currentAffiliates.reduce((sum, item) => sum + Number(item.stats?.readyCents || 0), 0);
    const approvedCents = currentAffiliates.reduce((sum, item) => sum + Number(item.stats?.approvedCents || 0), 0);
    const paidCents = currentAffiliates.reduce((sum, item) => sum + Number(item.stats?.paidCents || 0), 0);
    adminKpiAffiliates.textContent = String(affiliateCount);
    adminKpiReady.textContent = formatUsdFromCents(readyCents);
    adminKpiApproved.textContent = formatUsdFromCents(approvedCents);
    adminKpiPaid.textContent = formatUsdFromCents(paidCents);
  }

  function payoutMethodLabel(value) {
    const raw = String(value || "").trim();
    if (!raw) return "Not set";
    if (raw === "paypal") return "PayPal";
    if (raw === "stripe_connect") return "Stripe Connect";
    if (raw === "bank_transfer") return "Bank transfer";
    return raw;
  }

  function renderAffiliates() {
    if (!currentAffiliates.length) {
      affiliateAdminRows.innerHTML = `<tr><td colspan="10">No affiliate accounts found.</td></tr>`;
      return;
    }
    affiliateAdminRows.innerHTML = currentAffiliates.map((item) => `
      <tr>
        <td>
          <strong>${escapeHtml(item.displayName || "Unknown")}</strong><br />
          <span>${escapeHtml(item.email || "")}</span>
        </td>
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
            <button class="btn" type="button" data-save-status="${escapeHtml(item.userId)}">Save</button>
            <button class="btn" type="button" data-approve-ready="${escapeHtml(item.userId)}">Approve ready</button>
            <button class="btn btn-primary" type="button" data-record-payout="${escapeHtml(item.userId)}">Record payout</button>
          </div>
        </td>
      </tr>
    `).join("");

    for (const button of affiliateAdminRows.querySelectorAll("[data-save-status]")) {
      button.addEventListener("click", async () => {
        const userId = String(button.getAttribute("data-save-status") || "");
        const select = affiliateAdminRows.querySelector(`[data-affiliate-status="${userId}"]`);
        if (!select) return;
        try {
          setNotice("Saving affiliate status...");
          const status = String(select.value || "pending");
          const data = await request(`/v1/admin/affiliates/${encodeURIComponent(userId)}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
          });
          currentAffiliates = Array.isArray(data?.affiliates) ? data.affiliates : currentAffiliates;
          renderKpis();
          renderAffiliates();
          setNotice("Affiliate status updated.");
        } catch (error) {
          setNotice(`Could not save affiliate status: ${String(error?.message || error)}`);
        }
      });
    }

    for (const button of affiliateAdminRows.querySelectorAll("[data-approve-ready]")) {
      button.addEventListener("click", async () => {
        const userId = String(button.getAttribute("data-approve-ready") || "");
        try {
          setNotice("Approving ready conversions...");
          const data = await request(`/v1/admin/affiliates/${encodeURIComponent(userId)}/conversions/approve-ready`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          currentAffiliates = Array.isArray(data?.affiliates) ? data.affiliates : currentAffiliates;
          renderKpis();
          renderAffiliates();
          setNotice(`Approved ${Number(data?.approvedCount || 0)} ready conversions.`);
        } catch (error) {
          setNotice(`Could not approve ready conversions: ${String(error?.message || error)}`);
        }
      });
    }

    for (const button of affiliateAdminRows.querySelectorAll("[data-record-payout]")) {
      button.addEventListener("click", async () => {
        const userId = String(button.getAttribute("data-record-payout") || "");
        const externalReference = window.prompt("Payout reference (PayPal transaction ID, bank reference, etc.)", "") || "";
        const notes = window.prompt("Optional payout note", "") || "";
        try {
          setNotice("Recording payout...");
          const data = await request(`/v1/admin/affiliates/${encodeURIComponent(userId)}/payouts/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ externalReference, notes })
          });
          currentAffiliates = Array.isArray(data?.affiliates) ? data.affiliates : currentAffiliates;
          currentPayouts = Array.isArray(data?.payouts) ? data.payouts : currentPayouts;
          renderKpis();
          renderAffiliates();
          renderPayouts();
          setNotice(`Recorded payout ${formatUsdFromCents(data?.amountCents || 0)}.`);
        } catch (error) {
          setNotice(`Could not record payout: ${String(error?.message || error)}`);
        }
      });
    }
  }

  function renderPayouts() {
    if (!currentPayouts.length) {
      affiliatePayoutRows.innerHTML = `<tr><td colspan="7">No payouts recorded yet.</td></tr>`;
      return;
    }
    affiliatePayoutRows.innerHTML = currentPayouts.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.displayName || "Unknown")}</strong><br /><span>${escapeHtml(item.email || "")}</span></td>
        <td>${escapeHtml(formatDate(item.paidAt))}</td>
        <td>${escapeHtml(formatUsdFromCents(item.amountCents || 0))}</td>
        <td>${escapeHtml(String(item.conversionCount || 0))}</td>
        <td>${escapeHtml(payoutMethodLabel(item.payoutMethod))}</td>
        <td>${escapeHtml(item.externalReference || "-")}</td>
        <td>${escapeHtml(item.createdBy || "-")}</td>
      </tr>
    `).join("");
  }

  function renderConversions() {
    if (!currentConversions.length) {
      affiliateConversionRows.innerHTML = `<tr><td colspan="9">No conversions recorded yet.</td></tr>`;
      return;
    }
    affiliateConversionRows.innerHTML = currentConversions.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.affiliateDisplayName || "Unknown")}</strong><br /><span>${escapeHtml(item.referralCode || "")}</span></td>
        <td>${escapeHtml(item.referredDisplayName || item.referredEmail || item.referredUserId || "-")}</td>
        <td>${escapeHtml(String(item.plan || "premium").toUpperCase())}</td>
        <td><span class="status-pill status-${escapeHtml(item.status || "pending")}">${escapeHtml(item.status || "pending")}</span></td>
        <td>${escapeHtml(formatUsdFromCents(item.commissionCents || 0))}</td>
        <td>${escapeHtml(formatDate(item.convertedAt))}</td>
        <td>${escapeHtml(formatDate(item.availableAt))}</td>
        <td>${escapeHtml(item.notes || "-")}</td>
        <td>
          ${item.status === "paid"
            ? `<span class="hint">Paid</span>`
            : `
              <div class="actions">
                ${item.status === "approved"
                  ? `<button class="btn" type="button" data-pending-conversion="${escapeHtml(item.id)}">Pending</button>`
                  : `<button class="btn" type="button" data-approve-conversion="${escapeHtml(item.id)}">Approve</button>`}
                <button class="btn" type="button" data-reverse-conversion="${escapeHtml(item.id)}">Reverse</button>
              </div>`}
        </td>
      </tr>
    `).join("");

    for (const button of affiliateConversionRows.querySelectorAll("[data-approve-conversion]")) {
      button.addEventListener("click", async () => {
        const conversionId = String(button.getAttribute("data-approve-conversion") || "");
        try {
          setNotice("Approving conversion...");
          const data = await request(`/v1/admin/affiliates/conversions/${encodeURIComponent(conversionId)}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          currentAffiliates = Array.isArray(data?.affiliates) ? data.affiliates : currentAffiliates;
          currentConversions = Array.isArray(data?.conversions) ? data.conversions : currentConversions;
          renderKpis();
          renderAffiliates();
          renderConversions();
          setNotice(String(data?.message || "Conversion approved."));
        } catch (error) {
          setNotice(`Could not approve conversion: ${String(error?.message || error)}`);
        }
      });
    }

    for (const button of affiliateConversionRows.querySelectorAll("[data-pending-conversion]")) {
      button.addEventListener("click", async () => {
        const conversionId = String(button.getAttribute("data-pending-conversion") || "");
        try {
          setNotice("Moving conversion to pending...");
          const data = await request(`/v1/admin/affiliates/conversions/${encodeURIComponent(conversionId)}/pending`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          currentAffiliates = Array.isArray(data?.affiliates) ? data.affiliates : currentAffiliates;
          currentConversions = Array.isArray(data?.conversions) ? data.conversions : currentConversions;
          renderKpis();
          renderAffiliates();
          renderConversions();
          setNotice(String(data?.message || "Conversion moved to pending."));
        } catch (error) {
          setNotice(`Could not move conversion to pending: ${String(error?.message || error)}`);
        }
      });
    }

    for (const button of affiliateConversionRows.querySelectorAll("[data-reverse-conversion]")) {
      button.addEventListener("click", async () => {
        const conversionId = String(button.getAttribute("data-reverse-conversion") || "");
        const note = window.prompt("Reason for reversal", "Duplicate test conversion") || "";
        try {
          setNotice("Reversing conversion...");
          const data = await request(`/v1/admin/affiliates/conversions/${encodeURIComponent(conversionId)}/reverse`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note })
          });
          currentAffiliates = Array.isArray(data?.affiliates) ? data.affiliates : currentAffiliates;
          currentConversions = Array.isArray(data?.conversions) ? data.conversions : currentConversions;
          renderKpis();
          renderAffiliates();
          renderConversions();
          setNotice(String(data?.message || "Conversion reversed."));
        } catch (error) {
          setNotice(`Could not reverse conversion: ${String(error?.message || error)}`);
        }
      });
    }
  }

  function toCsv() {
    const rows = [["Affiliate", "Email", "Status", "Code", "Clicks", "Conversions", "Ready USD", "Approved USD", "Paid USD", "Payout Method"]];
    for (const item of currentAffiliates) {
      rows.push([
        String(item.displayName || ""),
        String(item.email || ""),
        String(item.status || ""),
        String(item.affiliateCode || ""),
        String(Number(item.stats?.clicks || 0)),
        String(Number(item.stats?.conversions || 0)),
        (Number(item.stats?.readyCents || 0) / 100).toFixed(2),
        (Number(item.stats?.approvedCents || 0) / 100).toFixed(2),
        (Number(item.stats?.paidCents || 0) / 100).toFixed(2),
        String(payoutMethodLabel(item.payoutMethod))
      ]);
    }
    return `\uFEFF${rows.map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
  }

  function downloadCsv() {
    const blob = new Blob([toCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fishbattery-affiliates-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function refreshAll() {
    try {
      setNotice("Loading affiliate admin data...");
      const data = await request("/v1/admin/affiliates/overview");
      currentAffiliates = Array.isArray(data?.affiliates) ? data.affiliates : [];
      currentPayouts = Array.isArray(data?.payouts) ? data.payouts : [];
      currentConversions = Array.isArray(data?.conversions) ? data.conversions : [];
      renderKpis();
      renderAffiliates();
      renderPayouts();
      renderConversions();
      setNotice("Affiliate admin data loaded.");
    } catch (error) {
      setNotice(`Could not load affiliate admin data: ${String(error?.message || error)}`);
      affiliateAdminRows.innerHTML = `<tr><td colspan="10">Enter a valid admin key to load affiliate data.</td></tr>`;
      affiliatePayoutRows.innerHTML = `<tr><td colspan="7">No payout data loaded.</td></tr>`;
      affiliateConversionRows.innerHTML = `<tr><td colspan="9">No conversion data loaded.</td></tr>`;
    }
  }

  adminKeyInput.value = getStoredAdminKey();
  adminActorInput.value = getStoredAdminActor();

  saveAdminAccessBtn?.addEventListener("click", () => {
    localStorage.setItem("fishbattery.adminApiKey", String(adminKeyInput.value || "").trim());
    localStorage.setItem("fishbattery.adminActor", String(adminActorInput.value || "").trim());
    setNotice("Admin access saved locally in this browser.");
  });

  refreshAdminDataBtn?.addEventListener("click", () => {
    localStorage.setItem("fishbattery.adminApiKey", String(adminKeyInput.value || "").trim());
    localStorage.setItem("fishbattery.adminActor", String(adminActorInput.value || "").trim());
    void refreshAll();
  });

  exportAffiliateCsvBtn?.addEventListener("click", () => {
    if (!currentAffiliates.length) {
      setNotice("Load affiliate data first.");
      return;
    }
    downloadCsv();
    setNotice("Affiliate CSV exported.");
  });

  if (getStoredAdminKey()) {
    void refreshAll();
  } else {
    affiliateAdminRows.innerHTML = `<tr><td colspan="10">Save your admin key above to start.</td></tr>`;
    affiliatePayoutRows.innerHTML = `<tr><td colspan="7">Save your admin key above to load payout history.</td></tr>`;
    affiliateConversionRows.innerHTML = `<tr><td colspan="9">Save your admin key above to load conversion history.</td></tr>`;
  }
})();
