import {
  type Media,
  type Providers,
  mediaType,
  providers,
} from "../providers/provider.ts";
import { type Rank, type Rankers, rankers } from "../rankers/ranker.ts";
import z from "zod";

const stringToHttpURL = z.codec(z.httpUrl(), z.instanceof(URL), {
  decode: (urlString) => new URL(urlString),
  encode: (url) => url.href,
});

const isoDatetimeToDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (isoString) => new Date(isoString),
  encode: (date) => date.toISOString(),
});

const nullableIsoDatetimeToDate = z.codec(
  z.iso.datetime().nullable(),
  z.date().optional(),
  {
    decode: (isoString) => (isoString ? new Date(isoString) : undefined),
    // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
    encode: (date) => (date ? date.toISOString() : null),
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

const nullableStringToUndefined = z.codec(
  z.string().nullable(),
  z.string().optional(),
  {
    decode: (nullableString) => nullableString ?? undefined,
    // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
    encode: (optionalString) => optionalString ?? null,
  },
);

const rankIdSchema = z.templateLiteral([
  z.enum(rankers),
  ":",
  z.string(),
]) satisfies z.ZodType<Rank["rankId"]>;

const nullableRankIdToUndefined = z.codec(
  rankIdSchema.nullable(),
  rankIdSchema.optional(),
  {
    decode: (nullableRankId) => nullableRankId ?? undefined,
    // eslint-disable-next-line unicorn/no-null -- SQL needs and will return a null here.
    encode: (optionalRankId) => optionalRankId ?? null,
  },
);

/** Convert "A, B, C" to ["A", "B", "C"] and vice versa */
const commaStringToArray = z.codec(z.string(), z.array(z.string()), {
  decode: (stringWithCommas) =>
    stringWithCommas === "" ? [] : stringWithCommas.split(", "),
  encode: (array) => array.join(", "),
});

// Build our schemas.
// Why define them as types and then build a schema? Types keep JSDocs, which I want easily accessible for these types.
// So we build the schema after and keep them in sync by checking they satisfy the types.
// Making a zod schema to satisfy a TypeScript type is an antipattern so it'd be nice to figure something better out.
const mediaSchema = z.object({
  providerTitle: z.string(),
  type: z.enum(mediaType),
  providerURL: stringToHttpURL,
  provider: z.enum(providers),
}) satisfies z.ZodType<Media>;

export const rankSchema = z.object({
  rankerTitle: z.string(),
  rankerURL: stringToHttpURL,
  score: nullableNumberToUndefined,
  ranker: z.enum(rankers),
  lastUpdated: isoDatetimeToDate,
  rankId: rankIdSchema,
  genres: commaStringToArray,
  poster: stringToHttpURL,
  startDate: nullableIsoDatetimeToDate,
  description: nullableStringToUndefined,
}) satisfies z.ZodType<Rank>;

export const mediaAndRankIdSchema = mediaSchema.and(
  z.object({ rankId: nullableRankIdToUndefined }),
);

/** Media with a potential rank. */
export type MaybeRankedMedia<
  Provider extends Providers = Providers,
  Ranker extends Rankers = Rankers,
> = Readonly<Media<Provider> & ZodPartial<Rank<Ranker>>>;

export const maybeRankedMediaSchema = mediaSchema.and(
  rankSchema.partial(),
) satisfies z.ZodType<MaybeRankedMedia>;

/** Media with a guaranteed score. */
export type ScoredMedia<
  Provider extends Providers = Providers,
  Ranker extends Rankers = Rankers,
> = Readonly<Media<Provider> & RequiredProperty<Rank<Ranker>, "score">>;

// WARNING: must be kept in sync with rankSchema + rankIdSchema!
export const createRanksTable = `
CREATE TABLE IF NOT EXISTS Ranks (
    "rankId" TEXT PRIMARY KEY NOT NULL,
    "rankerTitle" TEXT NOT NULL,
    "rankerURL" TEXT NOT NULL,
    "score" INTEGER CHECK ("score" >= 0 AND "score" <= 100),
    "ranker" TEXT NOT NULL,
    "lastUpdated" TEXT NOT NULL,
    "poster" TEXT NOT NULL,
    "genres" TEXT NOT NULL,
    "startDate" TEXT,
    "description" TEXT
)`;

// WARNING: must be kept in sync with mediaSchema + rankIdSchema!
export const createMediaTable = `
CREATE TABLE IF NOT EXISTS Media (
    "providerTitle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "providerURL" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "rankId" TEXT REFERENCES Ranks ("rankId"),
    PRIMARY KEY ("provider", "providerTitle")
)`;

// WARNING: must be kept in sync with mediaSchema + rankIdSchema!
export const createDeletedTable = `
CREATE TABLE IF NOT EXISTS Deleted (
    "providerTitle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "providerURL" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "rankId" TEXT REFERENCES Ranks ("rankId"),
    PRIMARY KEY ("provider", "providerTitle")
)`;

/** The primary key for the Media table, uniquely identifying a Media. */
export type MediaPrimaryKey<Provider extends Providers = Providers> = Readonly<{
  /** The provider of the title. */
  provider: Provider;
  /** The title on the provider. */
  providerTitle: string;
}>;

export const mediaPrimaryKeySchema = mediaSchema
  .pick({
    provider: true,
    providerTitle: true,
  })
  .readonly() satisfies z.ZodType<MediaPrimaryKey>;

/** How Zod handles partial, with the field optional and can be explicitly set to undefined. */
type ZodPartial<Object> = {
  [Property in keyof Object]?: Object[Property] | undefined;
};

/** Utility type to make a field optional and non nullable. Based on https://stackoverflow.com/a/53050575 */
type RequiredProperty<Type, Key extends keyof Type> = {
  [Property in Key]-?: Required<NonNullable<Type[Property]>>;
} & Omit<Type, Key>;
