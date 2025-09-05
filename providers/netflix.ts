import type { Provider } from "./index.ts";

// great Netflix API resource - https://github.com/oldgalileo/shakti
const API_URL = "https://www.netflix.com/shakti/mre/pathEvaluator";

/**
 * Netflix's response. This is hardcoded to our specific request (requesting the
 * 7424 genre on "az").
 */
interface Resp {
  value: {
    genres?: {
      "7424": {
        az: Record<string, { itemSummary?: { title: string } }>;
      };
    };
  };
}

export class Netflix implements Provider {
  name = "Netflix";

  /**
   * The `SecureNetflixId` and `NetflixId` of an active Netflix session.
   * Additional cookies are fine.
   * Required because we can't query the netflix API without it.
   */
  private cookies: string;

  constructor(cookies: string) {
    this.cookies = cookies;
  }

  /**
   * @returns a list of all anime in the Anime genre of Netflix
   * @throws if Netflix cookies are invalid
   */
  async getAnime(): Promise<string[]> {
    // We request 48 titles at a time, to match with the webapp's behavior
    const CHUNK = 48;

    let iter = 0;
    let titles: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- infinite loop is intentional
    while (true) {
      // "7424" is the anime genre on netflix. it doesn't get *everything* (ie Den-noh Coil) but it gets the vast majority, which is good enough for me :)
      const params = new URLSearchParams({
        path: JSON.stringify([
          "genres",
          7424,
          "az",
          { from: iter * CHUNK + 1, to: (iter + 1) * CHUNK },
          "itemSummary",
        ]),
      });

      const attempt = await fetch(API_URL, {
        headers: {
          cookie: this.cookies,
        },
        body: params,
        method: "POST",
      });

      if (!attempt.ok) {
        throw new Error(
          `Netflix request not okay: ${attempt.status.toString()} ${attempt.statusText} ${attempt.status === 401 ? "(Are your cookies valid?)" : ""}`,
        );
      }

      const json = (await attempt.json()) as Resp;
      const iterTitles = Object.values(json.value.genres?.[7424].az ?? {})
        .map((v) => v.itemSummary?.title)
        .filter((title) => title !== undefined);

      titles = titles.concat(iterTitles);

      iter += 1;

      // Once we don't get a full chunk of titles, we're at the end of the list
      if (iterTitles.length !== CHUNK) {
        break;
      }
    }

    return titles;
  }
}
