import {
  integer,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const chunkStatusValues = ["pending", "uploaded"] as const;
export type ChunkStatus = (typeof chunkStatusValues)[number];

export const chunks = pgTable(
  "chunks",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    storageKey: text("storage_key").notNull(),
    etag: varchar("etag", { length: 255 }),
    status: varchar("status", { length: 16 }).$type<ChunkStatus>().notNull(),
  },
  (table) => ({
    sessionChunkUnique: uniqueIndex("chunks_session_chunk_unique").on(
      table.sessionId,
      table.chunkIndex,
    ),
  }),
);

export type ChunkRecord = typeof chunks.$inferSelect;
export type NewChunkRecord = typeof chunks.$inferInsert;
