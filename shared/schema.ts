import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const potholes = pgTable("potholes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  magnitude: text("magnitude").notNull(),
  reportedAt: text("reported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPotholeSchema = createInsertSchema(potholes).omit({
  id: true,
  reportedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPothole = z.infer<typeof insertPotholeSchema>;
export type Pothole = typeof potholes.$inferSelect;
