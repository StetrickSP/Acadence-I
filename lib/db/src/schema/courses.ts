import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const GRADING_SCHEMES = ["weighted", "curved", "pass_fail"] as const;
export type GradingScheme = (typeof GRADING_SCHEMES)[number];

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  semester: text("semester").notNull(),
  instructor: text("instructor").notNull(),
  description: text("description"),
  gradingScheme: text("grading_scheme")
    .$type<GradingScheme>()
    .notNull()
    .default("weighted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCourseSchema = createInsertSchema(coursesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;
