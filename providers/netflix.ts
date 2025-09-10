import type { Provider, Video } from "./index.ts";

/* eslint-disable jsdoc/require-jsdoc -- foreign input, going to replace this datatype with zod */
/**
 * Netflix's response. This is hardcoded to our specific request (requesting the
 * 7424 genre on "az").
 */
type Resp = Readonly<{
  value: {
    genres?: {
      "7424": {
        az: Record<
          string,
          {
            itemSummary?: {
              title: string;
              videoId: number;
              type: "movie" | "show";
            };
          }
        >;
      };
    };
  };
}>;
/* eslint-enable jsdoc/require-jsdoc */

/** Cookies required to authenticate to Netflix. Must be associated with an active session. */
export type NetflixCookies = Readonly<{
  /** A required cookie to authorize with Netflix. */
  SecureNetflixId: string;
  /** A required cookie to authorize with Netflix. */
  NetflixId: string;
}>;

/**
 * Gets a list of all anime under Netflix's Anime genre (7424).
 */
export class Netflix implements Provider {
  name: Provider["name"] = "Netflix";

  // great Netflix API resource - https://github.com/oldgalileo/shakti
  api = new URL("https://www.netflix.com/shakti/mre/pathEvaluator");

  /**
   * The `SecureNetflixId` and `NetflixId` of an active Netflix session.
   */
  readonly #cookies: NetflixCookies;

  /**
   * @param cookies the `SecureNetflixId` and `NetflixId` cookies required to
   * query the Netflix API.
   */
  constructor(cookies: NetflixCookies) {
    this.#cookies = cookies;
  }

  /**
   * @returns a list of all anime in the Anime genre of Netflix
   * @throws if Netflix cookies are invalid
   */
  async getAnime(): Promise<Video[]> {
    // We request 48 titles at a time, to match with the webapp's behavior
    const CHUNK = 48;

    let iter = 0;
    let titles: Video[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- infinite loop is intentional
    while (true) {
      // "7424" is the anime genre on netflix. it doesn't get *everything* (ie Den-noh Coil) but it gets the vast majority, which is good enough for me :)
      const params = new URLSearchParams({
        path: JSON.stringify([
          "genres",
          7424, // Number of the anime genre
          "az", // get titles from A-Z. alternatives: "su" (suggestions for you), "yr" (by year), "za" (backwards alphabetically)
          { from: iter * CHUNK + 1, to: (iter + 1) * CHUNK },
          "itemSummary", // I tried replacing this to only get the title or id, but no luck. this works and is more than good enough
        ]),
      });

      const attempt = await fetch(this.api, {
        headers: {
          cookie: Object.entries(this.#cookies)
            .map(([key, value]: [string, string]) => key + "=" + value)
            .join(";"),
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
      const iterTitles: Video[] = Object.values(
        json.value.genres?.[7424].az ?? {},
      )
        .map((v) =>
          v.itemSummary !== undefined
            ? ({
                provider_title: v.itemSummary.title,
                provider_url: new URL(
                  v.itemSummary.videoId.toString(),
                  "https://netflix.com/title/",
                ),
                type: v.itemSummary.type === "show" ? "TV" : "MOVIE",
                provider: this.name,
              } satisfies Video)
            : undefined,
        )
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
