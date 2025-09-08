import Bottleneck from "bottleneck";
import type { Video } from "./providers/index.ts";

/**
 * Anilist's MediaFormat type.
 */
type MediaFormat =
  /** Anime broadcast on television */
  | "TV"
  /** Anime which are under 15 minutes in length and broadcast on television */
  | "TV_SHORT"
  /** Anime movies with a theatrical release */
  | "MOVIE"
  /** Special episodes that have been included in DVD/Bluray-releases, picture dramas, pilots, etc */
  | "SPECIAL"
  /** (Original Video Animation) Anime that have been released directly on DVD/Blu-ray without originally going through a theatrical release or television broadcast */
  | "OVA"
  /** (Original Net Animation) Anime that have been originally released online or are only available through streaming services */
  | "ONA"
  /** (Not relevant) Short anime released as a music video */
  | "MUSIC"
  // The rest are non visual and not relevant here
  | "MANGA"
  | "NOVEL"
  | "ONE_SHOT";

/** Maps basic media types to a list of anilist MediaFormats. */
const acceptedMediaFormats: Record<Video["type"], MediaFormat[]> = {
  TV: ["TV", "TV_SHORT", "SPECIAL", "OVA", "ONA"] as const,
  MOVIE: ["MOVIE", "SPECIAL", "OVA", "ONA"] as const,
} as const;

interface SearchResp {
  data: {
    Page: {
      media: [
        {
          // https://anilist.co/forum/thread/2845 - averageScore is a weighted average accounting for number of people
          averageScore: number;
          title: {
            english?: string;
            romaji: string;
          };
          format: MediaFormat;
          siteUrl: string;
        },
      ];
    };
  };
}

// https://docs.anilist.co/guide/rate-limiting
const limiter = new Bottleneck({
  maxConcurrent: 1, // To not overwhelm
  minTime: 2000, // 30 req per 60 seconds -> 1 req every 2 seconds
});

/**
 * The ranking of an anime on anilist.
 */
export interface Rank {
  anilist_title: string;
  anilist_url: URL;
  score: number;
}

/**
 * Given an anime title, return its average score on anilist.
 * @param video The title of the anime
 * @returns The average score, and the title on AniList. Returns undefined if it didn't find the show
 */
export async function getRanking(video: Video): Promise<Rank | undefined> {
  // NOTE: the type parameter only takes ANIME or MANGA. So we explicitly want to set it to ANIME.
  // We fetch 3 items to up our chances of finding the correct match. For example,
  // "The Rose of Versailles" has an original TV show, *and* a movie. Rather than
  // sending multiple requests to find the right format type, we can ask for 3 and
  // use the first one that has an acceptable media type.
  const query = `query getRanking($search: String!) {
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

  let req;
  do {
    req = await limiter.schedule(() =>
      fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { search },
        }),
      }),
    );

    if (!req.ok) {
      const sleep_sec = Number(req.headers.get("Retry-After") ?? "2");
      console.log(`Rate limited, sleeping for ${sleep_sec.toString()} seconds`);
      await new Promise((f) => setTimeout(f, sleep_sec * 1000));
    }
  } while (!req.ok);

  const data = (await req.json()) as SearchResp;

  const match = data.data.Page.media.find((anime) =>
    acceptedMediaFormats[video.type].includes(anime.format),
  );

  if (match) {
    return {
      score: match.averageScore,
      anilist_title: match.title.english ?? match.title.romaji,
      anilist_url: new URL(match.siteUrl),
    };
  }

  return undefined;
}
