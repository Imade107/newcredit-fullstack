import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { insertApplicationSchema } from "@shared/schema";
import { computeLoan, TERMS, MIN_AMOUNT, MAX_AMOUNT } from "@shared/loan";

const ADMIN_KEY = process.env.ADMIN_KEY ?? "admin123";

function isAdmin(req: {
  headers: Record<string, unknown>;
  query?: Record<string, unknown>;
}): boolean {
  const key =
    (req.headers["x-admin-key"] as string | undefined) ??
    (typeof req.query?.key === "string" ? (req.query.key as string) : undefined);
  return key === ADMIN_KEY;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Admin passcode check
  app.post("/api/admin/login", (req, res) => {
    const { key } = (req.body ?? {}) as { key?: string };
    if (key !== ADMIN_KEY) {
      res.status(401).json({ message: "Invalid admin key" });
      return;
    }
    res.json({ ok: true });
  });

  // Create a loan application (figures computed server-side)
  app.post("/api/applications", async (req, res) => {
    const parsed = insertApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid application details" });
      return;
    }
    const { fullName, phone, bvn, amount, termDays } = parsed.data;

    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || !digits.startsWith("0")) {
      res.status(400).json({ message: "Enter a valid 11-digit Nigerian phone number (e.g. 08012345678)" });
      return;
    }
    const bvnDigits = bvn.replace(/\D/g, "");
    if (bvnDigits.length !== 11) {
      res.status(400).json({ message: "BVN must be 11 digits (demo — use any 11-digit test number)" });
      return;
    }
    if (!fullName.trim() || fullName.trim().length < 2) {
      res.status(400).json({ message: "Enter your full name" });
      return;
    }
    if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      res.status(400).json({ message: `Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}` });
      return;
    }
    if (!TERMS.some((t) => t.days === termDays)) {
      res.status(400).json({ message: "Invalid loan term" });
      return;
    }

    const fig = computeLoan(amount, termDays);
    const created = await storage.createApplication({
      fullName: fullName.trim(),
      phone: digits,
      bvn: bvnDigits,
      amount,
      termDays,
      monthlyRateBps: Math.round(fig.monthlyRate * 10_000),
      totalDue: Math.round(fig.total),
      monthlyPayment: Math.round(fig.monthly),
      dueDate: fig.dueDate.toISOString(),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(created);
  });

  // List applications. With ?phone= it's the applicant view (own loans);
  // without it, it requires the admin key and returns everything.
  app.get("/api/applications", async (req, res) => {
    const phone = typeof req.query.phone === "string" ? req.query.phone.replace(/\D/g, "") : undefined;
    if (phone) {
      if (phone.length !== 11) {
        res.status(400).json({ message: "Invalid phone number" });
        return;
      }
      res.json(await storage.listApplications(phone));
      return;
    }
    if (!isAdmin(req)) {
      res.status(401).json({ message: "Admin key required" });
      return;
    }
    res.json(await storage.listApplications());
  });

  app.get("/api/applications/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }
    const app = await storage.getApplication(id);
    if (!app) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
    // Applicants can view their own application; admin can view any.
    if (!isAdmin(req) && req.query.phone !== app.phone) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }
    res.json(app);
  });

  // Admin decision
  app.post("/api/applications/:id/review", async (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ message: "Admin key required" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }
    const { decision, note } = (req.body ?? {}) as { decision?: string; note?: string };
    if (decision !== "approved" && decision !== "rejected") {
      res.status(400).json({ message: "Decision must be 'approved' or 'rejected'" });
      return;
    }
    const existing = await storage.getApplication(id);
    if (!existing) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
    if (existing.status !== "pending") {
      res.status(409).json({ message: `Application already ${existing.status}` });
      return;
    }
    const updated = await storage.reviewApplication(
      id,
      decision,
      note?.trim() ? note.trim() : null,
    );
    res.json(updated);
  });

  // Admin stats
  app.get("/api/admin/stats", async (req, res) => {
    if (!isAdmin(req)) {
      res.status(401).json({ message: "Admin key required" });
      return;
    }
    const all = await storage.listApplications();
    const pending = all.filter((a) => a.status === "pending");
    const approved = all.filter((a) => a.status === "approved");
    const rejected = all.filter((a) => a.status === "rejected");
    res.json({
      total: all.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      pendingAmount: pending.reduce((s, a) => s + a.amount, 0),
      approvedAmount: approved.reduce((s, a) => s + a.amount, 0),
    });
  });

  return httpServer;
}
