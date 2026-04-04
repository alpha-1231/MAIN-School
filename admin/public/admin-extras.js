(function () {
  const state = window.adminState;
  if (!state) {
    return;
  }

  function setMailStatus(message) {
    const element = document.getElementById("emailStatus");
    if (element) {
      element.textContent = message;
    }
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

  function emailRecipients() {
    const query = String(document.getElementById("emailSearch")?.value || "").trim().toLowerCase();
    return state.businesses.filter((business) => {
      const email = String(business.contact?.email || "").trim();
      if (!email) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        business.name,
        business.slug,
        business.district,
        business.province_name,
        email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function selectedEmailRecipients() {
    const selected = new Set(state.email.selectedSlugs || []);
    return state.businesses.filter((business) => selected.has(business.slug));
  }

  function renderEmailRecipientList() {
    const list = document.getElementById("emailRecipientList");
    if (!list) {
      return;
    }

    const selected = new Set(state.email.selectedSlugs || []);
    const recipients = emailRecipients();
    list.innerHTML = recipients.length
      ? recipients
          .map(
            (business) => `
              <label class="mail-recipient-item">
                <input type="checkbox" ${selected.has(business.slug) ? "checked" : ""} onchange="toggleEmailRecipient('${escapeHtml(business.slug)}')">
                <div>
                  <div class="mail-recipient-title">${escapeHtml(business.name)}</div>
                  <div class="mail-recipient-meta">${escapeHtml(business.contact?.email || "")}</div>
                  <div class="mail-recipient-meta">${escapeHtml(business.location_full_label || business.location_label || "No location")} · ${escapeHtml(business.type || "Type not set")}</div>
                </div>
              </label>
            `
          )
          .join("")
      : `<div class="empty-state">No email-ready businesses match the current search.</div>`;

    const selectedItems = selectedEmailRecipients();
    const summary = document.getElementById("emailSelectionSummary");
    if (summary) {
      summary.textContent = selectedItems.length
        ? `${selectedItems.length} recipient(s) selected: ${selectedItems.slice(0, 3).map((item) => item.name).join(", ")}${selectedItems.length > 3 ? "..." : ""}`
        : "No recipients selected yet.";
    }
  }

  function renderEmailLogs() {
    const list = document.getElementById("emailLogList");
    if (!list) {
      return;
    }

    const logs = state.email.snapshot?.recent_logs || [];
    list.innerHTML = logs.length
      ? logs
          .map(
            (log) => `
              <div class="mail-log-card">
                <div class="mail-log-title">${escapeHtml(log.subject || "Untitled send")}</div>
                <div class="mail-log-meta">${escapeHtml(formatDate(log.created_at))} · ${escapeHtml(String(log.sent_count || 0))} sent · ${escapeHtml(String(log.failed_count || 0))} failed</div>
              </div>
            `
          )
          .join("")
      : `<div class="empty-state">No email delivery logs yet.</div>`;
  }

  function seedEmailTemplate() {
    const subject = document.getElementById("emailSubject");
    const body = document.getElementById("emailBody");
    if (!subject || !body) {
      return;
    }

    if (!subject.value.trim()) {
      subject.value = "Update for {{business_name}}";
    }
    if (!body.value.trim()) {
      body.value = [
        "Hello {{business_name}},",
        "",
        "This is an update from the admin team.",
        "",
        "District: {{district}}",
        "Province: {{province}}",
        "Website ready: {{website_ready}}",
        "APK ready: {{apk_ready}}",
        "",
        "Reply to this email if you need any changes.",
      ].join("\\n");
    }
  }

  window.loadEmailSnapshot = async function loadEmailSnapshot(options = {}) {
    const { silent = false } = options;
    if (!state.businesses.length) {
      await refreshDirectory({ reloadReport: false, reloadPaymentRecord: false });
    }

    const response = await fetch("/api/email/snapshot");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load mail center data.");
    }

    state.email.snapshot = payload.data || {};
    seedEmailTemplate();
    if (state.email.prefillSlug) {
      state.email.selectedSlugs = [state.email.prefillSlug];
      state.email.prefillSlug = null;
    }

    const configBox = document.getElementById("emailConfigBox");
    if (configBox) {
      configBox.textContent = state.email.snapshot.config_ready
        ? `SMTP ready. ${state.email.snapshot.recipient_count || 0} business recipients can be reached from this desktop.`
        : "SMTP is not configured yet. Open Config App and complete the email delivery fields before sending.";
    }

    renderEmailRecipientList();
    renderEmailLogs();
    if (!silent) {
      setMailStatus("Mail Center loaded.");
    }
  };

  window.toggleEmailRecipient = function toggleEmailRecipient(slug) {
    const selected = new Set(state.email.selectedSlugs || []);
    if (selected.has(slug)) {
      selected.delete(slug);
    } else {
      selected.add(slug);
    }
    state.email.selectedSlugs = [...selected];
    renderEmailRecipientList();
  };

  window.selectFilteredEmailRecipients = function selectFilteredEmailRecipients() {
    state.email.selectedSlugs = emailRecipients().map((business) => business.slug);
    renderEmailRecipientList();
    setMailStatus("Filtered recipients selected.");
  };

  window.selectSingleEmailRecipient = function selectSingleEmailRecipient() {
    const slug = selectedBusinessSlug();
    const business = state.businesses.find((item) => item.slug === slug && String(item.contact?.email || "").trim());
    if (!business) {
      toast("⚠️ No Email", "Select a business with an email address first.", "error");
      return;
    }
    state.email.selectedSlugs = [business.slug];
    renderEmailRecipientList();
    setMailStatus(`Prepared email for ${business.name}.`);
  };

  window.clearEmailRecipients = function clearEmailRecipients() {
    state.email.selectedSlugs = [];
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
      toast("⚠️ No Recipients", "Select at least one business recipient.", "error");
      return;
    }

    try {
      state.email.sending = true;
      setMailStatus(`Sending ${selected.length} email(s)...`);
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_slugs: state.email.selectedSlugs,
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
      renderEmailLogs();
      toast("✅ Email Sent", `Sent ${payload.data.sent_count} email(s).`, "success");
      setMailStatus(`Sent ${payload.data.sent_count} email(s).`);
    } catch (error) {
      toast("❌ Email Error", error.message, "error");
      setMailStatus("Email send failed.");
    } finally {
      state.email.sending = false;
    }
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
    const response = await fetch("/api/calendar");
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
      const response = await fetch("/api/calendar/save", {
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
      const response = await fetch(`/api/calendar/${encodeURIComponent(eventId)}`, { method: "DELETE" });
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

  function renderStaffList() {
    const list = document.getElementById("staffList");
    const stats = document.getElementById("staffStatsBox");
    if (!list || !stats) {
      return;
    }

    const snapshot = state.staff.snapshot || { staff: [], stats: {} };
    stats.textContent = `${snapshot.stats?.total || 0} staff · ${snapshot.stats?.active || 0} active · ${snapshot.stats?.overdue || 0} overdue payroll`;
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

  function renderStaffFocusCard() {
    const card = document.getElementById("staffFocusCard");
    const list = document.getElementById("staffPaymentList");
    if (!card || !list) {
      return;
    }

    const staff = currentStaffMember();
    if (!staff) {
      card.className = "payment-focus empty";
      card.textContent = "Select a staff member to view payroll status and record payments.";
      list.innerHTML = "";
      return;
    }

    card.className = "payment-focus";
    card.innerHTML = `
      <div class="summary-title">${escapeHtml(staff.full_name)}</div>
      <div class="summary-meta">${escapeHtml(staff.role || "Role not set")} · ${escapeHtml(staff.department || "No department")}</div>
      <div class="summary-inline">
        <span>Status <b>${escapeHtml(staff.status || "active")}</b></span>
        <span>Salary <b>${escapeHtml(formatCurrency(staff.salary_amount, staff.salary_currency))}</b></span>
        <span>Last Paid <b>${escapeHtml(formatDate(staff.last_payment_at))}</b></span>
        <span>Next Due <b>${escapeHtml(formatDate(staff.next_payment_due_at))}</b></span>
      </div>
    `;

    list.innerHTML = (staff.payment_history || []).length
      ? staff.payment_history
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

  window.loadStaffSnapshot = async function loadStaffSnapshot(options = {}) {
    const { silent = false } = options;
    const response = await fetch("/api/staff");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load staff data.");
    }
    state.staff.snapshot = payload.data || { staff: [], stats: {} };
    if (state.staff.selectedId && !currentStaffMember()) {
      state.staff.selectedId = null;
    }
    renderStaffList();
    renderStaffFocusCard();
    if (!silent) {
      setStaffStatus("Staff data loaded.");
    }
  };

  window.selectStaffMember = function selectStaffMember(id) {
    state.staff.selectedId = id;
    const staff = currentStaffMember();
    fillStaffForm(staff);
    resetStaffPaymentForm();
    renderStaffList();
    renderStaffFocusCard();
    setStaffStatus(staff ? `Selected ${staff.full_name}.` : "Staff selection cleared.");
  };

  window.resetStaffForm = function resetStaffForm() {
    state.staff.selectedId = null;
    fillStaffForm(null);
    resetStaffPaymentForm();
    renderStaffList();
    renderStaffFocusCard();
  };

  window.saveStaffMemberFromForm = async function saveStaffMemberFromForm() {
    try {
      const response = await fetch("/api/staff/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectStaffPayload()),
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to save the staff member.");
      }
      state.staff.snapshot = payload.data;
      const savedName = document.getElementById("staffName").value || "Staff member";
      const matched = (state.staff.snapshot.staff || []).find((item) => item.full_name === savedName);
      if (matched) {
        state.staff.selectedId = matched.id;
        fillStaffForm(matched);
      }
      renderStaffList();
      renderStaffFocusCard();
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
      const response = await fetch(`/api/staff/${encodeURIComponent(staff.id)}`, { method: "DELETE" });
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
    const staff = currentStaffMember();
    document.getElementById("staffPaymentId").value = "";
    document.getElementById("staffPaymentAmount").value = staff?.salary_amount ?? "";
    document.getElementById("staffPaymentCurrency").value = staff?.salary_currency || "NPR";
    document.getElementById("staffPaymentDate").value = todayString();
    document.getElementById("staffPaymentMethod").value = "";
    document.getElementById("staffPaymentReference").value = "";
    document.getElementById("staffPaymentNotes").value = "";
  };

  window.editStaffPayment = function editStaffPayment(paymentId) {
    const staff = currentStaffMember();
    const payment = (staff?.payment_history || []).find((item) => item.id === paymentId);
    if (!payment) {
      return;
    }
    document.getElementById("staffPaymentId").value = payment.id || "";
    document.getElementById("staffPaymentAmount").value = payment.amount ?? "";
    document.getElementById("staffPaymentCurrency").value = payment.currency || "NPR";
    document.getElementById("staffPaymentDate").value = payment.paid_at ? new Date(payment.paid_at).toISOString().slice(0, 10) : todayString();
    document.getElementById("staffPaymentMethod").value = payment.method || "";
    document.getElementById("staffPaymentReference").value = payment.reference || "";
    document.getElementById("staffPaymentNotes").value = payment.notes || "";
  };

  window.saveStaffPaymentFromForm = async function saveStaffPaymentFromForm() {
    const staff = currentStaffMember();
    if (!staff) {
      toast("⚠️ No Staff", "Select a staff member before saving payroll.", "error");
      return;
    }
    try {
      const response = await fetch(`/api/staff/payment/${encodeURIComponent(staff.id)}`, {
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
      renderStaffList();
      renderStaffFocusCard();
      resetStaffPaymentForm();
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
      const response = await fetch(`/api/staff/payment/${encodeURIComponent(staff.id)}/${encodeURIComponent(paymentId)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to delete the payroll entry.");
      }
      state.staff.snapshot = payload.data;
      renderStaffList();
      renderStaffFocusCard();
      resetStaffPaymentForm();
      setStaffStatus("Payroll entry deleted.");
    } catch (error) {
      toast("❌ Payroll Error", error.message, "error");
      setStaffStatus("Payroll delete failed.");
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("emailSearch")?.addEventListener("input", renderEmailRecipientList);
    document.getElementById("staffSearch")?.addEventListener("input", renderStaffList);
    document.getElementById("staffStatusFilter")?.addEventListener("change", renderStaffList);
    document.getElementById("staffDepartmentFilter")?.addEventListener("input", renderStaffList);
    resetCalendarReminder();
    resetStaffPaymentForm();
  });
})();
