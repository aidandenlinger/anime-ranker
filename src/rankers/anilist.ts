import type { Providers, Video } from "../providers/provider.ts";
import type { Rank, Ranker } from "./ranker.ts";
import pThrottle from "p-throttle";
import { title_similarity } from "./string-comp.ts";
import z from "zod";

/**
 * Gets rankings from {@link https://anilist.co|Anilist}.
 */
export class Anilist implements Ranker {
  name: Ranker["name"] = "Anilist";

  api = new URL("https://graphql.anilist.co");

  /**
   * How many results each anilist request should contain. Useful when a series
   * also contains movies.
   *
   * For example, "The Rose of Versailles" has a TV show *and* a movie. Rather
   * than sending multiple requests to find the right format type, we can ask
   * for `this.#resultsPerSearch` and use the first one that has an acceptable
   * media type.
   */
  readonly #resultsPerSearch = 3;

  // NOTE: the type parameter only takes ANIME or MANGA. So we explicitly want to set it to ANIME.
  readonly #graphql_query = `query getRanking($search: String!) {
      Page(perPage: ${this.#resultsPerSearch.toString()}) {
        media(search: $search, type: ANIME) {
          averageScore
          title {
            english
            romaji
          }
          synonyms
          format
          siteUrl
        }
      }
    }
    ` as const;

  /**
   * Given an anime title, return its average score on anilist.
   * @param video The title of the anime
   * @returns The average score, and the title on AniList. Returns undefined if it didn't find the show
   */
  async getRanking(video: Video) {
    const cleaned_title = this.#cleanTitle(
      video.provider_title,
      video.provider,
    );

    const results = await this.#parsedRequest(cleaned_title).then((result) =>
      result.filter(
        ([_, metadata]) =>
          // If format is undefined, this show hasn't aired yet and cannot be on a streaming service yet
          metadata.format !== undefined &&
          // Try to ensure it's the right type of media - ie if we're searching for a movie, don't pull up a TV show
          acceptedMediaFormats[video.type].includes(metadata.format),
      ),
    );

    const titleIsIn = (possibleTitles: string[]) =>
      possibleTitles.some(
        (anilist_title) =>
          title_similarity(anilist_title, cleaned_title) == "similar",
      );

    // Two searches - see if any of our titles are in the official titles, and if no matches see if
    // they're in the *synonyms* of any entries. Why not do synonyms in the first search? Synonyms
    // seem to be less regulated, ie https://anilist.co/anime/154178 is a set of shorts yet it has
    // the main show's title in its synonyms so it'd match first. Why consider synonyms at all? Hulu
    // uses a synonym for this show - https://anilist.co/anime/158028
    const match =
      results.find(([_, metadata]) =>
        // Ensure that the titles anilist found are close enough to the provider title.
        // Sometimes anilist returns some absolute nonmatches - see the title_similarity test cases for examples we're trying to reject
        titleIsIn(metadata.all_titles),
      ) ?? results.find(([_, metadata]) => titleIsIn(metadata.title_synonyms));

    if (!match) {
      return;
    }

    return match[0];
  }

  /**
   * Only allow one request to anilist every 2 seconds. See the
   * {@link https://docs.anilist.co/guide/rate-limiting|Anilist rate limit docs}.
   * @param search The anime to search for
   * @returns A raw response with `this.#resultsPerSearch` anime matching the query
   */
  readonly #throttledRequest = pThrottle({
    limit: 1, // To not overwhelm
    interval: 2000, // 30 req per 60 seconds -> 1 req every 2 seconds
    // eslint-disable-next-line unicorn/consistent-function-scoping -- we never want to make unthrottled requests, so this arrow function must be defined within the throttle
  })((title: string) =>
    fetch(this.api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: this.#graphql_query,
        variables: { search: title },
      }),
    }),
  );

  /**
   * Request anilist data for a title and parse it.
   * @param title The title to search for
   * @returns Data for each show
   * @throws {z.ZodError} if HTML request fails (often due to invalid cookies) or response isn't in expected shape
   */
  async #parsedRequest(title: string) {
    let request;
    do {
      request = await this.#throttledRequest(title);

      if (!request.ok) {
        const sleep_sec = Number(request.headers.get("Retry-After") ?? "2");
        console.log(
          `[Anilist] Request failed, likely rate limited, sleeping for ${sleep_sec.toString()} seconds`,
        );
        await new Promise((f) => setTimeout(f, sleep_sec * 1000));
      }
    } while (!request.ok);

    return this.#AnilistResp.parse(await request.json());
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
  readonly #AnilistResp = z
    .object({
      data: z.object({
        Page: z.object({
          media: z.array(
            z.object({
              // null if it's a new show without enough ratings
              averageScore: z.number().nullable(),
              title: z.object({
                english: z.string().nullable(),
                romaji: z.string(),
              }),
              synonyms: z.array(z.string()),
              // null if it's a new show with undetermined format
              format: z.literal(anilistMediaFormat).nullable(),
              siteUrl: z.httpUrl(),
            }),
          ),
        }),
      }),
    })
    .transform((resp) => {
      const results = resp.data.Page.media;

      return results.map((result): [Rank, Metadata] => {
        return [
          {
            score: result.averageScore ?? undefined,
            ranker_title: result.title.english ?? result.title.romaji,
            ranker_url: new URL(result.siteUrl),
            ranker: this.name,
          },
          {
            format: result.format ?? undefined,
            all_titles: [
              result.title.english ?? undefined,
              result.title.romaji,
            ].filter((a) => a !== undefined),
            title_synonyms: result.synonyms,
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
  all_titles: string[];
  /** All possible synonyms for the show, a fallback if no titles match. */
  title_synonyms: string[];
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
  // The rest are non visual and not relevant here
  "MANGA",
  "NOVEL",
  "ONE_SHOT",
] as const;

/**
 * Anilist's MediaFormat type.
 */
type MediaFormat = (typeof anilistMediaFormat)[number];

/** Maps basic media types to a list of anilist MediaFormats. */
const acceptedMediaFormats: Readonly<
  Record<Video["type"], readonly MediaFormat[]>
> = {
  TV: ["TV", "TV_SHORT", "SPECIAL", "OVA", "ONA"],
  MOVIE: ["MOVIE", "SPECIAL", "OVA", "ONA"],
};
