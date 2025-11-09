import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const domainCache = sqliteTable("domain_cache", {
  domain: text("domain").primaryKey(),
  available: integer("available", { mode: "boolean" }).notNull(),
  checkedAt: integer("checked_at").notNull(),
});

export type DomainCacheEntry = typeof domainCache.$inferSelect;

const sqlite = new Database("domains.sqlite");
sqlite.run(`
  CREATE TABLE IF NOT EXISTS domain_cache (
    domain TEXT PRIMARY KEY,
    available INTEGER NOT NULL,
    checked_at INTEGER NOT NULL
  )
`);

const db = drizzle(sqlite);

export const getCachedDomain = (domain: string) =>
  db.select().from(domainCache).where(eq(domainCache.domain, domain)).get();

export const cacheDomain = ({
  domain,
  available,
}: {
  domain: string;
  available: boolean;
}) =>
  db
    .insert(domainCache)
    .values({
      domain,
      available,
      checkedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: domainCache.domain,
      set: {
        available,
        checkedAt: Date.now(),
      },
    })
    .returning()
    .get();
