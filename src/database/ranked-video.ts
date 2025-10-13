import { type Video, providers, videoType } from "../providers/provider.ts";
import { type Rank } from "../rankers/ranker.ts";
import z from "zod";

/** A video with its ranking and all associated information. The final output of this script. */
export type RankedVideo = Video &
  Rank & {
    /** The time this ranking was compiled. */
    lastUpdated: Date;
  };

const stringToHttpURL = z.codec(z.httpUrl(), z.instanceof(URL), {
  decode: (urlString) => new URL(urlString),
  encode: (url) => url.href,
});

const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

// Converts a nullable number to an optional number.
const nullToUndefined = z.codec(z.number().nullable(), z.number().optional(), {
  decode: (nullableNumber) => nullableNumber ?? undefined,
  // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
  encode: (optionalNumber) => optionalNumber ?? null,
});

// Build our schema of video and rank, and combine into a RankedVideo schema.
// Why define them as types and then build a schema? Types keep JSDocs, which I want easily accessible for these types.
// So we build the schema after and keep them in sync by checking they satisfy the types.
const videoSchema = z.object({
  providerTitle: z.string(),
  type: z.enum(videoType),
  providerURL: stringToHttpURL,
  provider: z.enum(providers),
}) satisfies z.ZodType<Video>;

const rankSchema = z.object({
  rankerTitle: z.string(),
  rankerURL: stringToHttpURL,
  score: nullToUndefined,
  ranker: z.enum(["Anilist"]),
}) satisfies z.ZodType<Rank>;

export const rankedVideoSchema = videoSchema
  .safeExtend(rankSchema.shape)
  .safeExtend({
    lastUpdated: isoDatetimeToDate,
  }) satisfies z.ZodType<RankedVideo>;

// WARNING: must be kept in sync with ranked video's schema!
export const createRankedVideoTable = `
CREATE TABLE IF NOT EXISTS Ranks (
  providerTitle TEXT NOT NULL,
  type TEXT NOT NULL,
  providerURL TEXT NOT NULL,
  provider TEXT NOT NULL,
  rankerTitle TEXT NOT NULL,
  rankerURL TEXT NOT NULL,
  score NUMBER,
  ranker TEXT NOT NULL,
  lastUpdated TEXT NOT NULL,
  PRIMARY KEY (provider, providerTitle)
)
`;
