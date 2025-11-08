import { Database } from "bun:sqlite";
import { Vercel } from "@vercel/sdk";
import Bun from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

const domainCache = sqliteTable("domain_cache", {
  domain: text("domain").primaryKey(),
  available: integer("available").notNull(),
  checkedAt: integer("checked_at").notNull(),
});

const sqlite = new Database("domains.sqlite");
const db = drizzle(sqlite);

sqlite.run(`
  CREATE TABLE IF NOT EXISTS domain_cache (
    domain TEXT PRIMARY KEY,
    available INTEGER,
    checked_at INTEGER
  )
`);

const vercel = new Vercel({
  bearerToken: process.env.VERCEL_BEARER_TOKEN,
});

const domainSchema = z.hostname();
const domainsArraySchema = z.array(domainSchema);

const loadDomainsFromFile = async (path: string): Promise<Set<string>> => {
  const file = Bun.file(path);
  const domains = await file.text();

  const lines = domains
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#")); // Allow comments with #

  try {
    const validatedDomains = domainsArraySchema.parse(lines);
    const uniqueValidatedDomains = new Set(validatedDomains);
    console.log(
      "Successfully loaded and validated",
      validatedDomains.length,
      "domains from",
      path,
      "with",
      uniqueValidatedDomains.size,
      "unique entries."
    );
    return uniqueValidatedDomains;
  } catch (cause) {
    throw new Error("Failed to validate domains from file", { cause });
  }
};

const checkDomains = async (domains: Set<string>) => {
  const uncached: string[] = [];
  const results: { domain: string; available: boolean }[] = [];

  for (const domain of domains) {
    const cached = db
      .select()
      .from(domainCache)
      .where(eq(domainCache.domain, domain))
      .get();

    if (cached) {
      results.push({ domain: cached.domain, available: !!cached.available });
    } else {
      uncached.push(domain);
    }
  }

  console.log("Found cached results for", results.length, "domains");

  if (uncached.length > 0) {
    console.log("Checking availability for", uncached.length, "domains");

    const chunks: string[][] = [];
    for (let i = 0; i < uncached.length; i += 50) {
      chunks.push(uncached.slice(i, i + 50));
    }

    for (const [index, chunk] of chunks.entries()) {
      console.log(
        `Processing chunk ${index + 1}/${chunks.length} (${chunk.length} domains)`
      );

      const result = await vercel.domainsRegistrar.getBulkAvailability({
        teamId: process.env.VERCEL_TEAM_ID,
        requestBody: {
          domains: chunk,
        },
      });

      for (const { domain, available } of result.results) {
        await db
          .insert(domainCache)
          .values({
            domain,
            available: available ? 1 : 0,
            checkedAt: Date.now(),
          })
          .onConflictDoUpdate({
            target: domainCache.domain,
            set: {
              available: available ? 1 : 0,
              checkedAt: Date.now(),
            },
          });

        results.push({ domain, available });
      }

      // await Bun.sleep(1000);
    }

    console.log("Checked and cached results for", uncached.length, "domains");
  }

  return results;
};

const filePath = process.argv[2] || "domains.txt";

const domains = await loadDomainsFromFile(filePath);
const results = await checkDomains(domains);

console.log(
  results.filter((r) => r.available).length,
  "domains are available out of",
  results.length
);
