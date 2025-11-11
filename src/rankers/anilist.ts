import type { Media, Providers } from "../providers/provider.ts";
import { P, match } from "ts-pattern";
import type { Rank, Ranker } from "./ranker.ts";
import pThrottle from "p-throttle";
import { titleSimilarity } from "./string-comp.ts";
import z from "zod";

/**
 * How many results each anilist request should contain. Useful when a series
 * also contains movies.
 *
 * For example, "The Rose of Versailles" has a TV show *and* a movie. By getting
 * multiple results in one query, we can filter down to the one we want.
 */
const DEFAULT_RESULTS_PER_SEARCH = 3;

/**
 * Gets rankings from {@link https://anilist.co|Anilist}.
 */
export class Anilist implements Ranker {
  /** Human readable name for the ranker. */
  readonly name = "Anilist" as const;

  /** API to query - {@link https://docs.anilist.co|docs here}. */
  readonly api = new URL("https://graphql.anilist.co");

  /**
   * @param type The type of the media, to determine if we're searching for Anime or Manga
   * @param numberOfResults An optional number of results to return, defaults to {@link DEFAULT_RESULTS_PER_SEARCH}
   * @returns A GraphQL query to retrieve rankings from Anilist
   */
  readonly #graphqlQuery = (
    type: Media["type"],
    numberOfResults = DEFAULT_RESULTS_PER_SEARCH,
  ) => {
    let queryType: "ANIME" | "MANGA";
    switch (type) {
      case "TV":
      case "MOVIE": {
        queryType = "ANIME";
        break;
      }
      case "MANGA": {
        queryType = "MANGA";
        break;
      }
    }

    return `query getRanking($search: String!) {
      Page(perPage: ${numberOfResults.toString()}) {
        media(search: $search, type: ${queryType}) {
          id
          averageScore
          meanScore
          title {
            english
            romaji
          }
          synonyms
          format
          siteUrl
          coverImage {
            large
          }
          startDate {
            day
            month
            year
          }
          genres
          description
        }
      }
    }
    ` as const;
  };

  /**
   * Given an anime title, return its average score on anilist.
   * @param media The title of the anime
   * @returns The average score, and the title on AniList. Returns undefined if it didn't find the show
   */
  async getRanking(media: Media) {
    const cleanedTitle = this.#cleanTitle(media.providerTitle, media.provider);

    let results = await this.#parsedRequest(cleanedTitle, media.type);

    // Filter results by media format - ie if we're searching for a movie, take out all TV shows
    results = results.filter(
      ([_rank, metadata]) =>
        // If format is undefined, this is unreleased media where it's hasn't been announced what format it is
        // Since it's unreleased, there is zero possibility it's on a streaming service :)
        metadata.format !== undefined &&
        acceptedMediaFormats[media.type].includes(metadata.format),
    );

    if (media.type === "MANGA") {
      // There are two accepted formats for Manga - MANGA and ONE_SHOT.
      // There's the case where a one-shot gets promoted to a manga, and they share the same name.
      // In this case, it's more likely that the manga service has the full series manga, not the precursor oneshot.
      // So, we want to put full series first so they're considered first. Example case - "Bone Collection" on ShonenJump
      // This isn't a concern for anime - OVAs typically have a different title than a full series.
      results = results.toSorted(([_aEntry, aMetadata], [_bEntry, bMetadata]) =>
        match([aMetadata.format, bMetadata.format])
          // If they're the same type, don't change the sort
          .when(
            ([a, b]) => a === b,
            () => 0 as const,
          )
          // if a is manga and b isn't, put a higher in list
          .with(["MANGA", P.any], () => -1 as const)
          // if b is manga and a isn't, put b higher in list
          .with([P.any, "MANGA"], () => 1 as const)
          // emergency fallback, don't change sorting
          .otherwise(() => 0 as const),
      );
    }

    const providerTitleIsIn = (possibleTitles: string[]) =>
      possibleTitles.some(
        (anilistTitle) =>
          titleSimilarity(anilistTitle, cleanedTitle) === "similar",
      );

    // Two searches:
    // - see if the provider title is in the official media titles. This isn't always the case,
    //   namely when a streaming service has a non-anime labeled as anime. In this case, the
    //   show won't be on Anilist. Anilist will return their closest matches, but these should be
    //   relatively exact searches - in this case where no titles are above a high threshold of
    //   similarity, I want to say no match. See `src/rankers/string-comp.test.ts` for some example
    //   cases.
    // - if no matches on official titles, see if the title in the *synonyms* of any entries.
    //   Why not do synonyms in the first search? Synonyms seem to be less regulated, ie
    //   https://anilist.co/anime/154178 is a set of shorts yet it has the main show's title
    //   in its synonyms, so it'd match first if we gave them equal rank, so prefer official
    //   title matches first. Why consider synonyms at all? Hulu uses a synonym for this show:
    //   https://anilist.co/anime/158028
    const bestMatch =
      results.find(([_rank, metadata]) =>
        providerTitleIsIn(metadata.allTitles),
      ) ??
      results.find(([_rank, metadata]) =>
        providerTitleIsIn(metadata.titleSynonyms),
      );

    if (!bestMatch) {
      return;
    }

    // We store a [rank, metadata] pair - return the final rank, discarding the
    // metadata which we only needed for the filtering above
    return bestMatch[0];
  }

  /** We're allowed to make 30 req per 60 seconds -> 1 req every 2 seconds -> 1 req every 2000 ms */
  readonly #requestInvervalMs = 2000;

  /**
   * Only allow one request to anilist every 2 seconds. See the
   * {@link https://docs.anilist.co/guide/rate-limiting|Anilist rate limit docs}.
   * @param search The anime to search for
   * @param type The type of media we're searching for
   * @returns A raw response with `this.#resultsPerSearch` anime matching the query
   */
  readonly #throttledRequest = pThrottle({
    limit: 1, // To not overwhelm
    interval: this.#requestInvervalMs,
    /* eslint-disable-next-line unicorn/consistent-function-scoping -- we never want to make unthrottled requests, so this arrow function must be defined within the throttle */
  })((title: string, type: Media["type"]) =>
    fetch(this.api, {
      method: "POST",
      headers: {
        /* eslint-disable-next-line @typescript-eslint/naming-convention -- "Content-Type" is a specific header */
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: this.#graphqlQuery(type),
        variables: { search: title },
      }),
    }),
  );

  /**
   * Request anilist data for a title and parse it.
   * @param title The title to search for
   * @param type The type of media we're searching for
   * @returns Data for each show
   * @throws {z.ZodError} if HTML request fails (often due to invalid cookies) or response isn't in expected shape
   */
  async #parsedRequest(title: string, type: Media["type"]) {
    let request;
    do {
      request = await this.#throttledRequest(title, type);

      if (!request.ok) {
        const SEC_TO_MS = 1000;
        const MS_TO_SEC = 1 / SEC_TO_MS;

        const retryAfterSec = request.headers.get("Retry-After");
        /** If we don't get a Retry-After, do the default pause between requests */
        const sleepSec = retryAfterSec
          ? Number(retryAfterSec)
          : this.#requestInvervalMs * MS_TO_SEC;
        console.log(
          `\n[${this.name}] Request failed, likely rate limited, sleeping for ${sleepSec.toString()} seconds`,
        );
        await new Promise((f) => setTimeout(f, sleepSec * SEC_TO_MS));
      }
    } while (!request.ok);

    return this.#anilistResp.parse(await request.json());
  }

  /**
   * Clean up an anime's title to prepare for anilist's searching.
   * @param title The title to search for
   * @param provider The provider of the anime for specific filtering
   * @returns a title fit for searching with anilist
   */
  #cleanTitle(title: string, provider: Providers) {
    // Anilist search doesn't like colons
    // Try searching for "Frieren: Beyond Journey's End" and the actual anime is the third result if the colon is in it
    title = title.replace(":", "");

    if (provider === "Hulu") {
      // Hulu specific filtering: they occasionally have two entries for sub vs dub, labelled in distinct ways
      // strip these prefixes/suffixes as they mess with anilist search
      // TODO: it'd be nice to track sub vs dub and kick this code out of the anilist area, it's just a pain with hulu since i'd need to visit each url for each show and determine some heuristics (are there episodes with sub or dub? does the *title* have sub or dub?) it's doable, just a pain, and managing the separate titles case sounds super annoying. it's doable though.
      // Prefixes: (Sub) (Dub)
      title = title.replace(/^\((?:Sub|Dub)\) /, "");
      // Suffixes: (Spanish) (Eng) (Eng Dub) (English Dub) (Dub) (en Espanol)
      title = title.replace(
        / \((?:Spanish|Eng|Eng Dub|English Dub|Dub|en Español)\)$/,
        "",
      );
    }

    return title;
  }

  /** Anilist's response to our query. */
  readonly #anilistResp = z
    .object({
      data: z.object({
        /* eslint-disable-next-line @typescript-eslint/naming-convention -- this is anilist's response, I don't name it */
        Page: z.object({
          media: z.array(
            z.object({
              id: z.number(),
              // null if it's a new show without enough ratings
              averageScore: z.number().nullable(),
              // Sometimes entries have enough ratings for a mean score but not
              // for an average (particularly for smaller manga). Used as a fallback score.
              meanScore: z.number().nullable(),
              title: z.object({
                english: z.string().nullable(),
                romaji: z.string(),
              }),
              synonyms: z.array(z.string()),
              // null if it's a new show with undetermined format
              format: z.literal(anilistMediaFormat).nullable(),
              siteUrl: z.httpUrl(),
              coverImage: z.object({
                large: z.httpUrl(),
              }),
              startDate: z.object({
                day: z.number().nullable(),
                month: z.number().nullable(),
                year: z.number().nullable(),
              }),
              genres: z.array(z.string()),
              description: z.string().nullable(),
            }),
          ),
        }),
      }),
    })
    .transform((resp) => {
      const results = resp.data.Page.media;

      return results.map((result): [Rank, Metadata] => {
        /* eslint-disable unicorn/no-null -- we're matching API results which have nulls */
        const startDate = match(result.startDate)
          .with(
            { year: P.nonNullable, month: null, day: null },
            ({ year }) => new Date(year),
          )
          .with(
            { year: P.nonNullable, month: P.nonNullable, day: null },
            // month INDEX: January is 0, December is 11
            ({ year, month }) => new Date(year, month - 1),
          )
          .with(
            { year: P.nonNullable, month: P.nonNullable, day: P.nonNullable },
            // month INDEX: January is 0, December is 11
            ({ year, month, day }) => new Date(year, month - 1, day),
          )
          // eslint-disable-next-line unicorn/no-useless-undefined -- explicitly setting variable to undefined, not a no-op
          .otherwise(() => undefined);
        /* eslint-enable unicorn/no-null -- done checking for explicit nulls */

        return [
          {
            score: result.averageScore ?? result.meanScore ?? undefined,
            rankerTitle: result.title.english ?? result.title.romaji,
            rankerURL: new URL(result.siteUrl),
            ranker: this.name,
            lastUpdated: new Date(),
            rankId: `${this.name}:${result.id.toString()}`,
            genres: result.genres,
            poster: new URL(result.coverImage.large),
            startDate,
            description: result.description ?? undefined,
          },
          {
            format: result.format ?? undefined,
            allTitles: [
              result.title.english ?? undefined,
              result.title.romaji,
            ].filter((a) => a !== undefined),
            titleSynonyms: result.synonyms,
          },
        ];
      });
    })
    .readonly();
}

/** Metadata used to match an anime to a search result. */
type Metadata = Readonly<{
  /** The format of the show, to ensure we have a movie or TV show. */
  format: MediaFormat | undefined;
  /** All titles for the show in Latin characters */
  allTitles: string[];
  /** All possible synonyms for the show, a fallback if no titles match. */
  titleSynonyms: string[];
}>;

/**
 * Anilist's MediaFormat type.
 */
const anilistMediaFormat = [
  /** Anime broadcast on television */
  "TV",
  /** Anime which are under 15 minutes in length and broadcast on television */
  "TV_SHORT",
  /** Anime movies with a theatrical release */
  "MOVIE",
  /** Special episodes that have been included in DVD/Bluray-releases, picture dramas, pilots, etc */
  "SPECIAL",
  /** (Original Video Animation) Anime that have been released directly on DVD/Blu-ray without originally going through a theatrical release or television broadcast */
  "OVA",
  /** (Original Net Animation) Anime that have been originally released online or are only available through streaming services */
  "ONA",
  /** (Not relevant) Short anime released as a music video */
  "MUSIC",
  /** Professionally published manga with more than one chapter */
  "MANGA",
  /** Manga with just one chapter */
  "ONE_SHOT",
  /** (Not relevant for this script) Written books released as a series of light novels */
  "NOVEL",
] as const;

/**
 * Anilist's MediaFormat type.
 */
type MediaFormat = (typeof anilistMediaFormat)[number];

/** Maps basic media types to a list of anilist MediaFormats. */
const acceptedMediaFormats: Readonly<
  Record<Media["type"], readonly MediaFormat[]>
> = {
  /* eslint-disable @typescript-eslint/naming-convention -- using an enum as a key */
  TV: ["TV", "TV_SHORT", "SPECIAL", "OVA", "ONA"],
  MOVIE: ["MOVIE", "SPECIAL", "OVA", "ONA"],
  MANGA: ["MANGA", "ONE_SHOT"],
  /* eslint-enable @typescript-eslint/naming-convention -- done enuming */
};
