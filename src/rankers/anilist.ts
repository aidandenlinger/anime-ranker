import type { Rank, Ranker } from "./ranker.ts";
import type { Video } from "../providers/provider.ts";
import assert from "node:assert/strict";
import pThrottle from "p-throttle";
import z from "zod";

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

/** Anilist's response to our query. */
const AnilistResp = z
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
            // null if it's a new show with undetermined format
            format: z.literal(anilistMediaFormat).nullable(),
            siteUrl: z.codec(z.httpUrl(), z.instanceof(URL), {
              decode: (url) => new URL(url),
              encode: (url) => url.href,
            }),
          }),
        ),
      }),
    }),
  })
  .readonly();

// https://docs.anilist.co/guide/rate-limiting
const throttled = pThrottle({
  limit: 1, // To not overwhelm
  interval: 2000, // 30 req per 60 seconds -> 1 req every 2 seconds
});

/**
 * Gets rankings from {@link https://anilist.co|Anilist}.
 */
export class Anilist implements Ranker {
  name: Ranker["name"] = "Anilist";

  api = new URL("https://graphql.anilist.co");

  // NOTE: the type parameter only takes ANIME or MANGA. So we explicitly want to set it to ANIME.
  // We fetch 3 items to up our chances of finding the correct match. For example,
  // "The Rose of Versailles" has an original TV show, *and* a movie. Rather than
  // sending multiple requests to find the right format type, we can ask for 3 and
  // use the first one that has an acceptable media type.
  readonly #graphql_query = `query getRanking($search: String!) {
      Page(perPage: 3) {
        media(search: $search, type: ANIME) {
          averageScore
          title {
            english
            romaji
          }
          format
          siteUrl
        }
      }
    }
    `;

  /**
   * Given an anime title, return its average score on anilist.
   * @param video The title of the anime
   * @returns The average score, and the title on AniList. Returns undefined if it didn't find the show
   */
  async getRanking(video: Video): Promise<Rank | undefined> {
    let search = video.provider_title;
    // Anilist search doesn't like colons
    // Try searching for "Frieren: Beyond Journey's End" and the actual anime is the third result if the colon is in it
    search = search.replace(":", "");

    if (video.provider === "Hulu") {
      // Hulu specific filtering: they occasionally have two entries for sub vs dub, labelled in distinct ways
      // strip these prefixes/suffixes as they mess with anilist search
      // TODO: it'd be nice to track sub vs dub and kick this code out of the anilist area, it's just a pain with hulu since i'd need to visit each url for each show and determine some heuristics (are there episodes with sub or dub? does the *title* have sub or dub?) it's doable, just a pain, and managing the separate titles case sounds super annoying. it's doable though.
      // Prefixes: (Sub) (Dub)
      search = search.replace(/^\((?:Sub|Dub)\) /, "");
      // Suffixes: (Spanish) (Eng) (Eng Dub) (English Dub) (Dub) (en Espanol)
      search = search.replace(
        / \((?:Spanish|Eng|Eng Dub|English Dub|Dub|en Español)\)$/,
        "",
      );
    }

    const throttledRequest = throttled(() =>
      fetch(this.api, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: this.#graphql_query,
          variables: { search },
        }),
      }),
    );

    let request;
    do {
      request = await throttledRequest();

      if (!request.ok) {
        const sleep_sec = Number(request.headers.get("Retry-After") ?? "2");
        console.log(
          `Rate limited, sleeping for ${sleep_sec.toString()} seconds`,
        );
        await new Promise((f) => setTimeout(f, sleep_sec * 1000));
      }
    } while (!request.ok);

    const json = await request.json();
    const data = AnilistResp.safeParse(json);

    if (!data.success) {
      console.warn(
        `[Anilist] Error parsing data, skipping ${video.provider_title}`,
      );
      console.warn(`Received data: ${JSON.stringify(json, undefined, 2)}`);
      console.warn("Error:\n", z.prettifyError(data.error));
      return;
    }

    const match = data.data.data.Page.media.find(
      (anime) =>
        // These nulls are possible when the show hasn't been released yet
        anime.averageScore !== null &&
        anime.format !== null &&
        acceptedMediaFormats[video.type].includes(anime.format),
    );

    if (!match) {
      return;
    }

    // This is impossible because it's a part of our find condition, but typescript doesn't pick up on it
    assert.ok(match.averageScore !== null);

    return {
      score: match.averageScore,
      ranker_title: match.title.english ?? match.title.romaji,
      ranker_url: match.siteUrl,
      ranker: this.name,
    };
  }
}
