(function () {
  const state = window.adminState;
  if (!state) {
    return;
  }

  const EMAIL_RECIPIENT_PAGE_SIZE = 5;
  const EMAIL_LOG_PAGE_SIZE = 10;
  const STAFF_PAYMENT_PAGE_SIZE = 3;

  function setMailStatus(message) {
    const element = document.getElementById("emailStatus");
    if (element) {
      element.textContent = message;
    }
  }

  function syncEmailSendButton() {
    const button = document.getElementById("emailSendBtn");
    if (!button) {
      return;
    }

    const busy = Boolean(state.email?.sending);
    button.disabled = busy;
    button.classList.toggle("is-busy", busy);
    button.setAttribute("aria-busy", busy ? "true" : "false");
    button.textContent = busy ? "Processing..." : "Send Email";
  }

  function setCalendarStatus(message) {
    const element = document.getElementById("calendarStatus");
    if (element) {
      element.textContent = message;
    }
  }

  function setStaffStatus(message) {
    const element = document.getElementById("staffStatusLabel");
    if (element) {
      element.textContent = message;
    }
  }

  function selectedBusinessSlug() {
    return state.selectedSlug || state.paymentSlug || state.email.prefillSlug || "";
  }

  function currentEmailRecipientKind() {
    return String(state.email.recipientKind || "business");
  }

  function clampLocalPage(page, totalPages) {
    const safeTotal = Math.max(1, Number.parseInt(totalPages, 10) || 1);
    const nextPage = Number.parseInt(page, 10) || 1;
    return Math.min(safeTotal, Math.max(1, nextPage));
  }

  function buildPageData(items, page, pageSize) {
    const totalItems = Array.isArray(items) ? items.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = clampLocalPage(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    return {
      currentPage,
      totalPages,
      startIndex,
      endIndex: Math.min(startIndex + pageSize, totalItems),
      pageItems: (items || []).slice(startIndex, startIndex + pageSize),
      totalItems,
    };
  }

  function renderLocalPager(containerId, currentPage, totalPages, totalItems, pageSize, onChangeName) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    if (totalItems <= pageSize) {
      container.innerHTML = "";
      container.classList.add("hidden");
      return;
    }

    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalItems);
    container.classList.remove("hidden");
    container.innerHTML = `
      <button type="button" class="pager-btn" onclick="${onChangeName}(-1)" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
      <div class="pagination-copy">Showing ${startIndex}-${endIndex} of ${totalItems} · page ${currentPage}/${totalPages}</div>
      <button type="button" class="pager-btn" onclick="${onChangeName}(1)" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
    `;
  }

  function allBusinessEmailRecipients() {
    return state.businesses.map((business) => ({
      kind: "business",
      id: business.slug,
      name: business.name,
      email: String(business.contact?.email || "").trim(),
      subtitle: `${business.registration_id || business.id || "No institution ID"} · ${business.location_full_label || business.location_label || "No location"} · ${business.type || "Type not set"}`,
      searchable: [
        business.search_text,
        business.id,
        business.registration_id,
        business.name,
        business.slug,
        business.district,
        business.province_name,
        business.contact?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      business,
    }));
  }

  function allStaffEmailRecipients() {
    return (state.staff.snapshot?.staff || []).map((staff) => ({
      kind: "staff",
      id: staff.id,
      name: staff.full_name,
      email: String(staff.email || "").trim(),
      subtitle: `${staff.role || "Role not set"} · ${staff.department || "No department"}`,
      searchable: [
        staff.full_name,
        staff.employee_code,
        staff.role,
        staff.department,
        staff.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      staff,
    }));
  }

  function emailRecipients() {
    const kind = currentEmailRecipientKind();
    const query = String(document.getElementById("emailSearch")?.value || "").trim().toLowerCase();
    if (kind === "staff") {
      const status = String(document.getElementById("emailStaffStatus")?.value || "all");
      const department = String(document.getElementById("emailStaffDepartment")?.value || "").trim().toLowerCase();
      return allStaffEmailRecipients().filter((recipient) => {
        if (status !== "all" && recipient.staff?.status !== status) {
          return false;
        }
        if (department && !String(recipient.staff?.department || "").toLowerCase().includes(department)) {
          return false;
        }
        return !query || recipient.searchable.includes(query);
      });
    }

    const province = String(document.getElementById("emailBusinessProvince")?.value || "");
    const district = String(document.getElementById("emailBusinessDistrict")?.value || "");
    const paymentStatus = String(document.getElementById("emailBusinessStatus")?.value || "all");
    return allBusinessEmailRecipients().filter((recipient) => {
      if (province && String(recipient.business?.province || "") !== province) {
        return false;
      }
      if (district && String(recipient.business?.district || "") !== district) {
        return false;
      }
      if (paymentStatus !== "all" && getStatus(recipient.business) !== paymentStatus) {
        return false;
      }
      return !query || recipient.searchable.includes(query);
    });
  }

  function selectedEmailRecipients() {
    const selected = new Set(state.email.selectedIds || []);
    return emailRecipients()
      .concat(
        currentEmailRecipientKind() === "staff" ? allStaffEmailRecipients() : allBusinessEmailRecipients()
      )
      .filter((recipient, index, items) => {
        return selected.has(recipient.id) && items.findIndex((item) => item.id === recipient.id) === index;
      });
  }

  function syncEmailFilterVisibility() {
    const isStaff = currentEmailRecipientKind() === "staff";
    document.querySelectorAll(".email-business-filter").forEach((element) => {
      element.classList.toggle("hidden", isStaff);
    });
    document.querySelectorAll(".email-staff-filter").forEach((element) => {
      element.classList.toggle("hidden", !isStaff);
    });
  }

  function syncEmailConfigBox() {
    const configBox = document.getElementById("emailConfigBox");
    if (!configBox) {
      return;
    }

    const kind = currentEmailRecipientKind();
    if (!state.email.snapshot?.config_ready) {
      configBox.textContent = "SMTP is not configured yet. Open Config App and complete the email delivery fields before sending.";
      return;
    }

    if (kind === "staff") {
      const total = state.email.snapshot?.staff_count || 0;
      const reachable = state.email.snapshot?.staff_recipient_count || 0;
      configBox.textContent = `SMTP ready. ${reachable} of ${total} employees can be reached from this desktop.`;
      return;
    }

    const total = state.email.snapshot?.business_count || 0;
    const reachable = state.email.snapshot?.business_recipient_count || 0;
    configBox.textContent = `SMTP ready. ${reachable} of ${total} businesses can be reached from this desktop.`;
  }

  function emailPresetCatalog() {
    if (currentEmailRecipientKind() === "staff") {
      return [
        {
          id: "custom",
          label: "Custom",
          subject: "",
          body: "",
        },
        {
          id: "staff-update",
          label: "Staff Update",
          subject: "Update for {{staff_name}}",
          body: [
            "Hello {{staff_name}},",
            "",
            "This is an update from the admin team.",
            "",
            "Role: {{staff_role}}",
            "Department: {{staff_department}}",
            "Next payment due: {{next_payment_due}}",
            "",
            "Reply to this email if you need any clarification.",
          ].join("\n"),
        },
      ];
    }

    return [
      {
        id: "custom",
        label: "Custom",
        subject: "",
        body: "",
      },
      {
        id: "business-update",
        label: "General Update",
        subject: "Update for {{business_name}}",
        body: [
          "Hello {{business_name}},",
          "",
          "This is an update from the admin team.",
          "",
          "District: {{district}}",
          "Province: {{province}}",
          "Registration ID: {{registration_id}}",
          "",
          "Reply to this email if you need any changes.",
        ].join("\n"),
      },
      {
        id: "payment-expired",
        label: "Expiry Notice",
        subject: "Subscription expired for {{business_name}}",
        body: [
          "Hello {{business_name}},",
          "",
          "Your directory subscription is now marked as expired.",
          "",
          "Registration ID: {{registration_id}}",
          "Previous plan: {{plan_name}}",
          "Status: {{payment_status}}",
          "Expired on: {{expiry_date}}",
          "",
          "Available renewal offers:",
          "{{offer_summary}}",
          "",
          "Reply to this email if you want us to reactivate the listing.",
        ].join("\n"),
      },
      {
        id: "payment-reactivation-offer",
        label: "Reactivation Offer",
        subject: "Renew and reactivate {{business_name}}",
        body: [
          "Hello {{business_name}},",
          "",
          "We can reactivate your directory listing immediately after payment confirmation.",
          "",
          "Registration ID: {{registration_id}}",
          "Current status: {{payment_status}}",
          "",
          "Available renewal offers:",
          "{{offer_summary}}",
          "",
          "Reply to this email and we will help you continue on the best plan.",
        ].join("\n"),
      },
      {
        id: "payment-reactivated",
        label: "Reactivated Confirmation",
        subject: "Subscription reactivated for {{business_name}}",
        body: [
          "Hello {{business_name}},",
          "",
          "Your directory subscription has been reactivated successfully.",
          "",
          "Registration ID: {{registration_id}}",
          "Current plan: {{plan_name}}",
          "Status: {{payment_status}}",
          "Valid until: {{expiry_date}}",
          "",
          "Thank you for renewing with EduData Nepal.",
        ].join("\n"),
      },
    ];
  }

  function renderEmailPresetOptions() {
    const select = document.getElementById("emailPreset");
    if (!select) {
      return;
    }

    const defaultPreset = currentEmailRecipientKind() === "staff" ? "staff-update" : "business-update";
    const previousValue = select.value || state.email.preset || defaultPreset;
    const options = emailPresetCatalog();
    select.innerHTML = options
      .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
      .join("");
    select.value = options.some((option) => option.id === previousValue)
      ? previousValue
      : options.find((option) => option.id !== "custom")?.id || options[0]?.id || "custom";
    state.email.preset = select.value;
  }

  function getSelectedEmailPreset() {
    const presetId = String(document.getElementById("emailPreset")?.value || state.email.preset || "custom");
    return emailPresetCatalog().find((item) => item.id === presetId) || emailPresetCatalog()[0] || null;
  }

  function renderEmailRecipientList() {
    const list = document.getElementById("emailRecipientList");
    if (!list) {
      return;
    }

    const kind = currentEmailRecipientKind();
    const selected = new Set(state.email.selectedIds || []);
    const recipients = emailRecipients();
    const pageData = buildPageData(recipients, state.email.page || 1, EMAIL_RECIPIENT_PAGE_SIZE);
    state.email.page = pageData.currentPage;
    list.innerHTML = recipients.length
      ? pageData.pageItems
          .map((recipient) => {
            const hasEmail = Boolean(recipient.email);
            return `
              <label class="mail-recipient-item ${hasEmail ? "" : "unavailable"}">
                <input type="checkbox" ${selected.has(recipient.id) ? "checked" : ""} ${hasEmail ? "" : "disabled"} onchange="toggleEmailRecipient('${escapeHtml(recipient.id)}')">
                <div>
                  <div class="mail-recipient-title">${escapeHtml(recipient.name || "Recipient")}</div>
                  <div class="mail-recipient-meta">${escapeHtml(recipient.email || "No email address saved")}</div>
                  <div class="mail-recipient-meta">${escapeHtml(recipient.subtitle)}</div>
                  ${hasEmail ? "" : `<div class="mail-recipient-meta">This ${kind === "staff" ? "employee" : "business"} cannot receive email until an address is added.</div>`}
                </div>
              </label>
            `;
          })
          .join("")
      : `<div class="empty-state">No ${kind === "staff" ? "employees" : "businesses"} matched the current filters.</div>`;
    renderLocalPager(
      "emailRecipientPager",
      pageData.currentPage,
      pageData.totalPages,
      recipients.length,
      EMAIL_RECIPIENT_PAGE_SIZE,
      "changeEmailRecipientPage"
    );

    const selectedItems = selectedEmailRecipients();
    const summary = document.getElementById("emailSelectionSummary");
    if (summary) {
      summary.textContent = selectedItems.length
        ? `${selectedItems.length} recipient(s) selected: ${selectedItems.slice(0, 3).map((item) => item.name).join(", ")}${selectedItems.length > 3 ? "..." : ""}`
        : "No recipients selected yet.";
    }
    syncEmailConfigBox();
  }

  function renderEmailLogs() {
    const list = document.getElementById("emailLogList");
    if (!list) {
      return;
    }

    const logs = [...(state.email.snapshot?.recent_logs || [])].sort((left, right) => {
      const rightTime = new Date(right?.created_at || 0).getTime() || 0;
      const leftTime = new Date(left?.created_at || 0).getTime() || 0;
      return rightTime - leftTime;
    });
    const pageData = buildPageData(logs, state.email.logPage || 1, EMAIL_LOG_PAGE_SIZE);
    state.email.logPage = pageData.currentPage;
    list.innerHTML = logs.length
      ? pageData.pageItems
          .map(
            (log) => `
              <div class="mail-log-card">
                <div class="mail-log-title">${escapeHtml(log.subject || "Untitled send")}</div>
                <div class="mail-log-meta">${escapeHtml(formatDate(log.created_at))} - ${escapeHtml(log.recipient_kind || "business")} - ${escapeHtml(String(log.sent_count || 0))} sent - ${escapeHtml(String(log.failed_count || 0))} failed</div>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No email delivery logs yet.</div>`;
    renderLocalPager(
      "emailLogPager",
      pageData.currentPage,
      pageData.totalPages,
      logs.length,
      EMAIL_LOG_PAGE_SIZE,
      "changeEmailLogPage"
    );
  }

  function seedEmailTemplate() {
    renderEmailPresetOptions();
    const subject = document.getElementById("emailSubject");
    const body = document.getElementById("emailBody");
    if (!subject || !body) {
      return;
    }

    if (subject.value.trim() || body.value.trim()) {
      return;
    }

    const preset = getSelectedEmailPreset();
    if (preset && preset.id !== "custom") {
      subject.value = preset.subject;
      body.value = preset.body;
      return;
    }
  }

  window.applyEmailPreset = function applyEmailPreset() {
    const preset = getSelectedEmailPreset();
    if (!preset || preset.id === "custom") {
      setMailStatus("Custom email mode enabled.");
      return;
    }

    document.getElementById("emailSubject").value = preset.subject;
    document.getElementById("emailBody").value = preset.body;
    setMailStatus(`${preset.label} template applied.`);
  };

  window.loadEmailSnapshot = async function loadEmailSnapshot(options = {}) {
    const { silent = false } = options;
    if (!state.businesses.length) {
      await refreshDirectory({ reloadReport: false, reloadPaymentRecord: false });
    }
    if (!state.staff.snapshot) {
      await loadStaffSnapshot({ silent: true });
    }

    populateProvinceSelect("emailBusinessProvince", "All provinces");
    populateDistrictSelect("emailBusinessDistrict", "", "", "", "All districts", state.businesses);

    const response = await adminFetch("/api/email/snapshot");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load mail center data.");
    }

    state.email.snapshot = payload.data || {};
    state.email.recipientKind = currentEmailRecipientKind();
    state.email.selectedIds = [];
    state.email.page = 1;
    state.email.logPage = 1;
    renderEmailPresetOptions();
    if (state.email.prefillSlug) {
      state.email.recipientKind = "business";
      state.email.selectedIds = [state.email.prefillSlug];
      focusEmailRecipientPage(state.email.prefillSlug);
      state.email.prefillSlug = null;
    }
    const recipientKindSelect = document.getElementById("emailRecipientKind");
    if (recipientKindSelect) {
      recipientKindSelect.value = state.email.recipientKind || "business";
    }

    syncEmailFilterVisibility();
    seedEmailTemplate();
    renderEmailRecipientList();
    renderEmailLogs();
    syncEmailSendButton();
    if (!silent) {
      setMailStatus("Mail Center loaded.");
    }
  };

  function focusEmailRecipientPage(recipientId) {
    if (!recipientId) {
      return;
    }

    const recipients = emailRecipients();
    const index = recipients.findIndex((recipient) => recipient.id === recipientId);
    if (index >= 0) {
      state.email.page = Math.floor(index / EMAIL_RECIPIENT_PAGE_SIZE) + 1;
    }
  }

  window.toggleEmailRecipient = function toggleEmailRecipient(id) {
    const recipient = emailRecipients().find((item) => item.id === id);
    if (!recipient?.email) {
      toast("⚠️ No Email", "Add an email address before selecting this recipient.", "error");
      return;
    }

    const selected = new Set(state.email.selectedIds || []);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    state.email.selectedIds = [...selected];
    renderEmailRecipientList();
  };

  window.selectFilteredEmailRecipients = function selectFilteredEmailRecipients() {
    state.email.selectedIds = emailRecipients()
      .filter((recipient) => recipient.email)
      .map((recipient) => recipient.id);
    renderEmailRecipientList();
    setMailStatus("Filtered recipients selected.");
  };

  window.selectSingleEmailRecipient = function selectSingleEmailRecipient() {
    if (currentEmailRecipientKind() === "staff") {
      const staff = currentStaffMember();
      if (!staff || !String(staff.email || "").trim()) {
        toast("⚠️ No Email", "Select an employee with an email address first.", "error");
        return;
      }
      state.email.selectedIds = [staff.id];
      focusEmailRecipientPage(staff.id);
      renderEmailRecipientList();
      setMailStatus(`Prepared email for ${staff.full_name}.`);
      return;
    }

    const slug = selectedBusinessSlug();
    const business = state.businesses.find((item) => item.slug === slug && String(item.contact?.email || "").trim());
    if (!business) {
      toast("⚠️ No Email", "Select a business with an email address first.", "error");
      return;
    }
    state.email.selectedIds = [business.slug];
    focusEmailRecipientPage(business.slug);
    renderEmailRecipientList();
    setMailStatus(`Prepared email for ${business.name}.`);
  };

  window.clearEmailRecipients = function clearEmailRecipients() {
    state.email.selectedIds = [];
    renderEmailRecipientList();
    setMailStatus("Recipient selection cleared.");
  };

  window.emailSelectedBusiness = function emailSelectedBusiness() {
    const slug = selectedBusinessSlug();
    if (!slug) {
      toast("⚠️ No Selection", "Select a business before opening Mail Center.", "error");
      return;
    }
    state.email.prefillSlug = slug;
    openApp("email");
  };

  window.sendEmailCampaign = async function sendEmailCampaign() {
    if (state.email.sending) {
      return;
    }

    const selected = selectedEmailRecipients();
    if (!selected.length) {
      toast("No Recipients", "Select at least one recipient before sending.", "error");
      return;
    }

    try {
      state.email.sending = true;
      syncEmailSendButton();
      setMailStatus(`Sending ${selected.length} email(s)...`);
      const response = await adminFetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_kind: currentEmailRecipientKind(),
          recipient_ids: state.email.selectedIds,
          subject: document.getElementById("emailSubject").value,
          body: document.getElementById("emailBody").value,
          reply_to: document.getElementById("emailReplyTo").value,
          cc: document.getElementById("emailCc").value,
          bcc: document.getElementById("emailBcc").value,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to send the email campaign.");
      }
      state.email.snapshot = payload.data?.snapshot || state.email.snapshot;
      state.email.logPage = 1;
      renderEmailLogs();
      syncEmailConfigBox();
      toast("Email Sent", `Sent ${payload.data.sent_count} email(s).`, "success");
      setMailStatus(`Sent ${payload.data.sent_count} email(s).`);
    } catch (error) {
      toast("Email Error", error.message, "error");
      setMailStatus("Email send failed.");
    } finally {
      state.email.sending = false;
      syncEmailSendButton();
    }
  };

  window.notifyFilteredEmailRecipients = function notifyFilteredEmailRecipients() {
    const filtered = emailRecipients().filter((recipient) => recipient.email);
    if (!filtered.length) {
      toast("⚠️ No Recipients", "No filtered recipients with email addresses are available.", "error");
      return;
    }

    const preset = getSelectedEmailPreset();
    const subject = String(document.getElementById("emailSubject")?.value || "").trim();
    const body = String(document.getElementById("emailBody")?.value || "").trim();
    if ((!subject || !body) && preset?.id !== "custom") {
      document.getElementById("emailSubject").value = preset.subject;
      document.getElementById("emailBody").value = preset.body;
    }

    if (!String(document.getElementById("emailSubject")?.value || "").trim() || !String(document.getElementById("emailBody")?.value || "").trim()) {
      toast("⚠️ Missing Template", "Apply a template or write the email subject and body before notifying filtered recipients.", "error");
      return;
    }

    const kindLabel = currentEmailRecipientKind() === "staff" ? "employees" : "businesses";
    showModal({
      title: "Notify Filtered Recipients",
      icon: "✉️",
      body: `Send the current email to <b>${filtered.length}</b> filtered ${kindLabel}?`,
      confirmLabel: "Send To Filtered",
      confirmClass: "primary",
      onConfirm: async () => {
        state.email.selectedIds = filtered.map((recipient) => recipient.id);
        renderEmailRecipientList();
        await sendEmailCampaign();
      },
    });
  };

  function currentCalendarMonth() {
    const today = todayString();
    return state.calendar.currentMonth || `${today.slice(0, 7)}-01`;
  }

  function isoDateKey(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  function calendarEventsForDate(dateKey) {
    return (state.calendar.snapshot?.events || []).filter((event) => isoDateKey(event.date) === dateKey);
  }

  function renderCalendarEvents() {
    const label = document.getElementById("calendarSelectedLabel");
    const list = document.getElementById("calendarEventList");
    if (!label || !list) {
      return;
    }

    const dateKey = state.calendar.selectedDate || todayString();
    const items = calendarEventsForDate(dateKey);
    label.textContent = `${formatDate(dateKey)} · ${items.length} event(s)`;
    list.innerHTML = items.length
      ? items
          .map(
            (event) => `
              <div class="calendar-event-card ${escapeHtml(event.category || "reminder")}">
                <div class="calendar-event-title">${escapeHtml(event.title || "Untitled event")}</div>
                <div class="calendar-event-meta">${escapeHtml(event.category || "reminder")} · ${escapeHtml(event.source || "custom")}</div>
                ${event.notes ? `<div class="calendar-event-meta">${escapeHtml(event.notes)}</div>` : ""}
                ${event.source === "custom" ? `<div class="table-actions space-top"><button type="button" class="row-btn" onclick="editCalendarReminder('${escapeHtml(event.id)}')">Edit</button></div>` : ""}
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No events are scheduled for this day.</div>`;
  }

  function renderCalendarGrid() {
    const grid = document.getElementById("calendarGrid");
    const label = document.getElementById("calendarMonthLabel");
    const statsPill = document.getElementById("calendarStatsPill");
    if (!grid || !label || !statsPill) {
      return;
    }

    const monthDate = new Date(`${currentCalendarMonth()}T00:00:00Z`);
    const first = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
    const start = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - first.getUTCDay()));
    const today = todayString();
    label.textContent = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    statsPill.textContent = `${(state.calendar.snapshot?.events || []).length} events`;

    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(start.getTime() + index * 86400000);
      const dateKey = day.toISOString().slice(0, 10);
      const count = calendarEventsForDate(dateKey).length;
      const inMonth = day.getUTCMonth() === first.getUTCMonth();
      cells.push(`
        <button type="button" class="calendar-day ${inMonth ? "" : "muted"} ${dateKey === today ? "today" : ""} ${dateKey === state.calendar.selectedDate ? "selected" : ""}" onclick="selectCalendarDate('${dateKey}')">
          <span class="calendar-day-number">${day.getUTCDate()}</span>
          <span class="calendar-day-count">${count ? `${count} item${count === 1 ? "" : "s"}` : ""}</span>
        </button>
      `);
    }
    grid.innerHTML = cells.join("");
  }

  window.loadCalendarSnapshot = async function loadCalendarSnapshot(options = {}) {
    const { silent = false } = options;
    const response = await adminFetch("/api/calendar");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load calendar data.");
    }
    state.calendar.snapshot = payload.data || {};
    state.calendar.currentMonth = currentCalendarMonth();
    state.calendar.selectedDate = state.calendar.selectedDate || todayString();
    renderCalendarGrid();
    renderCalendarEvents();
    if (!silent) {
      setCalendarStatus("Calendar loaded.");
    }
  };

  window.selectCalendarDate = function selectCalendarDate(dateKey) {
    state.calendar.selectedDate = dateKey;
    document.getElementById("calendarDate").value = dateKey;
    renderCalendarGrid();
    renderCalendarEvents();
  };

  window.shiftCalendarMonth = function shiftCalendarMonth(delta) {
    const current = new Date(`${currentCalendarMonth()}T00:00:00Z`);
    current.setUTCMonth(current.getUTCMonth() + delta);
    state.calendar.currentMonth = `${current.toISOString().slice(0, 7)}-01`;
    renderCalendarGrid();
    setCalendarStatus("Calendar month updated.");
  };

  window.jumpCalendarToToday = function jumpCalendarToToday() {
    state.calendar.currentMonth = `${todayString().slice(0, 7)}-01`;
    state.calendar.selectedDate = todayString();
    renderCalendarGrid();
    renderCalendarEvents();
    setCalendarStatus("Returned to today.");
  };

  window.editCalendarReminder = function editCalendarReminder(id) {
    const event = (state.calendar.snapshot?.custom_events || []).find((item) => item.id === id);
    if (!event) {
      return;
    }
    document.getElementById("calendarEventId").value = event.id || "";
    document.getElementById("calendarTitle").value = event.title || "";
    document.getElementById("calendarDate").value = isoDateKey(event.date);
    document.getElementById("calendarCategory").value = event.category || "reminder";
    document.getElementById("calendarNotes").value = event.notes || "";
    state.calendar.selectedDate = isoDateKey(event.date) || state.calendar.selectedDate;
    renderCalendarGrid();
    renderCalendarEvents();
  };

  window.resetCalendarReminder = function resetCalendarReminder() {
    document.getElementById("calendarEventId").value = "";
    document.getElementById("calendarTitle").value = "";
    document.getElementById("calendarDate").value = state.calendar.selectedDate || todayString();
    document.getElementById("calendarCategory").value = "reminder";
    document.getElementById("calendarNotes").value = "";
  };

  window.saveCalendarReminder = async function saveCalendarReminder() {
    try {
      const response = await adminFetch("/api/calendar/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: document.getElementById("calendarEventId").value,
          title: document.getElementById("calendarTitle").value,
          date: document.getElementById("calendarDate").value,
          category: document.getElementById("calendarCategory").value,
          notes: document.getElementById("calendarNotes").value,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to save the reminder.");
      }
      state.calendar.snapshot = payload.data;
      state.calendar.selectedDate = document.getElementById("calendarDate").value || state.calendar.selectedDate;
      renderCalendarGrid();
      renderCalendarEvents();
      resetCalendarReminder();
      setCalendarStatus("Reminder saved.");
      toast("✅ Reminder Saved", "The calendar reminder was saved.", "success");
    } catch (error) {
      toast("❌ Calendar Error", error.message, "error");
      setCalendarStatus("Calendar save failed.");
    }
  };

  window.deleteCalendarReminder = async function deleteCalendarReminder() {
    const eventId = document.getElementById("calendarEventId").value;
    if (!eventId) {
      toast("⚠️ No Reminder", "Select a custom reminder before deleting.", "error");
      return;
    }

    try {
      const response = await adminFetch(`/api/calendar/${encodeURIComponent(eventId)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to delete the reminder.");
      }
      state.calendar.snapshot = payload.data;
      renderCalendarGrid();
      renderCalendarEvents();
      resetCalendarReminder();
      setCalendarStatus("Reminder deleted.");
    } catch (error) {
      toast("❌ Calendar Error", error.message, "error");
      setCalendarStatus("Calendar delete failed.");
    }
  };

  function filteredStaffMembers() {
    const snapshot = state.staff.snapshot || { staff: [] };
    const query = String(document.getElementById("staffSearch")?.value || "").trim().toLowerCase();
    const status = String(document.getElementById("staffStatusFilter")?.value || "all");
    const department = String(document.getElementById("staffDepartmentFilter")?.value || "").trim().toLowerCase();
    return (snapshot.staff || []).filter((staff) => {
      if (status !== "all" && staff.status !== status) {
        return false;
      }
      if (department && !String(staff.department || "").toLowerCase().includes(department)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        staff.full_name,
        staff.employee_code,
        staff.role,
        staff.department,
        staff.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function currentStaffMember() {
    return (state.staff.snapshot?.staff || []).find((item) => item.id === state.staff.selectedId) || null;
  }

  function currentStaffAdjustment() {
    const staff = currentStaffMember();
    return (
      (staff?.adjustments || []).find((item) => item.id === document.getElementById("staffAdjustmentId")?.value) ||
      null
    );
  }

  function getStaffWorkspaceView() {
    const view = String(state.staff.workspaceView || "staff");
    return ["staff", "payroll", "adjustments", "statements"].includes(view) ? view : "staff";
  }

  function getStaffMonthStart(dateValue) {
    const candidate = dateValue ? new Date(dateValue) : new Date();
    if (Number.isNaN(candidate.getTime())) {
      return null;
    }
    return new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), 1));
  }

  function addStaffMonths(dateValue, offset) {
    const base = getStaffMonthStart(dateValue);
    if (!base) {
      return null;
    }
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
  }

  function normalizeStaffNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatStaffCompensationDisplay(compensation) {
    const amount = normalizeStaffNumber(compensation?.salary_amount);
    return amount == null ? "Salary not set" : formatCurrency(amount, compensation?.salary_currency || "NPR");
  }

  function formatStaffMonthLabel(dateValue) {
    const monthStart = getStaffMonthStart(dateValue);
    return monthStart ? monthStart.toISOString().slice(0, 7) : "Not scheduled";
  }

  function sortStaffAdjustmentsForUi(adjustments = []) {
    return [...(adjustments || [])].sort((left, right) => {
      const leftTime = getStaffMonthStart(left?.effective_from)?.getTime() || 0;
      const rightTime = getStaffMonthStart(right?.effective_from)?.getTime() || 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return String(left?.id || "").localeCompare(String(right?.id || ""));
    });
  }

  function resolveStaffCompensationForDate(staff, dateValue) {
    if (!staff) {
      return {
        role: "",
        salary_amount: null,
        salary_currency: "NPR",
        effective_from: "",
      };
    }

    const targetMonthStart = getStaffMonthStart(dateValue) || getStaffMonthStart(new Date());
    const effective = {
      role: staff.base_role || staff.role || "",
      salary_amount:
        normalizeStaffNumber(staff.base_salary_amount) ??
        normalizeStaffNumber(staff.salary_amount) ??
        normalizeStaffNumber(staff.current_compensation?.salary_amount) ??
        null,
      salary_currency:
        staff.base_salary_currency ||
        staff.salary_currency ||
        staff.current_compensation?.salary_currency ||
        "NPR",
      effective_from: staff.joined_at || staff.current_compensation?.effective_from || "",
    };

    for (const adjustment of sortStaffAdjustmentsForUi(staff.adjustments || [])) {
      const adjustmentMonth = getStaffMonthStart(adjustment?.effective_from);
      if (!adjustmentMonth || !targetMonthStart || adjustmentMonth.getTime() > targetMonthStart.getTime()) {
        continue;
      }
      if (adjustment.role) {
        effective.role = adjustment.role;
      }
      if (normalizeStaffNumber(adjustment.salary_amount) != null) {
        effective.salary_amount = normalizeStaffNumber(adjustment.salary_amount);
      }
      if (adjustment.salary_currency) {
        effective.salary_currency = adjustment.salary_currency;
      }
      effective.effective_from = adjustment.effective_from;
    }

    return effective;
  }

  function buildDraftStaffAdjustmentFromForm(staff = currentStaffMember()) {
    if (!staff) {
      return null;
    }

    return {
      id: document.getElementById("staffAdjustmentId")?.value || "",
      title: document.getElementById("staffAdjustmentTitle")?.value || "Scheduled change",
      effective_from: document.getElementById("staffAdjustmentEffectiveFrom")?.value || nextMonthDateValue(),
      role: document.getElementById("staffAdjustmentRole")?.value || "",
      salary_amount: normalizeStaffNumber(document.getElementById("staffAdjustmentAmount")?.value),
      salary_currency:
        document.getElementById("staffAdjustmentCurrency")?.value ||
        staff.salary_currency ||
        staff.base_salary_currency ||
        "NPR",
      notes: document.getElementById("staffAdjustmentNotes")?.value || "",
    };
  }

  function buildStaffWithDraftAdjustment(staff, draftAdjustment) {
    if (!staff || !draftAdjustment) {
      return staff;
    }

    return {
      ...staff,
      adjustments: sortStaffAdjustmentsForUi([
        ...(staff.adjustments || []).filter((item) => item.id !== draftAdjustment.id),
        draftAdjustment,
      ]),
    };
  }

  function buildStaffStatementEntries(staff) {
    return sortedStaffPayments(staff).map((payment) => ({
      ...payment,
      compensation: resolveStaffCompensationForDate(staff, payment.paid_at),
    }));
  }

  function buildStaffStatementMonths(entries) {
    const months = new Map();
    for (const entry of entries) {
      const key = String(entry.paid_at || "").slice(0, 7);
      if (!key) {
        continue;
      }
      const month = months.get(key) || {
        key,
        totalByCurrency: {},
        paymentCount: 0,
        methods: new Set(),
        roles: new Set(),
        latestPaidAt: "",
      };
      const currency = entry.currency || entry.compensation?.salary_currency || "NPR";
      month.totalByCurrency[currency] = (month.totalByCurrency[currency] || 0) + (normalizeStaffNumber(entry.amount) || 0);
      month.paymentCount += 1;
      if (entry.method) {
        month.methods.add(entry.method);
      }
      if (entry.compensation?.role) {
        month.roles.add(entry.compensation.role);
      }
      if (!month.latestPaidAt || new Date(entry.paid_at || 0).getTime() > new Date(month.latestPaidAt || 0).getTime()) {
        month.latestPaidAt = entry.paid_at || month.latestPaidAt;
      }
      months.set(key, month);
    }

    return [...months.values()]
      .sort((left, right) => right.key.localeCompare(left.key))
      .map((month) => ({
        ...month,
        methods: [...month.methods],
        roles: [...month.roles],
      }));
  }

  function applyStaffWorkspaceView(view, options = {}) {
    const { silent = false } = options;
    const nextView = ["staff", "payroll", "adjustments", "statements"].includes(String(view || ""))
      ? String(view)
      : "staff";
    state.staff.workspaceView = nextView;

    document.querySelectorAll("[data-staff-view-btn]").forEach((button) => {
      const active = button.dataset.staffViewBtn === nextView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    document.querySelectorAll("[data-staff-view-screen]").forEach((screen) => {
      screen.classList.toggle("hidden", screen.dataset.staffViewScreen !== nextView);
    });

    if (!silent) {
      const labels = {
        staff: "Staff management screen ready.",
        payroll: "Payment management screen ready.",
        adjustments: "Promotion and increment screen ready.",
        statements: "Payroll statement screen ready.",
      };
      setStaffStatus(labels[nextView] || "Staff Manager is ready.");
    }
  }

  window.setStaffWorkspaceView = function setStaffWorkspaceView(view) {
    applyStaffWorkspaceView(view);
  };
  function renderStaffList() {
    const list = document.getElementById("staffList");
    const stats = document.getElementById("staffStatsBox");
    if (!list || !stats) {
      return;
    }

    const snapshot = state.staff.snapshot || { staff: [], stats: {} };
    stats.textContent = `${snapshot.stats?.total || 0} staff · ${snapshot.stats?.active || 0} active · ${snapshot.stats?.overdue || 0} overdue payroll · ${formatCurrency(snapshot.stats?.payroll_this_month, "NPR")} this month`;
    const items = filteredStaffMembers();
    list.innerHTML = items.length
      ? items
          .map(
            (staff) => `
              <button type="button" class="staff-list-item ${staff.id === state.staff.selectedId ? "active" : ""}" onclick="selectStaffMember('${escapeHtml(staff.id)}')">
                <div class="staff-list-title">${escapeHtml(staff.full_name || "Staff Member")}</div>
                <div class="staff-list-meta">${escapeHtml(staff.role || "Role not set")} · ${escapeHtml(staff.department || "No department")}</div>
                <div class="staff-list-meta">${escapeHtml(staff.status || "active")} · Next due ${escapeHtml(formatDate(staff.next_payment_due_at))}</div>
              </button>
            `
          )
          .join("")
      : `<div class="empty-state">No staff members match the current filters.</div>`;
  }

  function sortedStaffPayments(staff) {
    return [...(staff?.payment_history || [])].sort((left, right) => {
      const rightTime = new Date(right?.paid_at || right?.updated_at || 0).getTime() || 0;
      const leftTime = new Date(left?.paid_at || left?.updated_at || 0).getTime() || 0;
      return rightTime - leftTime;
    });
  }

  function focusStaffPaymentPage(paymentId, staff = currentStaffMember()) {
    if (!paymentId || !staff) {
      return;
    }

    const items = sortedStaffPayments(staff);
    const index = items.findIndex((payment) => payment.id === paymentId);
    if (index >= 0) {
      state.staff.paymentPage = Math.floor(index / STAFF_PAYMENT_PAGE_SIZE) + 1;
    }
  }

  function fillStaffForm(staff) {
    document.getElementById("staffId").value = staff?.id || "";
    document.getElementById("staffName").value = staff?.full_name || "";
    document.getElementById("staffCode").value = staff?.employee_code || "";
    document.getElementById("staffRole").value = staff?.role || "";
    document.getElementById("staffDepartment").value = staff?.department || "";
    document.getElementById("staffEmploymentType").value = staff?.employment_type || "Full Time";
    document.getElementById("staffStatus").value = staff?.status || "active";
    document.getElementById("staffPhone").value = staff?.phone || "";
    document.getElementById("staffEmail").value = staff?.email || "";
    document.getElementById("staffAddress").value = staff?.address || "";
    document.getElementById("staffEmergencyContact").value = staff?.emergency_contact || "";
    document.getElementById("staffJoinedAt").value = staff?.joined_at ? new Date(staff.joined_at).toISOString().slice(0, 10) : "";
    document.getElementById("staffSalaryAmount").value = staff?.salary_amount ?? "";
    document.getElementById("staffSalaryCurrency").value = staff?.salary_currency || "NPR";
    document.getElementById("staffPayCycle").value = staff?.pay_cycle || "monthly";
    document.getElementById("staffPaymentDay").value = staff?.payment_day ?? "";
    document.getElementById("staffBankAccount").value = staff?.bank_account || "";
    document.getElementById("staffAvatarUrl").value = staff?.avatar_url || "";
    document.getElementById("staffSkills").value = Array.isArray(staff?.skills) ? staff.skills.join("\n") : "";
    document.getElementById("staffDocuments").value = Array.isArray(staff?.documents) ? staff.documents.join("\n") : "";
    document.getElementById("staffNotes").value = staff?.notes || "";
  }

  function fillStaffAdjustmentForm(adjustment, staff) {
    document.getElementById("staffAdjustmentId").value = adjustment?.id || "";
    document.getElementById("staffAdjustmentTitle").value = adjustment?.title || "";
    document.getElementById("staffAdjustmentEffectiveFrom").value = adjustment?.effective_from
      ? new Date(adjustment.effective_from).toISOString().slice(0, 10)
      : nextMonthDateValue();
    document.getElementById("staffAdjustmentRole").value = adjustment?.role || "";
    document.getElementById("staffAdjustmentAmount").value = adjustment?.salary_amount ?? "";
    document.getElementById("staffAdjustmentCurrency").value =
      adjustment?.salary_currency || staff?.salary_currency || staff?.base_salary_currency || "NPR";
    document.getElementById("staffAdjustmentNotes").value = adjustment?.notes || "";
    renderStaffAdjustmentImpactCard();
  }

  function formatStaffAdjustmentCompensation(adjustment, fallbackCurrency) {
    if (adjustment?.salary_amount == null || adjustment?.salary_amount === "") {
      return "Salary unchanged";
    }
    return formatCurrency(adjustment.salary_amount, adjustment.salary_currency || fallbackCurrency || "NPR");
  }

  function renderStaffManagementCard() {
    const card = document.getElementById("staffManageCard");
    if (!card) {
      return;
    }

    const staff = currentStaffMember();
    if (!staff) {
      card.className = "payment-focus empty";
      card.innerHTML = "Select a staff member from the left list to review, update, or delete the record.";
      return;
    }

    card.className = "payment-focus";
    card.innerHTML = `
      <div class="summary-title">${escapeHtml(staff.full_name || "Staff Member")}</div>
      <div class="summary-meta">${escapeHtml(staff.employee_code || "Code not set")} · ${escapeHtml(staff.role || "Role not set")}</div>
      <div class="summary-inline">
        <span>Department <b>${escapeHtml(staff.department || "Not set")}</b></span>
        <span>Status <b>${escapeHtml(staff.status || "active")}</b></span>
        <span>Email <b>${escapeHtml(staff.email || "Not set")}</b></span>
      </div>
      <div class="summary-meta">Use the center profile form to edit this record, then choose Update Staff here. Use the buttons above to switch into payroll, increment, or statement screens.</div>
    `;
  }

  function renderStaffPaymentImpactCard() {
    const card = document.getElementById("staffPaymentImpactCard");
    if (!card) {
      return;
    }

    const staff = currentStaffMember();
    if (!staff) {
      card.className = "payment-focus empty staff-impact-card";
      card.textContent = "Select a staff member and payment date to preview the payroll impact on revenue reporting.";
      return;
    }

    const paymentDateValue = document.getElementById("staffPaymentDate")?.value || todayString();
    const compensation = resolveStaffCompensationForDate(staff, paymentDateValue);
    const scheduledAmount = normalizeStaffNumber(compensation.salary_amount);
    const formAmount =
      normalizeStaffNumber(document.getElementById("staffPaymentAmount")?.value) ?? scheduledAmount;
    const formCurrency =
      document.getElementById("staffPaymentCurrency")?.value ||
      compensation.salary_currency ||
      staff.salary_currency ||
      "NPR";
    const monthLabel = formatStaffMonthLabel(paymentDateValue);
    const differsFromSchedule =
      scheduledAmount != null &&
      (Number(formAmount || 0) !== Number(scheduledAmount || 0) || formCurrency !== (compensation.salary_currency || formCurrency));

    card.className = "payment-focus staff-impact-card";
    card.innerHTML = `
      <div class="summary-title">Reports Impact Preview</div>
      <div class="summary-meta">${escapeHtml(staff.full_name || "Staff member")} payroll for ${escapeHtml(monthLabel)} posts into Reports as a Payroll expense when this payment is saved.</div>
      <div class="summary-inline">
        <span>Posting month <b>${escapeHtml(monthLabel)}</b></span>
        <span>Salary basis <b>${escapeHtml(formatStaffCompensationDisplay(compensation))}</b></span>
        <span>Form amount <b>${escapeHtml(formAmount == null ? "Not set" : formatCurrency(formAmount, formCurrency))}</b></span>
      </div>
      <div class="summary-meta">${escapeHtml(
        differsFromSchedule
          ? "The entered payment differs from the scheduled salary for that month. The saved payroll amount will still stay intact in history and reports."
          : "If a next-month increment exists, the salary basis switches automatically once the payment month reaches its effective month."
      )}</div>
    `;
  }

  function renderStaffAdjustmentImpactCard() {
    const card = document.getElementById("staffAdjustmentImpactCard");
    if (!card) {
      return;
    }

    const staff = currentStaffMember();
    if (!staff) {
      card.className = "payment-focus empty staff-impact-card";
      card.textContent = "Select a staff member to schedule a next-month increment or promotion.";
      return;
    }

    const draft = buildDraftStaffAdjustmentFromForm(staff);
    if (!draft) {
      card.className = "payment-focus empty staff-impact-card";
      card.textContent = "Select a staff member to schedule a next-month increment or promotion.";
      return;
    }

    const hasChange = Boolean(draft.role) || normalizeStaffNumber(draft.salary_amount) != null;
    const effectiveMonth = getStaffMonthStart(draft.effective_from) || getStaffMonthStart(nextMonthDateValue());
    const previousMonth = addStaffMonths(effectiveMonth, -1) || effectiveMonth;
    const currentCompensation = resolveStaffCompensationForDate(staff, previousMonth);

    if (!hasChange) {
      card.className = "payment-focus staff-impact-card";
      card.innerHTML = `
        <div class="summary-title">Increment Impact Preview</div>
        <div class="summary-meta">Scheduled changes always start from the next month. Enter a new role, salary, or both to preview the effect.</div>
        <div class="summary-inline">
          <span>Current month <b>${escapeHtml(formatStaffMonthLabel(previousMonth))}</b></span>
          <span>Current basis <b>${escapeHtml(formatStaffCompensationDisplay(currentCompensation))}</b></span>
        </div>
      `;
      return;
    }

    const previewStaff = buildStaffWithDraftAdjustment(staff, draft);
    const futureCompensation = resolveStaffCompensationForDate(previewStaff, effectiveMonth);

    card.className = "payment-focus staff-impact-card";
    card.innerHTML = `
      <div class="summary-title">Increment Impact Preview</div>
      <div class="summary-meta">${escapeHtml(draft.title || "Scheduled change")} starts from ${escapeHtml(formatStaffMonthLabel(effectiveMonth))}. Earlier salary records stay intact.</div>
      <div class="summary-inline">
        <span>This month <b>${escapeHtml(formatStaffCompensationDisplay(currentCompensation))}</b></span>
        <span>Effective month <b>${escapeHtml(formatStaffCompensationDisplay(futureCompensation))}</b></span>
        <span>Role after change <b>${escapeHtml(futureCompensation.role || staff.role || "Role unchanged")}</b></span>
      </div>
      <div class="summary-meta">Reports only change when payroll is recorded on or after ${escapeHtml(formatStaffMonthLabel(effectiveMonth))}. Previous salary payments remain untouched.</div>
    `;
  }
  function renderStaffStatement() {
    const card = document.getElementById("staffStatementCard");
    const monthList = document.getElementById("staffStatementMonthList");
    const list = document.getElementById("staffStatementList");
    if (!card || !monthList || !list) {
      return;
    }

    const staff = currentStaffMember();
    if (!staff) {
      card.className = "payment-focus empty";
      card.textContent = "Select a staff member to review or download payroll statements.";
      monthList.innerHTML = `<div class="empty-state">Select a staff member to review monthly salary ledger lines.</div>`;
      list.innerHTML = `<div class="empty-state">Select a staff member to review payroll statement entries.</div>`;
      return;
    }

    const entries = buildStaffStatementEntries(staff);
    const months = buildStaffStatementMonths(entries);
    const currentCompensation = resolveStaffCompensationForDate(staff, new Date());
    const upcoming = staff.upcoming_adjustment;

    card.className = "payment-focus";
    card.innerHTML = `
      <div class="summary-title">${escapeHtml(staff.full_name || "Staff Member")}</div>
      <div class="summary-meta">${escapeHtml(staff.employee_code || "Code not set")} · ${escapeHtml(staff.role || "Role not set")}</div>
      <div class="summary-inline">
        <span>Current salary <b>${escapeHtml(formatStaffCompensationDisplay(currentCompensation))}</b></span>
        <span>Total paid <b>${escapeHtml(formatCurrency(staff.total_paid_amount || 0, staff.salary_currency || "NPR"))}</b></span>
        <span>Next due <b>${escapeHtml(formatDate(staff.next_payment_due_at))}</b></span>
      </div>
      <div class="summary-meta">${escapeHtml(
        upcoming
          ? `Upcoming change: ${upcoming.title || "Scheduled change"} from ${formatDate(upcoming.effective_from)}.`
          : "No future increment or promotion is scheduled."
      )}</div>
    `;

    monthList.innerHTML = months.length
      ? months
          .map(
            (month) => `
              <div class="history-item statement-row">
                <div><b>${escapeHtml(month.key)}</b> · ${escapeHtml(formatCurrencyBreakdown(month.totalByCurrency))}</div>
                <div>${escapeHtml(`${month.paymentCount} payment${month.paymentCount === 1 ? "" : "s"}`)} · ${escapeHtml(month.roles[0] || staff.role || "Role unchanged")}</div>
                <div>${escapeHtml(month.methods.length ? month.methods.join(" · ") : "Method not set")} · Last paid ${escapeHtml(formatDate(month.latestPaidAt))}</div>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No monthly payroll has been recorded yet.</div>`;

    list.innerHTML = entries.length
      ? entries
          .map(
            (entry) => `
              <div class="history-item statement-row">
                <div><b>${escapeHtml(formatDate(entry.paid_at))}</b> · ${escapeHtml(formatCurrency(entry.amount, entry.currency))}</div>
                <div>${escapeHtml(entry.compensation?.role || staff.role || "Role unchanged")} · Salary basis ${escapeHtml(formatStaffCompensationDisplay(entry.compensation))}</div>
                <div>${escapeHtml(entry.method || "Method not set")} · ${escapeHtml(entry.reference || "No reference")}</div>
                ${entry.notes ? `<div>${escapeHtml(entry.notes)}</div>` : ""}
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No payroll statement entries exist yet.</div>`;
  }

  function renderStaffFocusCard() {
    const card = document.getElementById("staffFocusCard");
    const list = document.getElementById("staffPaymentList");
    const pager = document.getElementById("staffPaymentPager");
    if (!card || !list) {
      return;
    }

    const staff = currentStaffMember();
    if (!staff) {
      card.className = "payment-focus empty";
      card.textContent = "Select a staff member to view payroll status and record payments.";
      list.innerHTML = "";
      if (pager) {
        pager.innerHTML = "";
        pager.classList.add("hidden");
      }
      renderStaffManagementCard();
      renderStaffAdjustmentList();
      renderStaffPaymentImpactCard();
      renderStaffAdjustmentImpactCard();
      renderStaffStatement();
      return;
    }

    const upcoming = staff.upcoming_adjustment;
    card.className = "payment-focus";
    card.innerHTML = `
      <div class="summary-title">${escapeHtml(staff.full_name)}</div>
      <div class="summary-meta">${escapeHtml(staff.role || "Role not set")} · ${escapeHtml(staff.department || "No department")}</div>
      <div class="summary-inline">
        <span>Status <b>${escapeHtml(staff.status || "active")}</b></span>
        <span>Salary <b>${escapeHtml(formatStaffCompensationDisplay(staff.current_compensation || staff))}</b></span>
        <span>Last Paid <b>${escapeHtml(formatDate(staff.last_payment_at))}</b></span>
        <span>Next Due <b>${escapeHtml(formatDate(staff.next_payment_due_at))}</b></span>
      </div>
      ${
        upcoming
          ? `<div class="summary-meta">Upcoming: ${escapeHtml(upcoming.title || "Scheduled change")} · ${escapeHtml(formatDate(upcoming.effective_from))} · ${escapeHtml(upcoming.role || staff.role || "Role unchanged")} · ${escapeHtml(formatStaffAdjustmentCompensation(upcoming, staff.salary_currency))}</div>`
          : '<div class="summary-meta">No increment or promotion is scheduled for the next month yet.</div>'
      }
    `;

    const payments = sortedStaffPayments(staff);
    const pageData = buildPageData(payments, state.staff.paymentPage || 1, STAFF_PAYMENT_PAGE_SIZE);
    state.staff.paymentPage = pageData.currentPage;
    list.innerHTML = payments.length
      ? pageData.pageItems
          .map(
            (payment) => `
              <div class="history-item">
                <div><b>${escapeHtml(formatDate(payment.paid_at))}</b> · ${escapeHtml(formatCurrency(payment.amount, payment.currency))}</div>
                <div>${escapeHtml(payment.method || "Method not set")} · ${escapeHtml(payment.reference || "No reference")}</div>
                <div class="table-actions space-top">
                  <button type="button" class="row-btn" onclick="editStaffPayment('${escapeHtml(payment.id)}')">Edit</button>
                  <button type="button" class="row-btn warn" onclick="deleteStaffPayment('${escapeHtml(payment.id)}')">Delete</button>
                </div>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No payroll history recorded yet.</div>`;
    renderStaffManagementCard();
    renderLocalPager(
      "staffPaymentPager",
      pageData.currentPage,
      pageData.totalPages,
      payments.length,
      STAFF_PAYMENT_PAGE_SIZE,
      "changeStaffPaymentPage"
    );
    renderStaffAdjustmentList();
    renderStaffPaymentImpactCard();
    renderStaffAdjustmentImpactCard();
    renderStaffStatement();
  }

  function renderStaffAdjustmentList() {
    const list = document.getElementById("staffAdjustmentList");
    if (!list) {
      return;
    }

    const staff = currentStaffMember();
    if (!staff) {
      list.innerHTML = `<div class="empty-state">Select a staff member to schedule salary increments or promotions.</div>`;
      return;
    }

    const adjustments = sortStaffAdjustmentsForUi(staff.adjustments || []);
    list.innerHTML = adjustments.length
      ? adjustments
          .map(
            (adjustment) => `
              <div class="history-item">
                <div><b>${escapeHtml(adjustment.title || "Scheduled change")}</b></div>
                <div>${escapeHtml(formatDate(adjustment.effective_from))} · ${escapeHtml(adjustment.role || staff.role || "Role unchanged")} · ${escapeHtml(formatStaffAdjustmentCompensation(adjustment, staff.salary_currency))}</div>
                ${adjustment.notes ? `<div>${escapeHtml(adjustment.notes)}</div>` : ""}
                <div class="table-actions space-top">
                  <button type="button" class="row-btn" onclick="editStaffAdjustment('${escapeHtml(adjustment.id)}')">Edit</button>
                  <button type="button" class="row-btn warn" onclick="deleteStaffAdjustment('${escapeHtml(adjustment.id)}')">Delete</button>
                </div>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No increment or promotion has been scheduled yet.</div>`;
  }

  function collectStaffPayload() {
    return {
      id: document.getElementById("staffId").value,
      full_name: document.getElementById("staffName").value,
      employee_code: document.getElementById("staffCode").value,
      role: document.getElementById("staffRole").value,
      department: document.getElementById("staffDepartment").value,
      employment_type: document.getElementById("staffEmploymentType").value,
      status: document.getElementById("staffStatus").value,
      phone: document.getElementById("staffPhone").value,
      email: document.getElementById("staffEmail").value,
      address: document.getElementById("staffAddress").value,
      emergency_contact: document.getElementById("staffEmergencyContact").value,
      joined_at: document.getElementById("staffJoinedAt").value,
      salary_amount: document.getElementById("staffSalaryAmount").value,
      salary_currency: document.getElementById("staffSalaryCurrency").value,
      pay_cycle: document.getElementById("staffPayCycle").value,
      payment_day: document.getElementById("staffPaymentDay").value,
      bank_account: document.getElementById("staffBankAccount").value,
      avatar_url: document.getElementById("staffAvatarUrl").value,
      skills: String(document.getElementById("staffSkills").value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      documents: String(document.getElementById("staffDocuments").value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      notes: document.getElementById("staffNotes").value,
    };
  }

  function syncStaffPaymentFormCompensation(options = {}) {
    const { force = false } = options;
    const staff = currentStaffMember();
    const paymentId = document.getElementById("staffPaymentId")?.value || "";
    const dateValue = document.getElementById("staffPaymentDate")?.value || todayString();
    const compensation = resolveStaffCompensationForDate(staff, dateValue);
    if (staff && (force || !paymentId)) {
      document.getElementById("staffPaymentAmount").value = compensation.salary_amount ?? "";
      document.getElementById("staffPaymentCurrency").value = compensation.salary_currency || staff.salary_currency || "NPR";
    }
    renderStaffPaymentImpactCard();
  }

  window.loadStaffSnapshot = async function loadStaffSnapshot(options = {}) {
    const { silent = false } = options;
    const response = await adminFetch("/api/staff");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load staff data.");
    }
    state.staff.snapshot = payload.data || { staff: [], stats: {} };
    if (state.staff.selectedId && !currentStaffMember()) {
      state.staff.selectedId = null;
    }
    state.staff.paymentPage = 1;
    renderStaffList();
    renderStaffFocusCard();
    applyStaffWorkspaceView(getStaffWorkspaceView(), { silent: true });
    if (!silent) {
      setStaffStatus("Staff data loaded.");
    }
  };

  window.selectStaffMember = function selectStaffMember(id) {
    state.staff.selectedId = id;
    state.staff.paymentPage = 1;
    const staff = currentStaffMember();
    fillStaffForm(staff);
    fillStaffAdjustmentForm(null, staff);
    resetStaffPaymentForm();
    renderStaffList();
    renderStaffFocusCard();
    applyStaffWorkspaceView(getStaffWorkspaceView(), { silent: true });
    setStaffStatus(staff ? `Selected ${staff.full_name}.` : "Staff selection cleared.");
  };

  window.resetStaffForm = function resetStaffForm() {
    state.staff.selectedId = null;
    state.staff.paymentPage = 1;
    state.staff.workspaceView = "staff";
    fillStaffForm(null);
    fillStaffAdjustmentForm(null, null);
    resetStaffPaymentForm();
    renderStaffList();
    renderStaffFocusCard();
    applyStaffWorkspaceView("staff", { silent: true });
  };
  window.saveStaffMemberFromForm = async function saveStaffMemberFromForm() {
    try {
      const response = await adminFetch("/api/staff/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectStaffPayload()),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to save the staff member.");
      }
      state.staff.snapshot = payload.data;
      const savedId = document.getElementById("staffId").value;
      const savedName = document.getElementById("staffName").value || "Staff member";
      const matched = (state.staff.snapshot.staff || []).find(
        (item) => item.id === savedId || item.full_name === savedName
      );
      if (matched) {
        state.staff.selectedId = matched.id;
        fillStaffForm(matched);
        fillStaffAdjustmentForm(null, matched);
      }
      renderStaffList();
      renderStaffFocusCard();
      applyStaffWorkspaceView(getStaffWorkspaceView(), { silent: true });
      toast("✅ Staff Saved", `${savedName} was saved.`, "success");
      setStaffStatus("Staff member saved.");
    } catch (error) {
      toast("❌ Staff Error", error.message, "error");
      setStaffStatus("Staff save failed.");
    }
  };

  window.deleteSelectedStaff = async function deleteSelectedStaff() {
    const staff = currentStaffMember();
    if (!staff) {
      toast("⚠️ No Staff", "Select a staff member before deleting.", "error");
      return;
    }
    try {
      const response = await adminFetch(`/api/staff/${encodeURIComponent(staff.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to delete the staff member.");
      }
      state.staff.snapshot = payload.data;
      resetStaffForm();
      toast("✅ Staff Deleted", `${staff.full_name} was removed.`, "success");
      setStaffStatus("Staff member deleted.");
    } catch (error) {
      toast("❌ Staff Error", error.message, "error");
      setStaffStatus("Staff delete failed.");
    }
  };

  window.resetStaffPaymentForm = function resetStaffPaymentForm() {
    document.getElementById("staffPaymentId").value = "";
    document.getElementById("staffPaymentDate").value = todayString();
    document.getElementById("staffPaymentMethod").value = "";
    document.getElementById("staffPaymentReference").value = "";
    document.getElementById("staffPaymentNotes").value = "";
    syncStaffPaymentFormCompensation({ force: true });
  };

  window.editStaffPayment = function editStaffPayment(paymentId) {
    const staff = currentStaffMember();
    const payment = (staff?.payment_history || []).find((item) => item.id === paymentId);
    if (!payment) {
      return;
    }
    focusStaffPaymentPage(paymentId, staff);
    state.staff.workspaceView = "payroll";
    document.getElementById("staffPaymentId").value = payment.id || "";
    document.getElementById("staffPaymentAmount").value = payment.amount ?? "";
    document.getElementById("staffPaymentCurrency").value = payment.currency || "NPR";
    document.getElementById("staffPaymentDate").value = payment.paid_at ? new Date(payment.paid_at).toISOString().slice(0, 10) : todayString();
    document.getElementById("staffPaymentMethod").value = payment.method || "";
    document.getElementById("staffPaymentReference").value = payment.reference || "";
    document.getElementById("staffPaymentNotes").value = payment.notes || "";
    renderStaffFocusCard();
    applyStaffWorkspaceView("payroll", { silent: true });
  };

  window.saveStaffPaymentFromForm = async function saveStaffPaymentFromForm() {
    const staff = currentStaffMember();
    if (!staff) {
      toast("⚠️ No Staff", "Select a staff member before saving payroll.", "error");
      return;
    }
    try {
      const response = await adminFetch(`/api/staff/payment/${encodeURIComponent(staff.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: document.getElementById("staffPaymentId").value,
          amount: document.getElementById("staffPaymentAmount").value,
          currency: document.getElementById("staffPaymentCurrency").value,
          paid_at: document.getElementById("staffPaymentDate").value,
          method: document.getElementById("staffPaymentMethod").value,
          reference: document.getElementById("staffPaymentReference").value,
          notes: document.getElementById("staffPaymentNotes").value,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to save the payroll payment.");
      }
      state.staff.snapshot = payload.data;
      state.staff.paymentPage = 1;
      state.staff.workspaceView = "payroll";
      renderStaffList();
      renderStaffFocusCard();
      resetStaffPaymentForm();
      applyStaffWorkspaceView("payroll", { silent: true });
      toast("✅ Payroll Saved", "The staff payment was saved.", "success");
      setStaffStatus("Payroll payment saved.");
    } catch (error) {
      toast("❌ Payroll Error", error.message, "error");
      setStaffStatus("Payroll save failed.");
    }
  };

  window.deleteStaffPayment = async function deleteStaffPayment(paymentId) {
    const staff = currentStaffMember();
    if (!staff) {
      return;
    }
    try {
      const response = await adminFetch(`/api/staff/payment/${encodeURIComponent(staff.id)}/${encodeURIComponent(paymentId)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to delete the payroll entry.");
      }
      state.staff.snapshot = payload.data;
      state.staff.workspaceView = "payroll";
      renderStaffList();
      renderStaffFocusCard();
      resetStaffPaymentForm();
      applyStaffWorkspaceView("payroll", { silent: true });
      setStaffStatus("Payroll entry deleted.");
    } catch (error) {
      toast("❌ Payroll Error", error.message, "error");
      setStaffStatus("Payroll delete failed.");
    }
  };

  window.resetStaffAdjustmentForm = function resetStaffAdjustmentForm() {
    fillStaffAdjustmentForm(null, currentStaffMember());
  };

  window.editStaffAdjustment = function editStaffAdjustment(adjustmentId) {
    const staff = currentStaffMember();
    const adjustment = (staff?.adjustments || []).find((item) => item.id === adjustmentId);
    if (!adjustment) {
      return;
    }
    state.staff.workspaceView = "adjustments";
    fillStaffAdjustmentForm(adjustment, staff);
    applyStaffWorkspaceView("adjustments", { silent: true });
  };

  window.saveStaffAdjustmentFromForm = async function saveStaffAdjustmentFromForm() {
    const staff = currentStaffMember();
    if (!staff) {
      toast("⚠️ No Staff", "Select a staff member before scheduling an increment or promotion.", "error");
      return;
    }

    try {
      const response = await adminFetch(`/api/staff/adjustment/${encodeURIComponent(staff.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: document.getElementById("staffAdjustmentId").value,
          title: document.getElementById("staffAdjustmentTitle").value,
          effective_from: document.getElementById("staffAdjustmentEffectiveFrom").value,
          role: document.getElementById("staffAdjustmentRole").value,
          salary_amount: document.getElementById("staffAdjustmentAmount").value,
          salary_currency: document.getElementById("staffAdjustmentCurrency").value,
          notes: document.getElementById("staffAdjustmentNotes").value,
        }),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to save the adjustment.");
      }
      state.staff.snapshot = payload.data;
      state.staff.workspaceView = "adjustments";
      fillStaffAdjustmentForm(null, currentStaffMember());
      renderStaffList();
      renderStaffFocusCard();
      applyStaffWorkspaceView("adjustments", { silent: true });
      toast("✅ Adjustment Saved", "The increment or promotion was scheduled.", "success");
      setStaffStatus("Staff adjustment saved.");
    } catch (error) {
      toast("❌ Staff Error", error.message, "error");
      setStaffStatus("Staff adjustment save failed.");
    }
  };

  window.deleteSelectedStaffAdjustment = async function deleteSelectedStaffAdjustment() {
    const adjustment = currentStaffAdjustment();
    if (!adjustment) {
      toast("⚠️ No Adjustment", "Select a scheduled adjustment before deleting.", "error");
      return;
    }
    await window.deleteStaffAdjustment(adjustment.id);
  };

  window.deleteStaffAdjustment = async function deleteStaffAdjustment(adjustmentId) {
    const staff = currentStaffMember();
    if (!staff) {
      return;
    }

    try {
      const response = await adminFetch(`/api/staff/adjustment/${encodeURIComponent(staff.id)}/${encodeURIComponent(adjustmentId)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to delete the adjustment.");
      }
      state.staff.snapshot = payload.data;
      state.staff.workspaceView = "adjustments";
      fillStaffAdjustmentForm(null, currentStaffMember());
      renderStaffList();
      renderStaffFocusCard();
      applyStaffWorkspaceView("adjustments", { silent: true });
      setStaffStatus("Staff adjustment deleted.");
    } catch (error) {
      toast("❌ Staff Error", error.message, "error");
      setStaffStatus("Staff adjustment delete failed.");
    }
  };

  window.downloadStaffStatement = function downloadStaffStatement() {
    const staff = currentStaffMember();
    if (!staff) {
      toast("⚠️ No Staff", "Select a staff member before downloading a statement.", "error");
      return;
    }
    state.staff.workspaceView = "statements";
    applyStaffWorkspaceView("statements", { silent: true });
    const link = document.createElement("a");
    link.href = `/api/staff/statement/${encodeURIComponent(staff.id)}`;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStaffStatus(`Payroll statement opened for ${staff.full_name}.`);
  };

  function nextMonthDateValue() {
    const next = new Date();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next.toISOString().slice(0, 10);
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("emailSearch")?.addEventListener("input", () => {
      state.email.page = 1;
      renderEmailRecipientList();
    });
    document.getElementById("emailRecipientKind")?.addEventListener("change", (event) => {
      state.email.recipientKind = event.target.value || "business";
      state.email.selectedIds = [];
      state.email.page = 1;
      renderEmailPresetOptions();
      syncEmailFilterVisibility();
      seedEmailTemplate();
      renderEmailRecipientList();
    });
    document.getElementById("emailBusinessProvince")?.addEventListener("change", (event) => {
      state.email.page = 1;
      populateDistrictSelect(
        "emailBusinessDistrict",
        event.target.value,
        "",
        "",
        "All districts",
        state.businesses
      );
      renderEmailRecipientList();
    });
    document.getElementById("emailBusinessDistrict")?.addEventListener("change", () => {
      state.email.page = 1;
      renderEmailRecipientList();
    });
    document.getElementById("emailBusinessStatus")?.addEventListener("change", () => {
      state.email.page = 1;
      renderEmailRecipientList();
    });
    document.getElementById("emailStaffStatus")?.addEventListener("change", () => {
      state.email.page = 1;
      renderEmailRecipientList();
    });
    document.getElementById("emailStaffDepartment")?.addEventListener("input", () => {
      state.email.page = 1;
      renderEmailRecipientList();
    });
    document.getElementById("emailPreset")?.addEventListener("change", (event) => {
      state.email.preset = event.target.value || "custom";
    });
    document.getElementById("staffSearch")?.addEventListener("input", renderStaffList);
    document.getElementById("staffStatusFilter")?.addEventListener("change", renderStaffList);
    document.getElementById("staffDepartmentFilter")?.addEventListener("input", renderStaffList);
    document.getElementById("staffPaymentDate")?.addEventListener("change", () => syncStaffPaymentFormCompensation({ force: false }));
    document.getElementById("staffPaymentAmount")?.addEventListener("input", renderStaffPaymentImpactCard);
    document.getElementById("staffPaymentCurrency")?.addEventListener("change", renderStaffPaymentImpactCard);
    document.getElementById("staffAdjustmentTitle")?.addEventListener("input", renderStaffAdjustmentImpactCard);
    document.getElementById("staffAdjustmentEffectiveFrom")?.addEventListener("change", renderStaffAdjustmentImpactCard);
    document.getElementById("staffAdjustmentRole")?.addEventListener("input", renderStaffAdjustmentImpactCard);
    document.getElementById("staffAdjustmentAmount")?.addEventListener("input", renderStaffAdjustmentImpactCard);
    document.getElementById("staffAdjustmentCurrency")?.addEventListener("change", renderStaffAdjustmentImpactCard);
    document.getElementById("staffAdjustmentNotes")?.addEventListener("input", renderStaffAdjustmentImpactCard);
    resetCalendarReminder();
    syncEmailFilterVisibility();
    syncEmailSendButton();
    fillStaffAdjustmentForm(null, null);
    resetStaffPaymentForm();
    applyStaffWorkspaceView(getStaffWorkspaceView(), { silent: true });
  });

  window.changeEmailRecipientPage = function changeEmailRecipientPage(delta) {
    const recipients = emailRecipients();
    const totalPages = Math.max(1, Math.ceil(recipients.length / EMAIL_RECIPIENT_PAGE_SIZE));
    const nextPage = clampLocalPage((state.email.page || 1) + delta, totalPages);
    if (nextPage === state.email.page) {
      return;
    }
    state.email.page = nextPage;
    renderEmailRecipientList();
  };

  window.changeEmailLogPage = function changeEmailLogPage(delta) {
    const logs = state.email.snapshot?.recent_logs || [];
    const totalPages = Math.max(1, Math.ceil(logs.length / EMAIL_LOG_PAGE_SIZE));
    const nextPage = clampLocalPage((state.email.logPage || 1) + delta, totalPages);
    if (nextPage === state.email.logPage) {
      return;
    }
    state.email.logPage = nextPage;
    renderEmailLogs();
  };

  window.changeStaffPaymentPage = function changeStaffPaymentPage(delta) {
    const payments = sortedStaffPayments(currentStaffMember());
    const totalPages = Math.max(1, Math.ceil(payments.length / STAFF_PAYMENT_PAGE_SIZE));
    const nextPage = clampLocalPage((state.staff.paymentPage || 1) + delta, totalPages);
    if (nextPage === state.staff.paymentPage) {
      return;
    }
    state.staff.paymentPage = nextPage;
    renderStaffFocusCard();
  };
})();


