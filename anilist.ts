import Bottleneck from "bottleneck";

interface SearchResp {
  data: {
    Media?: {
      averageScore: number;
      title: {
        english: string;
      };
    };
  };
}

const limiter = new Bottleneck({
  maxConcurrent: 1, // to not overwhelm
  minTime: 2000, // 30 req per 60 seconds -> 1 req every 2 seconds
});

export interface Rank {
  title: string;
  score: number;
}

/**
 * Given an anime title, return its average score on anilist.
 * @param title The title of the anime
 * @returns The average score, and the title on AniList. Returns undefined if it didn't find the show
 */
export async function getRanking(title: string): Promise<Rank | undefined> {
  // TODO: ratelimits
  // https://docs.anilist.co/guide/rate-limiting
  // 30 req per minute = 1 req every 2 seconds
  const query = `query ExampleQuery($search: String) {
    Media(search: $search) {
      averageScore
      title {
        english
      }
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

  const media = data.data.Media;
  if (media) {
    return { score: media.averageScore, title: media.title.english };
  }

  return undefined;
}
