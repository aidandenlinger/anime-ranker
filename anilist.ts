import Bottleneck from "bottleneck";

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
    };
  };
}

// https://docs.anilist.co/guide/rate-limiting
const limiter = new Bottleneck({
  maxConcurrent: 1, // To not overwhelm
  minTime: 2000, // 30 req per 60 seconds -> 1 req every 2 seconds
});

export interface Rank {
  title: string;
  score: number;
}

/**
 * Given an anime title, return its average score on anilist.
 * @param title The title of the anime
 * @param allowMovies if this should allow movies, or only TV shows
 * @returns The average score, and the title on AniList. Returns undefined if it didn't find the show
 */
export async function getRanking(
  title: string,
  allowMovies = false,
): Promise<Rank | undefined> {
  // NOTE: the type parameter only takes ANIME or MANGA. So we explicitly want to set it to ANIME.
  const query = `query getRanking($search: String) {
    Media(search: $search, type: ANIME) {
      averageScore
      title {
        english
      }
      format
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
        variables: { search: title },
      }),
    }),
  );

  const data = (await req.json()) as SearchResp;

  // For tv shows on streaming services, we only care about these three.
  // SPECIALs and OVAs aren't broadcasted, so they aren't what we're looking for
  // Everything else is non-anime
  const allowedFormats: MediaFormat[] = ["TV", "TV_SHORT", "ONA"];
  if (allowMovies) {
    allowedFormats.push("MOVIE");
  }

  if (data.data.Media && allowedFormats.includes(data.data.Media.format)) {
    return {
      score: data.data.Media.averageScore,
      title: data.data.Media.title.english,
    };
  }

  return undefined;
}
