import Bottleneck from "bottleneck";
import type { Video } from "./providers/index.ts";
import assert from "node:assert";

/**
 * Anilist's MediaFormat type.
 */
type MediaFormat =
  | "TV"
  | "TV_SHORT"
  | "MOVIE"
  | "SPECIAL"
  | "OVA"
  | "ONA"
  | "MUSIC"
  | "MANGA"
  | "NOVEL"
  | "ONE_SHOT";

interface SearchResp {
  data: {
    Media?: {
      // https://anilist.co/forum/thread/2845 - averageScore is a weighted average accounting for number of people
      averageScore: number;
      title: {
        english: string;
      };
      format: MediaFormat;
      siteUrl: string;
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
  const query = `query getRanking($search!: String, $format: MediaFormat) {
    Media(search: $search, type: ANIME, format: $format) {
      averageScore
      title {
        english
      }
      format
      siteUrl
    }
  }
  `;

  const req = await limiter.schedule(() =>
    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        // unfortunately, we can only provide *ONE* format. A tv series could be
        // TV, TV_SHORT, or ONA. So we only define format when we know it's a movie.
        variables: {
          search: video.provider_title,
          format: video.type === "MOVIE" ? "MOVIE" : undefined,
        },
      }),
    }),
  );

  const data = (await req.json()) as SearchResp;

  // Didn't get a matching result
  if (!data.data.Media) {
    console.warn(`Didn't get a result on anilist for ${video.provider_title}`);
    return undefined;
  }

  switch (video.type) {
    case "TV":
      if (!["TV", "TV_SHORT", "ONA"].includes(data.data.Media.format)) {
        // Basically, since we were querying on ANIME, this should *only* happen if we pull a movie instead of a TV show.
        // We could requery on these three types, but I'll only do that when I run this and actually hit this issue.
        console.warn(
          `Queried on ${video.provider_title}, expected a TV show, got ${data.data.Media.format} ${data.data.Media.title.english}. Skipping...`,
        );
        return undefined;
      }
      break;

    case "MOVIE":
      // We explictly queried for a MOVIE on anilist, so this state should never occur.
      assert.strictEqual(data.data.Media.format, "MOVIE");
      break;
  }

  return {
    score: data.data.Media.averageScore,
    anilist_title: data.data.Media.title.english,
    anilist_url: new URL(data.data.Media.siteUrl),
  };
}
