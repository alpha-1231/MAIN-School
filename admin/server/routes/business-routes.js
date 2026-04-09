"use strict";

function registerBusinessRoutes(app, deps) {
  const {
    canAccessPrivateAdmin,
    denyPrivateAdminRequest,
    getAdminDirectoryList,
    getPublicDirectoryList,
    getPublicDirectoryMeta,
    sanitizeSlug,
    basicCardsBySlug,
    readLegacyBasicCard,
    readDetailedRecord,
    attachGenerationStatus,
    decorateRecord,
    mergeBusinessRecords,
    isPublicRecordVisible,
    toPublicRecord,
    PLAN_CATALOG,
    buildLocationCatalogSnapshot,
    stringOrDefault,
    loadPaymentHistory,
    buildSubscriptionFromSave,
    buildPaymentHistory,
    buildBasicCard,
    cleanStringArray,
    normalizeFloat,
    normalizeInteger,
    writeDetailedRecord,
    savePaymentHistory,
    saveBasicCard,
    removeIfExists,
    filePathFor,
    BASIC_DIR,
    removeDetailedRecord,
    removePaymentHistory,
    invalidateRevenueCache,
    sendBusinessRegistrationEmail,
    sendBusinessPaymentStatusEmail,
    normalizeDateInput,
    DEFAULT_SUBSCRIPTION_PLAN,
    getRenewalStart,
    getPlanExpiryDate,
    stripSubscriptionForStorage,
    hydrateStoredSubscription,
    getDefaultPlanAmount,
    DEFAULT_SUBSCRIPTION_CURRENCY,
    sanitizePaymentRecord,
    generateId,
    upsertPaymentHistory,
    deriveSubscriptionFromPaymentHistory,
    removeBasicCard,
  } = deps;

  // Session + directory browsing routes.
  app.get("/api/admin/session", (req, res) => {
    if (!canAccessPrivateAdmin(req)) {
      return denyPrivateAdminRequest(req, res);
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      authenticated: true,
      password_required: false,
    });
  });

  app.get("/api/list", (req, res) => {
    try {
      res.json({
        success: true,
        data: getAdminDirectoryList(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/public/list", (req, res) => {
    try {
      const list = getPublicDirectoryList();
      res.json({
        success: true,
        data: list,
        meta: getPublicDirectoryMeta(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/public/meta", (req, res) => {
    try {
      res.json({
        success: true,
        data: getPublicDirectoryMeta(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/get/:slug", (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug) || {};
      const detailed = readDetailedRecord(slug);

      if (!detailed && !basic.slug) {
        return res.status(404).json({ success: false, error: "Not found" });
      }

      res.json({
        success: true,
        data: attachGenerationStatus(
          decorateRecord(mergeBusinessRecords(basic, detailed || {}), {
            includePaymentHistory: true,
            includePaymentReferenceInSearch: true,
          })
        ),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/public/get/:slug", (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug) || {};
      const detailed = readDetailedRecord(slug);

      if (!detailed && !basic.slug) {
        return res.status(404).json({ success: false, error: "Not found" });
      }

      const record = decorateRecord(mergeBusinessRecords(basic, detailed || {}), {
        includePaymentHistory: false,
        includePaymentReferenceInSearch: false,
      });
      if (!isPublicRecordVisible(record)) {
        return res.status(404).json({ success: false, error: "Not found" });
      }

      res.json({
        success: true,
        data: toPublicRecord(record),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/meta/plans", (req, res) => {
    res.json({
      success: true,
      data: PLAN_CATALOG,
    });
  });

  app.get("/api/meta/locations", (req, res) => {
    res.json({
      success: true,
      data: buildLocationCatalogSnapshot(),
    });
  });

  // Business save + renewal routes.
  app.post("/api/save", async (req, res) => {
    try {
      const payload = req.body || {};
      const name = stringOrDefault(payload.name);
      const slug = sanitizeSlug(payload.slug);
      const originalSlug = sanitizeSlug(payload.original_slug || payload.slug);

      if (!name || !slug) {
        return res.status(400).json({ success: false, error: "name and slug are required" });
      }

      const sourceSlug = originalSlug || slug;
      const existingBasic =
        basicCardsBySlug.get(sourceSlug) ||
        readLegacyBasicCard(sourceSlug) ||
        basicCardsBySlug.get(slug) ||
        readLegacyBasicCard(slug) ||
        {};
      const existingDetailed = readDetailedRecord(sourceSlug) || readDetailedRecord(slug) || {};
      const isNewBusiness = !existingBasic?.slug && !existingDetailed?.slug;

      if (sourceSlug !== slug) {
        const conflictingCard = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug);
        const conflictingDetailed = readDetailedRecord(slug);
        const currentId = existingBasic.id || existingDetailed.id || "";
        const conflictingId = conflictingCard?.id || conflictingDetailed?.id || "";

        if (conflictingId && conflictingId !== currentId) {
          return res.status(409).json({
            success: false,
            error: `A business with slug "${slug}" already exists.`,
          });
        }
      }

      const now = new Date().toISOString();
      const existingSubscription = existingDetailed.subscription || existingBasic.subscription || {};
      const existingPaymentHistory = loadPaymentHistory(
        sourceSlug || slug,
        existingDetailed.payment_history || []
      );
      const subscription = buildSubscriptionFromSave(payload.subscription, existingSubscription, now);
      const paymentHistory = buildPaymentHistory(
        existingPaymentHistory,
        subscription,
        existingSubscription,
        payload.subscription
      );
      const basic = buildBasicCard(payload, existingBasic, existingDetailed, subscription, now);
      const existingMedia = existingDetailed.media || {};
      const incomingMedia = payload.media || {};

      const detailed = {
        ...basic,
        description: stringOrDefault(payload.description),
        contact: {
          address: stringOrDefault(payload.contact?.address),
          phone: cleanStringArray(payload.contact?.phone),
          email: stringOrDefault(payload.contact?.email),
          website: stringOrDefault(payload.contact?.website),
          map: {
            lat: normalizeFloat(payload.contact?.map?.lat),
            lng: normalizeFloat(payload.contact?.map?.lng),
          },
        },
        stats: {
          students: normalizeInteger(payload.stats?.students),
          faculty: normalizeInteger(payload.stats?.faculty),
          rating: normalizeFloat(payload.stats?.rating),
          programs_count:
            normalizeInteger(payload.stats?.programs_count) ??
            (cleanStringArray(payload.programs).length || null),
        },
        media: {
          logo: basic.logo,
          cover: basic.cover,
          gallery: cleanStringArray(
            Array.isArray(incomingMedia.gallery) ? incomingMedia.gallery : existingMedia.gallery
          ),
          videos: cleanStringArray(
            Array.isArray(incomingMedia.videos) ? incomingMedia.videos : existingMedia.videos
          ),
        },
        facilities: cleanStringArray(payload.facilities),
        social: {
          facebook: stringOrDefault(payload.social?.facebook),
          instagram: stringOrDefault(payload.social?.instagram),
          youtube: stringOrDefault(payload.social?.youtube),
          twitter: stringOrDefault(payload.social?.twitter),
        },
      };

      writeDetailedRecord(slug, detailed);
      savePaymentHistory(slug, paymentHistory);
      saveBasicCard(basic, sourceSlug);

      removeIfExists(filePathFor(BASIC_DIR, slug));
      if (sourceSlug && sourceSlug !== slug) {
        removeDetailedRecord(sourceSlug);
        removeIfExists(filePathFor(BASIC_DIR, sourceSlug));
        removePaymentHistory(sourceSlug);
      }
      invalidateRevenueCache();

      const decoratedDetailed = decorateRecord(detailed, {
        includePaymentHistory: true,
        includePaymentReferenceInSearch: true,
      });
      const shouldSendRegistrationEmail =
        isNewBusiness &&
        !["0", "false", "off", "no"].includes(
          String(payload.send_registration_email ?? "true").trim().toLowerCase()
        );
      const emailDelivery = shouldSendRegistrationEmail
        ? await sendBusinessRegistrationEmail(attachGenerationStatus(decoratedDetailed), {
            is_new_business: true,
          })
        : isNewBusiness
          ? {
              status: "skipped",
              reason: "Registration email confirmation was not selected.",
            }
        : null;

      res.json({
        success: true,
        slug,
        basic: decorateRecord(basic, {
          includePaymentHistory: false,
          includePaymentReferenceInSearch: true,
        }),
        detailed: decoratedDetailed,
        email_delivery: emailDelivery,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/payment/:slug", async (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      const basic = basicCardsBySlug.get(slug) || readLegacyBasicCard(slug) || {};
      const detailed = readDetailedRecord(slug);

      if (!detailed && !basic.slug) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      const current = mergeBusinessRecords(basic, detailed || {});
      const existingSubscription = current.subscription || {};
      const previousStatus = stringOrDefault(existingSubscription.payment_status, "pending").toLowerCase();
      const existingPaymentHistory = loadPaymentHistory(slug, current.payment_history);
      const paymentPayload = req.body || {};
      const editingPaymentId = stringOrDefault(paymentPayload.id);
      const editingPayment =
        existingPaymentHistory.find((entry) => entry.id === editingPaymentId) || null;
      const paymentDate = normalizeDateInput(paymentPayload.paid_at) || new Date();
      const resolvedPlan = stringOrDefault(
        paymentPayload.plan,
        editingPayment?.plan || existingSubscription.plan || DEFAULT_SUBSCRIPTION_PLAN
      );
      const cycleStart = editingPayment
        ? normalizeDateInput(paymentPayload.starts_at || editingPayment.starts_at) ||
          normalizeDateInput(editingPayment.paid_at) ||
          paymentDate
        : getRenewalStart(existingSubscription.expires_at, paymentDate);
      const expiresAt =
        normalizeDateInput(paymentPayload.expires_at) ||
        getPlanExpiryDate(cycleStart, resolvedPlan);
      const renewed = stripSubscriptionForStorage({
        ...hydrateStoredSubscription(existingSubscription),
        plan: resolvedPlan,
        amount:
          normalizeFloat(paymentPayload.amount) ??
          normalizeFloat(editingPayment?.amount) ??
          (editingPayment ? normalizeFloat(existingSubscription.amount) : null) ??
          getDefaultPlanAmount(resolvedPlan),
        currency: stringOrDefault(
          paymentPayload.currency,
          editingPayment?.currency || existingSubscription.currency || DEFAULT_SUBSCRIPTION_CURRENCY
        ),
        payment_method: stringOrDefault(
          paymentPayload.payment_method,
          editingPayment?.payment_method || existingSubscription.payment_method || ""
        ),
        payment_reference: stringOrDefault(
          paymentPayload.payment_reference,
          editingPayment?.payment_reference || ""
        ),
        notes: stringOrDefault(
          paymentPayload.notes,
          editingPayment?.notes || existingSubscription.notes || ""
        ),
        auto_renew: Boolean(paymentPayload.auto_renew ?? existingSubscription.auto_renew),
        paid_at: paymentDate.toISOString(),
        starts_at: cycleStart.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_status: expiresAt.getTime() > Date.now() ? "active" : "expired",
        last_updated_at: new Date().toISOString(),
      });

      const historyEntry = sanitizePaymentRecord(
        {
          id: editingPaymentId || generateId(),
          slug,
          plan: renewed.plan,
          amount: renewed.amount,
          currency: renewed.currency,
          paid_at: renewed.paid_at,
          starts_at: renewed.starts_at,
          expires_at: renewed.expires_at,
          payment_method: renewed.payment_method,
          payment_reference: renewed.payment_reference,
          notes: renewed.notes,
          created_at: editingPayment?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        slug
      );
      const nextPaymentHistory = upsertPaymentHistory(existingPaymentHistory, historyEntry);
      const effectiveSubscription = editingPayment
        ? deriveSubscriptionFromPaymentHistory(nextPaymentHistory, existingSubscription)
        : renewed;

      const updatedAt = new Date().toISOString();
      const nextBasic = buildBasicCard(
        {
          ...current,
          subscription: effectiveSubscription,
          updated_at: updatedAt,
        },
        basic,
        detailed || {},
        effectiveSubscription,
        updatedAt
      );
      const nextDetailed = {
        ...current,
        ...nextBasic,
        subscription: effectiveSubscription,
        updated_at: updatedAt,
        media: {
          logo: nextBasic.logo,
          cover: nextBasic.cover,
          gallery: cleanStringArray(current.media?.gallery),
          videos: cleanStringArray(current.media?.videos),
        },
      };

      writeDetailedRecord(slug, nextDetailed);
      savePaymentHistory(slug, nextPaymentHistory);
      saveBasicCard(nextBasic);
      removeIfExists(filePathFor(BASIC_DIR, slug));
      invalidateRevenueCache();

      const decoratedDetailed = decorateRecord(nextDetailed, {
        includePaymentHistory: true,
        includePaymentReferenceInSearch: true,
      });
      const nextStatus = stringOrDefault(effectiveSubscription.payment_status, "pending").toLowerCase();
      let paymentEmailDelivery = null;
      if (nextStatus !== previousStatus && (nextStatus === "active" || nextStatus === "expired")) {
        paymentEmailDelivery = await sendBusinessPaymentStatusEmail(
          attachGenerationStatus(decoratedDetailed),
          nextStatus === "active" ? "reactivated" : "expired"
        );
      }

      res.json({
        success: true,
        data: decoratedDetailed,
        payment_email_delivery: paymentEmailDelivery,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/delete/:slug", (req, res) => {
    try {
      const slug = sanitizeSlug(req.params.slug);
      removeBasicCard(slug);
      removeDetailedRecord(slug);
      removeIfExists(filePathFor(BASIC_DIR, slug));
      removePaymentHistory(slug);
      invalidateRevenueCache();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = {
  registerBusinessRoutes,
};
