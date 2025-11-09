import Bun from "bun";
import { z } from "zod";
import { chunk } from "./chunk";
import { cacheDomain, getCachedDomain } from "./db";
import { fetchDomainAvailability } from "./vercel";

const loadDomainsFromFile = async (path: string): Promise<Set<string>> => {
  const file = Bun.file(path);
  const domains = await file.text();

  const lines = domains
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length && !line.startsWith("#")); // Allow comments with #

  try {
    const validatedDomains = z.hostname().array().parse(lines);
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

const partitionDomainsByCacheState = (domains: Set<string>) => {
  const uncachedDomains: string[] = [];
  const cachedDomains: { domain: string; available: boolean }[] = [];

  for (const domain of domains) {
    const cached = getCachedDomain(domain);

    if (cached) {
      cachedDomains.push({
        domain: cached.domain,
        available: cached.available,
      });
    } else {
      uncachedDomains.push(domain);
    }
  }
  return { cached: cachedDomains, uncached: uncachedDomains };
};

const checkDomains = async (domains: Set<string>) => {
  const { cached: results, uncached } = partitionDomainsByCacheState(domains);

  console.log("Found cached results for", results.length, "domains");

  if (uncached.length) {
    console.log("Checking availability for", uncached.length, "domains");

    const chunks = chunk(uncached);

    for (const [index, chunk] of chunks.entries()) {
      console.log(
        `Processing chunk ${index + 1}/${chunks.length} (${chunk.length} domains)`
      );

      const result = await fetchDomainAvailability(chunk);

      for (const { domain, available } of result.results) {
        await cacheDomain(domain, available);
        results.push({ domain, available });
      }
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
