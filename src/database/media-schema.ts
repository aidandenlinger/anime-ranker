import {
  type Media,
  type Providers,
  mediaType,
  providers,
} from "../providers/provider.ts";
import { type Rank } from "../rankers/ranker.ts";
import z from "zod";

/** Media on a provider that may have a ranking. What is stored in the DB. */
export type MaybeRankedMedia<Provider extends Providers = Providers> = Readonly<
  Media<Provider> &
    ZodPartial<Rank> & {
      /** The time this ranking was compiled. */
      lastUpdated: Date;
    }
>;

/** Media with a ranking. */
export type RankedMedia<Provider extends Providers = Providers> = Readonly<
  MaybeRankedMedia<Provider> & Rank
>;

const stringToHttpURL = z.codec(z.httpUrl(), z.instanceof(URL), {
  decode: (urlString) => new URL(urlString),
  encode: (url) => url.href,
});

const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

// TODO: There *has* to be a way to do these repetitive nullable functions in a generic way, but I can't find out how :(
// Doing these specific cases keeps the zod types working and contains all the SQL null handling to this file, but i hate this code :(((

// Converts a nullable string to an optional URL.
const nullableStringToOptionalHttpURL = z.codec(
  z.httpUrl().nullable(),
  z.instanceof(URL).optional(),
  {
    decode: (urlString) => (urlString ? new URL(urlString) : undefined),
    // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
    encode: (url) => (url ? url.href : null),
  },
);

// Converts a nullable number to an optional number.
const nullableNumberToUndefined = z.codec(
  z.number().nullable(),
  z.number().optional(),
  {
    decode: (nullableNumber) => nullableNumber ?? undefined,
    // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
    encode: (optionalNumber) => optionalNumber ?? null,
  },
);

// Converts a nullable string to an optional string.
const nullableStringToUndefined = z.codec(
  z.string().nullable(),
  z.string().optional(),
  {
    decode: (nullableString) => nullableString ?? undefined,
    // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
    encode: (optionalString) => optionalString ?? null,
  },
);

// Converts a nullable enum to an optional enum.
const nullableRankersToUndefined = z.codec(
  z.enum(["Anilist"]).nullable(),
  z.enum(["Anilist"]).optional(),
  {
    decode: (nullableValue) => nullableValue ?? undefined,
    // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
    encode: (optionalValue) => optionalValue ?? null,
  },
);

// Build our schema of media and rank, and combine into a RankedMedia schema.
// Why define them as types and then build a schema? Types keep JSDocs, which I want easily accessible for these types.
// So we build the schema after and keep them in sync by checking they satisfy the types.
// Making a zod schema to satisfy a TypeScript type is an antipattern so it'd be nice to figure something better out.
const mediaSchema = z.object({
  providerTitle: z.string(),
  type: z.enum(mediaType),
  providerURL: stringToHttpURL,
  provider: z.enum(providers),
}) satisfies z.ZodType<Media>;

const maybeRankSchema = z.object({
  rankerTitle: nullableStringToUndefined,
  rankerURL: nullableStringToOptionalHttpURL,
  score: nullableNumberToUndefined,
  ranker: nullableRankersToUndefined,
}) satisfies z.ZodType<ZodPartial<Rank>>;

export const maybeRankedMediaSchema = mediaSchema
  .safeExtend(maybeRankSchema.shape)
  .safeExtend({
    lastUpdated: isoDatetimeToDate,
  }) satisfies z.ZodType<MaybeRankedMedia>;

// WARNING: must be kept in sync with maybeRankedMediaSchema's schema!
export const createRankedMediaTable = `
CREATE TABLE IF NOT EXISTS Ranks (
  providerTitle TEXT NOT NULL,
  type TEXT NOT NULL,
  providerURL TEXT NOT NULL,
  provider TEXT NOT NULL,
  rankerTitle TEXT,
  rankerURL TEXT,
  score INTEGER,
  ranker TEXT,
  lastUpdated TEXT NOT NULL,
  PRIMARY KEY (provider, providerTitle)
)
`;

/** Zod's partial makes the field optional as well as allows for an undefined object. */
type ZodPartial<Object> = {
  [Property in keyof Object]?: Object[Property] | undefined;
};
