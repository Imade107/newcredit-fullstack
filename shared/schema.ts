import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  bvn: text("bvn").notNull(), // demo only — never collect real BVNs
  amount: integer("amount").notNull(), // principal in naira
  termDays: integer("term_days").notNull(),
  monthlyRateBps: integer("monthly_rate_bps").notNull(), // 300 = 3%
  totalDue: integer("total_due").notNull(),
  monthlyPayment: integer("monthly_payment").notNull(),
  dueDate: text("due_date").notNull(), // ISO date
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  reviewNote: text("review_note"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
});

export const insertApplicationSchema = createInsertSchema(applications).pick({
  fullName: true,
  phone: true,
  bvn: true,
  amount: true,
  termDays: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;
/** Full row shape for inserts — everything except the auto-increment id. */
export type NewApplication = Omit<typeof applications.$inferInsert, "id">;
