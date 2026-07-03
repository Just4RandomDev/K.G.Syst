import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const warnsTable = pgTable("warns", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  reason: text("reason").notNull(),
  appealed: boolean("appealed").notNull().default(false),
  appealNote: text("appeal_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Warn = typeof warnsTable.$inferSelect;
export type InsertWarn = typeof warnsTable.$inferInsert;
