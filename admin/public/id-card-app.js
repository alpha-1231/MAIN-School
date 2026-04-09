(function () {
  const state = window.adminState;
  if (!state) {
    return;
  }

  const ID_CARD_PAGE_SIZE = 8;
  let previewTimer = 0;
  let previewRequestToken = 0;
  state.idcards.photoCrop = normalizeIdCardCrop(state.idcards.photoCrop);

  function defaultIdCardCrop() {
    return {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    };
  }

  function clampCropValue(value, min, max, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  function normalizeIdCardCrop(value) {
    const raw = value && typeof value === "object" ? value : {};
    return {
      zoom: clampCropValue(raw.zoom ?? raw.scale, 1, 2.4, 1),
      offsetX: clampCropValue(raw.offsetX ?? raw.offset_x, -1, 1, 0),
      offsetY: clampCropValue(raw.offsetY ?? raw.offset_y, -1, 1, 0),
    };
  }

  function getCurrentIdCardCrop() {
    state.idcards.photoCrop = normalizeIdCardCrop(state.idcards.photoCrop);
    return state.idcards.photoCrop;
  }

  function syncIdCardCropControls() {
    const crop = getCurrentIdCardCrop();
    const hasPhoto = Boolean(String(state.idcards.photoValue || "").trim());
    const zoom = document.getElementById("idCardPhotoZoom");
    const offsetX = document.getElementById("idCardPhotoOffsetX");
    const offsetY = document.getElementById("idCardPhotoOffsetY");
    const reset = document.getElementById("idCardResetCropBtn");

    if (zoom) {
      zoom.disabled = !hasPhoto;
      zoom.value = String(crop.zoom);
    }
    if (offsetX) {
      offsetX.disabled = !hasPhoto;
      offsetX.value = String(crop.offsetX);
    }
    if (offsetY) {
      offsetY.disabled = !hasPhoto;
      offsetY.value = String(crop.offsetY);
    }
    if (reset) {
      reset.disabled = !hasPhoto;
    }

    const zoomValue = document.getElementById("idCardPhotoZoomValue");
    const offsetXValue = document.getElementById("idCardPhotoOffsetXValue");
    const offsetYValue = document.getElementById("idCardPhotoOffsetYValue");
    if (zoomValue) {
      zoomValue.textContent = `${Math.round(crop.zoom * 100)}%`;
    }
    if (offsetXValue) {
      offsetXValue.textContent = `${Math.round(crop.offsetX * 100)}%`;
    }
    if (offsetYValue) {
      offsetYValue.textContent = `${Math.round(crop.offsetY * 100)}%`;
    }
  }

  function resetIdCardCrop(options = {}) {
    const { silent = false } = options;
    state.idcards.photoCrop = defaultIdCardCrop();
    renderIdCardPhotoPreview();
    if (!silent) {
      scheduleIdCardPreviewRefresh();
      setIdCardStatus("Head photo crop reset.");
    }
  }

  function syncIdCardCropFromControls() {
    state.idcards.photoCrop = normalizeIdCardCrop({
      zoom: document.getElementById("idCardPhotoZoom")?.value,
      offsetX: document.getElementById("idCardPhotoOffsetX")?.value,
      offsetY: document.getElementById("idCardPhotoOffsetY")?.value,
    });
    renderIdCardPhotoPreview();
    scheduleIdCardPreviewRefresh();
  }

  function setIdCardStatus(message) {
    const element = document.getElementById("idCardStatus");
    if (element) {
      element.textContent = message;
    }
  }

  function clampPage(page, totalPages) {
    const safeTotal = Math.max(1, Number.parseInt(totalPages, 10) || 1);
    const nextPage = Number.parseInt(page, 10) || 1;
    return Math.min(safeTotal, Math.max(1, nextPage));
  }

  function buildPageData(items, page, pageSize) {
    const totalItems = Array.isArray(items) ? items.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = clampPage(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    return {
      currentPage,
      totalPages,
      startIndex,
      pageItems: (items || []).slice(startIndex, startIndex + pageSize),
      totalItems,
    };
  }

  function renderPager(containerId, currentPage, totalPages, totalItems, pageSize, onChangeName) {
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

  function getIdCardSummaryMap() {
    return new Map(((state.idcards.snapshot && state.idcards.snapshot.cards) || []).map((item) => [item.slug, item]));
  }

  function formatIdCardStatusLabel(business) {
    const status = getDisplayStatus(business);
    if (status === "expiring") {
      return "Expiring Soon";
    }
    return status ? `${status.slice(0, 1).toUpperCase()}${status.slice(1)}` : "Pending";
  }

  function filteredBusinesses() {
    const search = String(document.getElementById("idCardSearch")?.value || "").trim().toLowerCase();
    const province = String(document.getElementById("idCardProvince")?.value || "");
    const district = String(document.getElementById("idCardDistrict")?.value || "");
    const status = String(document.getElementById("idCardStatusFilter")?.value || "all");
    const summaryMap = getIdCardSummaryMap();

    return state.businesses.filter((business) => {
      if (province && String(business.province || "") !== province) {
        return false;
      }
      if (district && String(business.district || "") !== district) {
        return false;
      }
      if (!matchesStatusFilter(business, status)) {
        return false;
      }
      if (!search) {
        return true;
      }

      const summary = summaryMap.get(business.slug);
      return [
        business.id,
        business.registration_id,
        business.name,
        business.slug,
        business.district,
        business.province_name,
        summary?.registration_id,
        summary?.head_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }

  function renderIdCardStats() {
    const box = document.getElementById("idCardStatsBox");
    if (!box) {
      return;
    }

    const stats = state.idcards.snapshot?.stats || {};
    box.textContent = `${stats.total_cards || 0} saved cards · ${stats.with_head_photo || 0} with head photo · ${stats.total_businesses || state.businesses.length || 0} schools available`;
  }

  function renderIdCardBusinessList() {
    const list = document.getElementById("idCardBusinessList");
    if (!list) {
      return;
    }

    const summaryMap = getIdCardSummaryMap();
    const items = filteredBusinesses();
    const pageData = buildPageData(items, state.idcards.page || 1, ID_CARD_PAGE_SIZE);
    state.idcards.page = pageData.currentPage;
    list.innerHTML = items.length
      ? pageData.pageItems
          .map((business) => {
            const summary = summaryMap.get(business.slug);
            const paymentStatus = formatIdCardStatusLabel(business);
            const registrationId = summary?.registration_id || business.registration_id || business.id || "ID not generated yet";
            return `
              <button type="button" class="idcards-business-item ${business.slug === state.idcards.selectedSlug ? "active" : ""}" onclick="selectIdCardBusiness('${escapeHtml(business.slug)}')">
                <div class="idcards-business-title">${escapeHtml(business.name || business.slug)}</div>
                <div class="idcards-business-meta">${escapeHtml(business.location_full_label || business.location_label || "No location")} · ${escapeHtml(paymentStatus)}</div>
                <div class="idcards-business-copy">${escapeHtml(registrationId)}</div>
                <div class="gen-badge-row compact">
                  <span class="gen-badge ${summary?.has_card ? "web-ready" : "not-ready"}">${summary?.has_card ? "Card ready" : "New card"}</span>
                  <span class="gen-badge ${summary?.has_head_photo ? "apk-ready" : "not-ready"}">${summary?.has_head_photo ? "Head photo" : "No photo"}</span>
                </div>
              </button>
            `;
          })
          .join("")
      : `<div class="empty-state">No schools matched the current filters.</div>`;

    renderPager("idCardPager", pageData.currentPage, pageData.totalPages, items.length, ID_CARD_PAGE_SIZE, "changeIdCardPage");
    renderIdCardStats();
  }

  function setIdCardModePill(label) {
    const pill = document.getElementById("idCardModePill");
    if (pill) {
      pill.textContent = label;
    }
  }

  function renderIdCardPhotoPreview() {
    const preview = document.getElementById("idCardPhotoPreview");
    if (!preview) {
      return;
    }

    const photo = String(state.idcards.photoValue || "").trim();
    const crop = getCurrentIdCardCrop();
    preview.innerHTML = photo
      ? `
          <div class="idcard-photo-preview-frame">
            <img
              src="${escapeHtml(photo)}"
              alt="Head photo preview"
              style="--idcard-crop-zoom:${crop.zoom.toFixed(2)}; --idcard-crop-x:${(crop.offsetX * 18).toFixed(2)}%; --idcard-crop-y:${(crop.offsetY * 18).toFixed(2)}%;"
            >
          </div>
        `
      : "Head photo preview will appear here.";
    syncIdCardCropControls();
  }

  function buildIdCardFormPayload() {
    const slug = document.getElementById("idCardBusinessSlug")?.value || state.idcards.selectedSlug || "";
    const business = state.businesses.find((item) => item.slug === slug) || null;
    const photoFromUrl = String(document.getElementById("idCardHeadPhotoUrl")?.value || "").trim();
    const crop = getCurrentIdCardCrop();
    return {
      slug,
      registration_id:
        document.getElementById("idCardRegistrationId")?.value ||
        state.idcards.detail?.card?.registration_id ||
        business?.registration_id ||
        business?.id ||
        "",
      issue_date: document.getElementById("idCardIssueDate")?.value || todayString(),
      head_name: document.getElementById("idCardHeadName")?.value || "",
      head_title: document.getElementById("idCardHeadTitle")?.value || "",
      head_photo: state.idcards.photoValue || photoFromUrl,
      head_photo_crop: {
        zoom: crop.zoom,
        offset_x: crop.offsetX,
        offset_y: crop.offsetY,
      },
      notes: "",
    };
  }

  function renderIdCardDetail(detail, options = {}) {
    const { syncForm = true } = options;
    const preview = document.getElementById("idCardPreview");
    const statusBox = document.getElementById("idCardStatusBox");
    if (!preview || !statusBox) {
      return;
    }

    if (!detail) {
      document.getElementById("idCardBusinessSlug").value = "";
      document.getElementById("idCardRegistrationId").value = "";
      document.getElementById("idCardIssueDate").value = todayString();
      document.getElementById("idCardHeadName").value = "";
      document.getElementById("idCardHeadTitle").value = "";
      document.getElementById("idCardHeadPhotoUrl").value = "";
      document.getElementById("idCardHeadPhotoFile").value = "";
      state.idcards.photoValue = "";
      state.idcards.photoCrop = defaultIdCardCrop();
      renderIdCardPhotoPreview();
      preview.textContent = "Select a school to preview its printable registration card.";
      statusBox.textContent = "Select a school to create or edit its registration card.";
      setIdCardModePill("READY");
      return;
    }

    document.getElementById("idCardBusinessSlug").value = detail.business?.slug || "";
    document.getElementById("idCardRegistrationId").value =
      detail.card?.registration_id || detail.business?.registration_id || detail.business?.id || "";
    if (syncForm) {
      document.getElementById("idCardIssueDate").value = detail.card?.issue_date ? new Date(detail.card.issue_date).toISOString().slice(0, 10) : todayString();
      document.getElementById("idCardHeadName").value = detail.card?.head_name || "";
      document.getElementById("idCardHeadTitle").value = detail.card?.head_title || "";
      document.getElementById("idCardHeadPhotoUrl").value =
        detail.card?.head_photo && !String(detail.card.head_photo).startsWith("data:image/")
          ? detail.card.head_photo
          : "";
      document.getElementById("idCardHeadPhotoFile").value = "";
      state.idcards.photoValue = detail.card?.head_photo || "";
      state.idcards.photoCrop = normalizeIdCardCrop(detail.card?.head_photo_crop);
      renderIdCardPhotoPreview();
    }
    preview.innerHTML = detail.svg || "Unable to render the ID card preview.";
    statusBox.textContent = `${detail.business?.name || "School"} · ${detail.card?.registration_id || "ID pending"} · card ready for download or email.`;
    setIdCardModePill(detail.card?.head_photo ? "PHOTO READY" : "CARD READY");
  }

  async function refreshIdCardSnapshotOnly() {
    const response = await adminFetch("/api/id-cards");
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load ID card records.");
    }
    state.idcards.snapshot = payload.data || { cards: [], stats: {} };
    renderIdCardBusinessList();
  }

  async function loadIdCardDetail(slug, options = {}) {
    if (!slug) {
      renderIdCardDetail(null);
      return null;
    }

    const response = await adminFetch(`/api/id-cards/${encodeURIComponent(slug)}`);
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || "Unable to load the ID card.");
    }

    state.idcards.selectedSlug = slug;
    state.idcards.detail = payload.data || null;
    renderIdCardBusinessList();
    renderIdCardDetail(state.idcards.detail);
    if (!options.silent) {
      setIdCardStatus(`Loaded registration card for ${state.idcards.detail?.business?.name || slug}.`);
    }
    return state.idcards.detail;
  }

  async function refreshIdCardPreviewFromForm(options = {}) {
    const { silent = false } = options;
    const payload = buildIdCardFormPayload();
    if (!payload.slug) {
      return null;
    }

    const requestToken = ++previewRequestToken;
    const response = await adminFetch("/api/id-cards/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Unable to render the ID card preview.");
    }
    if (requestToken !== previewRequestToken) {
      return null;
    }

    state.idcards.detail = result.data || null;
    renderIdCardDetail(state.idcards.detail, { syncForm: false });
    if (!silent) {
      setIdCardStatus("Live card preview updated.");
    }
    return state.idcards.detail;
  }

  function scheduleIdCardPreviewRefresh() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      void refreshIdCardPreviewFromForm({ silent: true }).catch(() => {
        // Ignore transient preview failures while the user is editing.
      });
    }, 120);
  }

  window.loadIdCardApp = async function loadIdCardApp(options = {}) {
    const { silent = false, loading } = options;
    if (!state.businesses.length) {
      await refreshDirectory({ reloadReport: false, reloadPaymentRecord: false, loading });
    }

    populateProvinceSelect("idCardProvince", "All provinces");
    populateDistrictSelect(
      "idCardDistrict",
      document.getElementById("idCardProvince")?.value || "",
      "",
      document.getElementById("idCardDistrict")?.value || "",
      "All districts",
      state.businesses
    );

    await refreshIdCardSnapshotOnly();
    const preferredSlug = state.idcards.selectedSlug || state.selectedSlug || state.paymentSlug || "";
    if (preferredSlug) {
      try {
        await loadIdCardDetail(preferredSlug, { silent: true });
      } catch {
        state.idcards.selectedSlug = null;
        state.idcards.detail = null;
        renderIdCardDetail(null);
      }
    } else {
      renderIdCardDetail(null);
    }
    if (!silent) {
      setIdCardStatus("ID Card Manager loaded.");
    }
  };

  window.selectIdCardBusiness = function selectIdCardBusiness(slug) {
    void loadIdCardDetail(slug);
  };

  window.changeIdCardPage = function changeIdCardPage(delta) {
    const totalPages = Math.max(1, Math.ceil(filteredBusinesses().length / ID_CARD_PAGE_SIZE));
    const nextPage = clampPage((state.idcards.page || 1) + delta, totalPages);
    if (nextPage === state.idcards.page) {
      return;
    }
    state.idcards.page = nextPage;
    renderIdCardBusinessList();
  };

  window.clearIdCardPhoto = function clearIdCardPhoto() {
    state.idcards.photoValue = "";
    state.idcards.photoCrop = defaultIdCardCrop();
    document.getElementById("idCardHeadPhotoUrl").value = "";
    document.getElementById("idCardHeadPhotoFile").value = "";
    renderIdCardPhotoPreview();
    scheduleIdCardPreviewRefresh();
    setIdCardStatus("Head photo cleared from the current draft.");
  };

  window.saveCurrentIdCard = async function saveCurrentIdCard() {
    const payload = buildIdCardFormPayload();
    const slug = payload.slug;
    if (!slug) {
      toast("⚠️ No School", "Select a school before saving the registration card.", "error");
      return;
    }

    try {
      const response = await adminFetch("/api/id-cards/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Unable to save the registration card.");
      }

      state.idcards.detail = result.data || null;
      state.idcards.selectedSlug = slug;
      state.idcards.photoValue = state.idcards.detail?.card?.head_photo || "";
      await refreshIdCardSnapshotOnly();
      renderIdCardDetail(state.idcards.detail);
      setIdCardStatus("Registration card saved.");
      toast("✅ ID Card Saved", "The printable registration card was saved.", "success");
    } catch (error) {
      setIdCardStatus("ID card save failed.");
      toast("❌ ID Card Error", error.message, "error");
    }
  };

  window.downloadCurrentIdCard = function downloadCurrentIdCard() {
    const slug = document.getElementById("idCardBusinessSlug")?.value || state.idcards.selectedSlug || "";
    if (!slug) {
      toast("⚠️ No School", "Select a school before downloading the registration card.", "error");
      return;
    }
    window.open(`/api/id-cards/${encodeURIComponent(slug)}/download?download=1&format=pdf`, "_blank");
    setIdCardStatus("Registration card PDF download opened.");
  };

  window.sendCurrentIdCard = async function sendCurrentIdCard() {
    const slug = document.getElementById("idCardBusinessSlug")?.value || state.idcards.selectedSlug || "";
    if (!slug) {
      toast("⚠️ No School", "Select a school before emailing the registration card.", "error");
      return;
    }

    try {
      const response = await adminFetch(`/api/id-cards/${encodeURIComponent(slug)}/send`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || "Unable to email the registration card.");
      }

      const status = payload.data?.status || "sent";
      if (status === "sent") {
        toast("✅ ID Card Emailed", `The registration card was sent to ${payload.data.email}.`, "success");
        setIdCardStatus("Registration card email sent.");
        return;
      }
      toast("⚠️ ID Card Email", payload.data?.reason || "The ID card email was skipped.", "error");
      setIdCardStatus(payload.data?.reason || "ID card email skipped.");
    } catch (error) {
      toast("❌ ID Card Error", error.message, "error");
      setIdCardStatus("ID card email failed.");
    }
  };

  function syncPhotoValueFromUrl() {
    const url = String(document.getElementById("idCardHeadPhotoUrl")?.value || "").trim();
    const previous = String(state.idcards.photoValue || "").trim();
    state.idcards.photoValue = url;
    if (url !== previous) {
      state.idcards.photoCrop = defaultIdCardCrop();
    }
    renderIdCardPhotoPreview();
    scheduleIdCardPreviewRefresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("idCardSearch")?.addEventListener("input", () => {
      state.idcards.page = 1;
      renderIdCardBusinessList();
    });
    document.getElementById("idCardProvince")?.addEventListener("change", (event) => {
      state.idcards.page = 1;
      populateDistrictSelect("idCardDistrict", event.target.value, "", "", "All districts", state.businesses);
      renderIdCardBusinessList();
    });
    document.getElementById("idCardDistrict")?.addEventListener("change", () => {
      state.idcards.page = 1;
      renderIdCardBusinessList();
    });
    document.getElementById("idCardStatusFilter")?.addEventListener("change", () => {
      state.idcards.page = 1;
      renderIdCardBusinessList();
    });
    ["idCardIssueDate", "idCardHeadName", "idCardHeadTitle"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", scheduleIdCardPreviewRefresh);
      document.getElementById(id)?.addEventListener("change", scheduleIdCardPreviewRefresh);
    });
    document.getElementById("idCardHeadPhotoUrl")?.addEventListener("input", syncPhotoValueFromUrl);
    ["idCardPhotoZoom", "idCardPhotoOffsetX", "idCardPhotoOffsetY"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", syncIdCardCropFromControls);
      document.getElementById(id)?.addEventListener("change", syncIdCardCropFromControls);
    });
    document.getElementById("idCardResetCropBtn")?.addEventListener("click", () => resetIdCardCrop());
    document.getElementById("idCardHeadPhotoFile")?.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast("⚠️ Image Too Large", "Use a head photo under 2 MB for the registration card.", "error");
        event.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.idcards.photoValue = typeof reader.result === "string" ? reader.result : "";
        state.idcards.photoCrop = defaultIdCardCrop();
        document.getElementById("idCardHeadPhotoUrl").value = "";
        renderIdCardPhotoPreview();
        scheduleIdCardPreviewRefresh();
        setIdCardStatus("Head photo loaded into the current card draft.");
      };
      reader.readAsDataURL(file);
    });
    renderIdCardDetail(null);
    syncIdCardCropControls();
  });
})();
