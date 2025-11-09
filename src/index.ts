import { checkDomains, loadDomainsFromFile } from "./domains";

const filePath = process.argv[2] || "domains.txt";

const domains = await loadDomainsFromFile(filePath);
const results = await checkDomains(domains);

console.log(
  results.filter((r) => r.available).length,
  "domains are available out of",
  results.length
);
