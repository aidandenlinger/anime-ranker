interface SearchResp {
  data: {
    Media: {
      averageScore: number;
      title: {
        english: string;
      };
    };
  };
}

/**
 * Given an anime title, return its average score on anilist.
 * @param title The title of the anime
 * @returns The average score, and the title on AniList
 */
async function getRanking(
  title: string,
): Promise<{ title: string; score: number }> {
  const query = `query ExampleQuery($search: String) {
    Media(search: $search) {
      averageScore
      title {
        english
      }
    }
  }
  `;

  const data = (await (
    await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search: title },
      }),
    })
  ).json()) as SearchResp;

  return {
    title: data.data.Media.title.english,
    score: data.data.Media.averageScore,
  };
}

console.log(await getRanking("Frieren"));
