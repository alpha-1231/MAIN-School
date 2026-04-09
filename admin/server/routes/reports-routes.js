"use strict";

function registerReportRoutes(app, deps) {
  const {
    handleAnalyticsReportRequest,
    loadReportExpenses,
    loadExpenses,
    stringOrDefault,
    normalizeFloat,
    normalizeDateInput,
    generateId,
    sanitizeExpenseRecord,
    DEFAULT_SUBSCRIPTION_CURRENCY,
    saveExpenses,
  } = deps;

  // Analytics routes.
  app.get("/api/reports/analytics", handleAnalyticsReportRequest);
  app.get("/api/reports/revenue", (req, res) => {
    handleAnalyticsReportRequest(req, res);
  });

  // Manual + derived expense routes.
  app.get("/api/reports/expenses", (req, res) => {
    try {
      res.json({
        success: true,
        data: loadReportExpenses(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/reports/expenses", (req, res) => {
    try {
      const payload = req.body || {};
      const title = stringOrDefault(payload.title);
      const amount = normalizeFloat(payload.amount);
      const incurredAt = normalizeDateInput(payload.incurred_at);

      if (!title) {
        return res.status(400).json({ success: false, error: "Expense title is required." });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "Expense amount must be greater than 0." });
      }
      if (!incurredAt) {
        return res.status(400).json({ success: false, error: "Expense date is required." });
      }

      const expenses = loadExpenses();
      const expenseId = stringOrDefault(payload.id) || generateId();
      const existingExpense = expenses.find((expense) => expense.id === expenseId);
      const expense = sanitizeExpenseRecord({
        id: expenseId,
        title,
        category: stringOrDefault(payload.category, existingExpense?.category || "Operations"),
        amount,
        currency: stringOrDefault(
          payload.currency,
          existingExpense?.currency || DEFAULT_SUBSCRIPTION_CURRENCY
        ),
        incurred_at: incurredAt.toISOString(),
        notes: stringOrDefault(payload.notes, existingExpense?.notes || ""),
        created_at: existingExpense?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const nextExpenses = expenses.filter((expenseItem) => expenseItem.id !== expenseId);
      nextExpenses.push(expense);
      saveExpenses(nextExpenses);

      res.json({ success: true, data: expense });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/reports/expenses/:id", (req, res) => {
    try {
      const expenseId = stringOrDefault(req.params.id);
      const nextExpenses = loadExpenses().filter((expense) => expense.id !== expenseId);
      saveExpenses(nextExpenses);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = {
  registerReportRoutes,
};
