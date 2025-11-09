import { z } from "zod";

export const env = z
  .object({
    VERCEL_BEARER_TOKEN: z.string().min(1),
    VERCEL_TEAM_ID: z.string().min(1).optional(),
  })
  .parse(process.env);
