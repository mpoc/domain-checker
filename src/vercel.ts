import { Vercel } from "@vercel/sdk";
import { env } from "./env";

const vercel = new Vercel({
  bearerToken: env.VERCEL_BEARER_TOKEN,
});

export const fetchDomainAvailability = async (domains: string[]) =>
  await vercel.domainsRegistrar.getBulkAvailability({
    teamId: env.VERCEL_TEAM_ID,
    requestBody: {
      domains,
    },
  });
