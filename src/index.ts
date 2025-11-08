import { Database } from "bun:sqlite";
import { Vercel } from "@vercel/sdk";
import Bun from "bun";
import { z } from "zod";

const db = new Database("domains.sqlite");

db.run(`
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
  const text = await file.text();

  const lines = text
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
      .query("SELECT domain, available FROM domain_cache WHERE domain = ?")
      .get(domain) as { domain: string; available: number } | null;

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

    const insert = db.prepare(
      "INSERT OR REPLACE INTO domain_cache (domain, available, checked_at) VALUES (?, ?, ?)"
    );

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
        insert.run(domain, available ? 1 : 0, Date.now());
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
