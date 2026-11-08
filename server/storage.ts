import { applications } from "@shared/schema";
import type { Application, NewApplication } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    bvn TEXT NOT NULL,
    amount INTEGER NOT NULL,
    term_days INTEGER NOT NULL,
    monthly_rate_bps INTEGER NOT NULL,
    total_due INTEGER NOT NULL,
    monthly_payment INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    review_note TEXT,
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  createApplication(app: NewApplication): Promise<Application>;
  listApplications(phone?: string): Promise<Application[]>;
  getApplication(id: number): Promise<Application | undefined>;
  reviewApplication(
    id: number,
    status: "approved" | "rejected",
    note: string | null,
  ): Promise<Application | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createApplication(app: NewApplication): Promise<Application> {
    return db.insert(applications).values(app).returning().get();
  }

  async listApplications(phone?: string): Promise<Application[]> {
    if (phone) {
      return db
        .select()
        .from(applications)
        .where(eq(applications.phone, phone))
        .orderBy(desc(applications.id))
        .all();
    }
    return db.select().from(applications).orderBy(desc(applications.id)).all();
  }

  async getApplication(id: number): Promise<Application | undefined> {
    return db.select().from(applications).where(eq(applications.id, id)).get();
  }

  async reviewApplication(
    id: number,
    status: "approved" | "rejected",
    note: string | null,
  ): Promise<Application | undefined> {
    return db
      .update(applications)
      .set({ status, reviewNote: note, reviewedAt: new Date().toISOString() })
      .where(eq(applications.id, id))
      .returning()
      .get();
  }
}

export const storage = new DatabaseStorage();
