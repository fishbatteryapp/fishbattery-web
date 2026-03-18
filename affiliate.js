(function initAffiliatePage() {
  const PUBLIC_API_BASE = "https://fishbattery-auth-api-production.up.railway.app";
  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASES = isLocalDev
    ? [PUBLIC_API_BASE, "http://localhost:3000"]
    : [PUBLIC_API_BASE];

  const token = (localStorage.getItem("fishbattery.token") || "").trim();
  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  const programSummary = document.getElementById("programSummary");
  const programCommission = document.getElementById("programCommission");
  const programThreshold = document.getElementById("programThreshold");
  const programHold = document.getElementById("programHold");
  const affiliateStatusSummary = document.getElementById("affiliateStatusSummary");
  const affiliateStatusDetail = document.getElementById("affiliateStatusDetail");
  const approvedDashboard = document.getElementById("approvedDashboard");
  const payoutSection = document.getElementById("payoutSection");
  const recentConversionsSection = document.getElementById("recentConversionsSection");
  const applicationSection = document.getElementById("applicationSection");
  const referralUrlInput = document.getElementById("referralUrl");
  const copyReferralUrlBtn = document.getElementById("copyReferralUrl");
  const copyStatusText = document.getElementById("copyStatusText");
  const recentConversions = document.getElementById("recentConversions");
  const payoutMethod = document.getElementById("payoutMethod");
  const payoutContactName = document.getElementById("payoutContactName");
  const payoutPaypalFields = document.getElementById("payoutPaypalFields");
  const payoutStripeFields = document.getElementById("payoutStripeFields");
  const payoutBankFields = document.getElementById("payoutBankFields");
  const payoutPaypalEmail = document.getElementById("payoutPaypalEmail");
  const payoutStripeEmail = document.getElementById("payoutStripeEmail");
  const payoutBankAccountName = document.getElementById("payoutBankAccountName");
  const payoutBankIban = document.getElementById("payoutBankIban");
  const payoutBankSwift = document.getElementById("payoutBankSwift");
  const payoutNotes = document.getElementById("payoutNotes");
  const payoutStatusText = document.getElementById("payoutStatusText");
  const applicationAffiliateCode = document.getElementById("applicationAffiliateCode");
  const applicationWebsiteUrl = document.getElementById("applicationWebsiteUrl");
  const applicationPrimaryPlatform = document.getElementById("applicationPrimaryPlatform");
  const applicationAudienceSummary = document.getElementById("applicationAudienceSummary");
  const applicationPromotionPlan = document.getElementById("applicationPromotionPlan");
  const applicationNotes = document.getElementById("applicationNotes");
  const applicationAcceptedTerms = document.getElementById("applicationAcceptedTerms");
  const applicationStatusText = document.getElementById("applicationStatusText");

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
      // keep plain text
    }
    if (!response.ok) {
      throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
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

  function formatUsdFromCents(cents) {
    return `USD $${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
  }

  function formatDate(timestamp) {
    const value = Number(timestamp || 0);
    if (!value) return "Not available";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Not available";
    }
  }

  function showApplicationOnly() {
    applicationSection.classList.remove("hidden");
    approvedDashboard.classList.add("hidden");
    payoutSection.classList.add("hidden");
    recentConversionsSection.classList.add("hidden");
  }

  function renderPayoutMethodFields() {
    const method = String(payoutMethod?.value || "").trim();
    payoutPaypalFields?.classList.toggle("hidden", method !== "paypal");
    payoutStripeFields?.classList.toggle("hidden", method !== "stripe_connect");
    payoutBankFields?.classList.toggle("hidden", method !== "bank_transfer");
  }

  function renderProgram(program) {
    programSummary.textContent = `Commission is ${formatUsdFromCents(program?.commissionCents)} per valid premium subscription, with a ${program?.holdDays || 45}-day review hold before payout eligibility.`;
    programCommission.textContent = formatUsdFromCents(program?.commissionCents);
    programThreshold.textContent = formatUsdFromCents(program?.payoutThresholdCents);
    programHold.textContent = `${Number(program?.holdDays || 45)} days`;
  }

  function renderConversions(items) {
    if (!Array.isArray(items) || !items.length) {
      recentConversions.innerHTML = '<p class="hint">No conversions tracked yet.</p>';
      return;
    }
    recentConversions.innerHTML = items.map((item) => `
      <article class="conversion-row">
        <strong>${String(item.plan || "premium").toUpperCase()} conversion • ${formatUsdFromCents(item.commissionCents)}</strong>
        <p class="hint">Status: ${String(item.status || "pending")} • Sale value: ${formatUsdFromCents(item.amountCents)} • Tracked: ${formatDate(item.convertedAt)}</p>
        <p class="hint">Available after hold: ${formatDate(item.availableAt)}</p>
        ${item.notes ? `<p class="hint">${String(item.notes)}</p>` : ""}
      </article>
    `).join("");
  }

  function renderAffiliateState(payload) {
    const program = payload?.program || {};
    const affiliate = payload?.affiliate || null;
    renderProgram(program);

    if (!affiliate) {
      affiliateStatusSummary.textContent = "You have not joined the affiliate program yet.";
      affiliateStatusDetail.textContent = "Submit the application below to reserve your code and accept the affiliate terms.";
      showApplicationOnly();
      return;
    }

    const status = String(affiliate.status || "pending");
    affiliateStatusSummary.textContent = `Status: ${status.charAt(0).toUpperCase()}${status.slice(1)}`;

    if (status === "approved") {
      affiliateStatusDetail.textContent = `Your code is ${affiliate.affiliateCode}. Terms accepted: ${formatDate(affiliate.termsAcceptedAt)}.`;
      approvedDashboard.classList.remove("hidden");
      payoutSection.classList.remove("hidden");
      recentConversionsSection.classList.remove("hidden");
      applicationSection.classList.add("hidden");

      referralUrlInput.value = String(affiliate.referralUrl || "");
      document.getElementById("statClicks").textContent = String(affiliate.stats?.clicks || 0);
      document.getElementById("statUniqueClicks").textContent = String(affiliate.stats?.uniqueClicks || 0);
      document.getElementById("statConversions").textContent = String(affiliate.stats?.conversions || 0);
      document.getElementById("statPending").textContent = formatUsdFromCents(affiliate.stats?.pendingCents);
      document.getElementById("statReady").textContent = formatUsdFromCents(affiliate.stats?.readyCents);
      document.getElementById("statPaid").textContent = formatUsdFromCents(affiliate.stats?.paidCents);

      payoutMethod.value = String(affiliate.payoutMethod || "");
      payoutContactName.value = String(affiliate.payoutDetails?.contactName || "");
      payoutPaypalEmail.value = String(affiliate.payoutDetails?.paypalEmail || "");
      payoutStripeEmail.value = String(affiliate.payoutDetails?.stripeEmail || "");
      payoutBankAccountName.value = String(affiliate.payoutDetails?.bankAccountName || "");
      payoutBankIban.value = String(affiliate.payoutDetails?.bankIban || "");
      payoutBankSwift.value = String(affiliate.payoutDetails?.bankSwift || "");
      payoutNotes.value = String(affiliate.payoutDetails?.notes || "");
      renderPayoutMethodFields();

      renderConversions(affiliate.recentConversions || []);
      payoutStatusText.textContent = `Threshold: ${formatUsdFromCents(affiliate.payoutThresholdCents)} • Commission: ${formatUsdFromCents(affiliate.commissionCents)} per valid premium signup.`;
      return;
    }

    if (status === "suspended") {
      affiliateStatusDetail.textContent = "Your affiliate account is currently suspended. Contact support@fishbattery.app if you think this is a mistake.";
    } else if (status === "rejected") {
      affiliateStatusDetail.textContent = "Your application was not approved at this time. You can update your details and re-accept the terms if Fishbattery asks you to reapply.";
    } else {
      affiliateStatusDetail.textContent = "Your application is under review. Your referral code is reserved, but clicks and payouts stay inactive until approval.";
    }

    showApplicationOnly();
    applicationAffiliateCode.value = String(affiliate.affiliateCode || "");
    applicationWebsiteUrl.value = String(affiliate.application?.websiteUrl || "");
    applicationPrimaryPlatform.value = String(affiliate.application?.primaryPlatform || "");
    applicationAudienceSummary.value = String(affiliate.application?.audienceSummary || "");
    applicationPromotionPlan.value = String(affiliate.application?.promotionPlan || "");
    applicationNotes.value = String(affiliate.application?.notes || "");
  }

  async function loadAffiliate() {
    const data = await request("/v1/affiliate/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    renderAffiliateState(data);
  }

  copyReferralUrlBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(String(referralUrlInput.value || ""));
      copyStatusText.textContent = "Referral link copied.";
    } catch {
      referralUrlInput.focus();
      referralUrlInput.select();
      copyStatusText.textContent = "Copy failed automatically. The link is selected so you can copy it manually.";
    }
  });

  payoutMethod?.addEventListener("change", () => {
    renderPayoutMethodFields();
  });

  document.getElementById("submitAffiliateApplication")?.addEventListener("click", async () => {
    try {
      if (!applicationAcceptedTerms.checked) {
        applicationStatusText.textContent = "You need to accept the affiliate terms before applying.";
        return;
      }
      applicationStatusText.textContent = "Submitting affiliate application...";
      const data = await request("/v1/affiliate/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          acceptedTerms: true,
          affiliateCode: String(applicationAffiliateCode.value || "").trim(),
          application: {
            websiteUrl: String(applicationWebsiteUrl.value || "").trim(),
            primaryPlatform: String(applicationPrimaryPlatform.value || "").trim(),
            audienceSummary: String(applicationAudienceSummary.value || "").trim(),
            promotionPlan: String(applicationPromotionPlan.value || "").trim(),
            notes: String(applicationNotes.value || "").trim()
          }
        })
      });
      applicationStatusText.textContent = String(data?.message || "Affiliate application submitted.");
      await loadAffiliate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      applicationStatusText.textContent = `Could not submit application: ${message}`;
    }
  });

  document.getElementById("savePayoutSettings")?.addEventListener("click", async () => {
    try {
      payoutStatusText.textContent = "Saving payout settings...";
      await request("/v1/affiliate/payout-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          payoutMethod: String(payoutMethod.value || "").trim(),
          payoutDetails: {
            contactName: String(payoutContactName.value || "").trim(),
            paypalEmail: String(payoutPaypalEmail.value || "").trim(),
            stripeEmail: String(payoutStripeEmail.value || "").trim(),
            bankAccountName: String(payoutBankAccountName.value || "").trim(),
            bankIban: String(payoutBankIban.value || "").trim(),
            bankSwift: String(payoutBankSwift.value || "").trim(),
            notes: String(payoutNotes.value || "").trim()
          }
        })
      });
      payoutStatusText.textContent = "Payout settings saved.";
      await loadAffiliate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      payoutStatusText.textContent = `Could not save payout settings: ${message}`;
    }
  });

  loadAffiliate().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    affiliateStatusSummary.textContent = "Could not load your affiliate dashboard right now.";
    affiliateStatusDetail.textContent = message || "Please refresh and try again.";
  });

  renderPayoutMethodFields();
})();
