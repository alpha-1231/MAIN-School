"use strict";

function registerToolRoutes(app, deps) {
  const {
    loadNotes,
    saveNotes,
    stringOrDefault,
    generateId,
    buildSourceSnapshot,
    getSourceRepoConfig,
    getSourceBranchName,
    executeSourceWorkflow,
    stageSourceRepoChanges,
    buildDbSnapshot,
    mirrorBusinessDataToDbRepo,
    getDbRepoConfig,
    getDbBranchName,
    executeDbWorkflow,
    pushRepoWithLease,
    getDbRepoRoot,
    getGeneratorBusinessContext,
    generatorStudio,
    respondApiError,
    buildStaffSnapshot,
    saveStaffMember,
    removeStaffMember,
    saveStaffPaymentRecord,
    deleteStaffPaymentRecord,
    saveStaffAdjustmentRecord,
    deleteStaffAdjustmentRecord,
    buildStaffStatementDetails,
    buildStaffStatementPdfBuffer,
    buildCalendarSnapshot,
    saveCalendarEvent,
    removeCalendarEvent,
    buildEmailSnapshot,
    sendBusinessEmailCampaign,
    buildIdCardSnapshot,
    buildIdCardPreview,
    getBusinessIdCardDetails,
    buildBusinessIdCardPdfBuffer,
    saveBusinessIdCard,
    sendBusinessIdCardEmail,
    canAccessPrivateAdmin,
    scheduleAdminShutdown,
    buildEnvConfigSnapshot,
    saveEnvConfigSnapshot,
  } = deps;

  // Notes routes.
  app.get("/api/notes", (req, res) => {
    try {
      const notes = loadNotes().sort((left, right) => right.updated_at.localeCompare(left.updated_at));
      res.json({ success: true, data: notes });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/notes", (req, res) => {
    try {
      const payload = req.body || {};
      const title = stringOrDefault(payload.title, "Untitled note");
      const content = String(payload.content ?? "");
      if (!title && !content.trim()) {
        return res.status(400).json({ success: false, error: "A note needs a title or content." });
      }

      const notes = loadNotes();
      const noteId = stringOrDefault(payload.id) || generateId();
      const existing = notes.find((note) => note.id === noteId);
      const now = new Date().toISOString();
      const nextNote = {
        id: noteId,
        title,
        content,
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      const nextNotes = notes.filter((note) => note.id !== noteId);
      nextNotes.push(nextNote);
      saveNotes(nextNotes);

      res.json({ success: true, data: nextNote });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/notes/:id", (req, res) => {
    try {
      const noteId = stringOrDefault(req.params.id);
      const notes = loadNotes();
      const nextNotes = notes.filter((note) => note.id !== noteId);
      saveNotes(nextNotes);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Source repository routes.
  app.get("/api/source/status", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildSourceSnapshot(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/source/pull", (req, res) => {
    try {
      const sourceConfig = getSourceRepoConfig();
      const branch = getSourceBranchName();
      const snapshot = executeSourceWorkflow([
        {
          args: ["pull", "--rebase", sourceConfig.remoteName, branch],
          summary: `Pulled latest changes from ${sourceConfig.remoteName}/${branch}.`,
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/source/stage", (req, res) => {
    try {
      const snapshot = executeSourceWorkflow([{ run: () => stageSourceRepoChanges() }]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/source/commit", (req, res) => {
    try {
      const message = stringOrDefault(req.body?.message);
      if (!message) {
        return res.status(400).json({ success: false, error: "A commit message is required." });
      }

      const snapshot = executeSourceWorkflow([
        {
          args: ["commit", "-m", message],
          summary: "Commit created.",
          allowNoop: true,
          noopSummary: "No staged changes were available to commit.",
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/source/push", (req, res) => {
    try {
      const sourceConfig = getSourceRepoConfig();
      const branch = getSourceBranchName();
      const snapshot = executeSourceWorkflow([
        {
          args: ["push", sourceConfig.remoteName, `HEAD:${branch}`],
          summary: `Changes were pushed to ${sourceConfig.remoteName}/${branch}.`,
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/source/publish", (req, res) => {
    try {
      const message = stringOrDefault(req.body?.message);
      if (!message) {
        return res.status(400).json({ success: false, error: "A commit message is required." });
      }

      const sourceConfig = getSourceRepoConfig();
      const branch = getSourceBranchName();
      const snapshot = executeSourceWorkflow([
        { run: () => stageSourceRepoChanges() },
        {
          args: ["commit", "-m", message],
          summary: "Commit created.",
          allowNoop: true,
          noopSummary: "No staged changes were available to commit.",
        },
        {
          args: ["pull", "--rebase", sourceConfig.remoteName, branch],
          summary: `Pulled latest changes from ${sourceConfig.remoteName}/${branch}.`,
        },
        {
          args: ["push", sourceConfig.remoteName, `HEAD:${branch}`],
          summary: `Changes were pushed to ${sourceConfig.remoteName}/${branch}.`,
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DB mirror routes.
  app.get("/api/db/status", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildDbSnapshot(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/mirror", (req, res) => {
    try {
      const mirrored = mirrorBusinessDataToDbRepo();
      res.json({
        success: true,
        data: buildDbSnapshot({
          output: mirrored.log,
          summary: mirrored.summary,
        }),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/pull", (req, res) => {
    try {
      const dbConfig = getDbRepoConfig();
      const branch = getDbBranchName();
      const snapshot = executeDbWorkflow([
        {
          args: ["pull", "--rebase", dbConfig.remoteName, branch],
          summary: `Pulled latest data changes from ${dbConfig.remoteName}/${branch}.`,
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/stage", (req, res) => {
    try {
      const snapshot = executeDbWorkflow([
        { args: ["add", "-A"], summary: "All DB repository changes were staged." },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/commit", (req, res) => {
    try {
      const message = stringOrDefault(req.body?.message);
      if (!message) {
        return res.status(400).json({ success: false, error: "A commit message is required." });
      }

      const snapshot = executeDbWorkflow([
        {
          args: ["commit", "-m", message],
          summary: "DB repository commit created.",
          allowNoop: true,
          noopSummary: "No staged DB changes were available to commit.",
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/push", (req, res) => {
    try {
      const dbConfig = getDbRepoConfig();
      const branch = getDbBranchName();
      const snapshot = executeDbWorkflow([
        {
          run: () =>
            pushRepoWithLease(
              getDbRepoRoot(),
              dbConfig.remoteName,
              branch,
              `DB changes were pushed to ${dbConfig.remoteName}/${branch}.`
            ),
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/publish", (req, res) => {
    try {
      const message = stringOrDefault(req.body?.message);
      if (!message) {
        return res.status(400).json({ success: false, error: "A commit message is required." });
      }

      const dbConfig = getDbRepoConfig();
      const branch = getDbBranchName();
      const snapshot = executeDbWorkflow([
        { run: () => mirrorBusinessDataToDbRepo() },
        { args: ["add", "-A"], summary: "All DB repository changes were staged." },
        {
          args: ["commit", "-m", message],
          summary: "DB repository commit created.",
          allowNoop: true,
          noopSummary: "No staged DB changes were available to commit.",
        },
        {
          run: () =>
            pushRepoWithLease(
              getDbRepoRoot(),
              dbConfig.remoteName,
              branch,
              `DB changes were pushed to ${dbConfig.remoteName}/${branch}.`
            ),
        },
      ]);
      res.json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Generator Studio routes.
  app.get("/api/generator/business/:slug", (req, res) => {
    try {
      const context = getGeneratorBusinessContext(req.params.slug);
      if (!context) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      res.json({
        success: true,
        data: generatorStudio.loadBusinessStudio(context.record),
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  app.post("/api/generator/save", (req, res) => {
    try {
      const context = getGeneratorBusinessContext(req.body?.slug);
      if (!context) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      res.json({
        success: true,
        data: generatorStudio.saveBusinessStudio(context.record, req.body || {}),
        message: "Generator Studio data saved.",
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  app.post("/api/generator/build/website", (req, res) => {
    try {
      const context = getGeneratorBusinessContext(req.body?.slug);
      if (!context) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      res.json({
        success: true,
        data: generatorStudio.buildWebsite(context.record, req.body || {}),
        message: "Website generated successfully.",
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  app.post("/api/generator/build/app", (req, res) => {
    try {
      const context = getGeneratorBusinessContext(req.body?.slug);
      if (!context) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      const result = generatorStudio.buildApp(context.record, req.body || {});
      if (!result.flutter?.success) {
        return res.status(500).json({
          success: false,
          error: result.flutter?.message || "Flutter build failed.",
          data: result,
        });
      }

      return res.json({
        success: true,
        data: result,
        message: "Flutter app built successfully.",
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  app.delete("/api/generator/business/:slug/studio-data", (req, res) => {
    try {
      const context = getGeneratorBusinessContext(req.params.slug);
      if (!context) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      res.json({
        success: true,
        data: generatorStudio.deleteStudioData(context.record),
        message: "Generator Studio data deleted.",
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  app.delete("/api/generator/business/:slug/website-output", (req, res) => {
    try {
      const context = getGeneratorBusinessContext(req.params.slug);
      if (!context) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      res.json({
        success: true,
        data: generatorStudio.deleteWebsiteOutput(context.record),
        message: "Website output deleted.",
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  app.delete("/api/generator/business/:slug/app-output", (req, res) => {
    try {
      const context = getGeneratorBusinessContext(req.params.slug);
      if (!context) {
        return res.status(404).json({ success: false, error: "Business not found" });
      }

      res.json({
        success: true,
        data: generatorStudio.deleteAppOutput(context.record),
        message: "App output deleted.",
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  // Staff + payroll routes.
  app.get("/api/staff", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildStaffSnapshot(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/staff/save", (req, res) => {
    try {
      res.json({
        success: true,
        data: saveStaffMember(req.body || {}),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/staff/:id", (req, res) => {
    try {
      res.json({
        success: true,
        data: removeStaffMember(req.params.id),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post("/api/staff/payment/:id", (req, res) => {
    try {
      res.json({
        success: true,
        data: saveStaffPaymentRecord(req.params.id, req.body || {}),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/staff/payment/:id/:paymentId", (req, res) => {
    try {
      res.json({
        success: true,
        data: deleteStaffPaymentRecord(req.params.id, req.params.paymentId),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post("/api/staff/adjustment/:id", (req, res) => {
    try {
      res.json({
        success: true,
        data: saveStaffAdjustmentRecord(req.params.id, req.body || {}),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/staff/adjustment/:id/:adjustmentId", (req, res) => {
    try {
      res.json({
        success: true,
        data: deleteStaffAdjustmentRecord(req.params.id, req.params.adjustmentId),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get("/api/staff/statement/:id", async (req, res) => {
    try {
      const format = String(req.query.format || "pdf").trim().toLowerCase() === "json" ? "json" : "pdf";
      const details = buildStaffStatementDetails(req.params.id);
      if (format === "json") {
        return res.json({ success: true, data: details });
      }
      const pdfBuffer = await buildStaffStatementPdfBuffer(details);
      res.setHeader("Content-Disposition", `attachment; filename=\"${details.filename}\"`);
      res.type("application/pdf").send(pdfBuffer);
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, error: error.message });
    }
  });

  // ID card manager routes.
  app.get("/api/id-cards", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildIdCardSnapshot(),
      });
    } catch (error) {
      respondApiError(res, error);
    }
  });

  app.post("/api/id-cards/preview", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildIdCardPreview(req.body || {}),
      });
    } catch (error) {
      respondApiError(res, error, 404);
    }
  });

  app.get("/api/id-cards/:slug", (req, res) => {
    try {
      res.json({
        success: true,
        data: getBusinessIdCardDetails(req.params.slug, { createIfMissing: true }),
      });
    } catch (error) {
      respondApiError(res, error, 404);
    }
  });

  app.post("/api/id-cards/save", (req, res) => {
    try {
      res.json({
        success: true,
        data: saveBusinessIdCard(req.body || {}),
      });
    } catch (error) {
      respondApiError(res, error, 400);
    }
  });

  app.get("/api/id-cards/:slug/download", async (req, res) => {
    try {
      const details = getBusinessIdCardDetails(req.params.slug, { createIfMissing: true });
      const asDownload = String(req.query.download || "").trim() === "1";
      const format = String(req.query.format || "pdf").trim().toLowerCase() === "svg" ? "svg" : "pdf";
      const filename = format === "svg" ? details.svg_filename : details.filename;

      if (asDownload) {
        res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
      }

      if (format === "svg") {
        res.type("image/svg+xml").send(details.svg);
        return;
      }

      const pdfBuffer = await buildBusinessIdCardPdfBuffer(details);
      res.type("application/pdf").send(pdfBuffer);
    } catch (error) {
      respondApiError(res, error, 404);
    }
  });

  app.post("/api/id-cards/:slug/send", async (req, res) => {
    try {
      const result = await sendBusinessIdCardEmail(req.params.slug);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      respondApiError(res, error, 400);
    }
  });

  // Calendar + email routes.
  app.get("/api/calendar", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildCalendarSnapshot(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/calendar/save", (req, res) => {
    try {
      res.json({
        success: true,
        data: saveCalendarEvent(req.body || {}),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/calendar/:id", (req, res) => {
    try {
      res.json({
        success: true,
        data: removeCalendarEvent(req.params.id),
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get("/api/email/snapshot", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildEmailSnapshot(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/email/send", async (req, res) => {
    try {
      const result = await sendBusinessEmailCampaign(req.body || {});
      res.json({
        success: true,
        data: result,
        message: `Sent ${result.sent_count} email(s).`,
      });
    } catch (error) {
      respondApiError(res, error, 400);
    }
  });

  // Admin lifecycle + environment routes.
  app.post("/api/admin/shutdown", (req, res) => {
    try {
      if (!canAccessPrivateAdmin(req)) {
        return res.status(403).json({
          success: false,
          error: "Admin shutdown is allowed only from an authorized admin request.",
        });
      }

      res.json({
        success: true,
        message: "Admin server shutdown requested.",
      });
      scheduleAdminShutdown("Shutdown requested from the admin UI.");
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/config/env", (req, res) => {
    try {
      res.json({
        success: true,
        data: buildEnvConfigSnapshot(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/config/env", (req, res) => {
    try {
      const nextConfig = saveEnvConfigSnapshot(req.body || {});
      res.json({
        success: true,
        data: nextConfig,
        message:
          "Environment files were updated. Restart the admin server and rebuild or restart the user app if you changed build-time values.",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = {
  registerToolRoutes,
};
