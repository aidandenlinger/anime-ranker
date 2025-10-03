import { type Provider, type Video } from "./provider.ts";
import pThrottle from "p-throttle";
import z from "zod";

/** Cookies required to authenticate to Netflix. Must be associated with an active session. */
export const netflixCookiesSchema = z
  .object({
    SecureNetflixId: z.string(),
    NetflixId: z.string(),
  })
  .readonly();

/** Cookies required to authenticate to Netflix. Must be associated with an active session. */
type NetflixCookies = z.infer<typeof netflixCookiesSchema>;

/**
 * Gets a list of all anime under {@link https://netflix.com|Netflix's} Anime genre (7424).
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
   * How many titles we get per request. Set to 48 to match the webapp's
   * behavior. Defined in the class because pageSize must remain constant between
   * requests to avoid repeating/skipping titles.
   */
  readonly #pageSize = 48;

  /**
   * @returns a list of all anime in the Anime genre of Netflix
   * @throws {Error} if Netflix request does not succeed (often because cookies are invalid) or response isn't as expected
   */
  async getAnime() {
    let page = 0;
    let titles: Video[] = [];

    // titles from *this* page. needs to be defined out of the block so we can use it in the while condition
    let pageTitles: readonly Video[];
    do {
      pageTitles = await this.#parsedRequest(page);
      titles = [...titles, ...pageTitles];
      page += 1;
    } while (pageTitles.length === this.#pageSize); // Once we don't receive a full chunk of videos, we're at the end of the list

    return titles;
  }

  /**
   * Makes one request per second to Netflix at maximum, even if called multiple times.
   * @param page The page to fetch
   * @returns A raw response with `this.#pageSize` number of titles from the anime genre
   */
  readonly #throttledRequest = pThrottle({
    limit: 1, // don't request again until we've gotten an answer.
    interval: 1000, // one request per second. This is an arbitrary, friendly value.
    // eslint-disable-next-line unicorn/consistent-function-scoping -- we never want to make unthrottled requests, so this arrow function must be defined within the throttle
  })(async (page: number) => {
    const parameters = new URLSearchParams({
      path: JSON.stringify([
        "genres",
        // "7424" is the anime genre on netflix. it doesn't get *everything*
        // (ie Den-noh Coil) but it gets the vast majority, which is good enough for me :)
        7424,
        // get titles from A-Z. alternatives: "su" (suggestions for you),
        // "yr" (by year), "za" (backwards alphabetically)
        "az",
        { from: page * this.#pageSize + 1, to: (page + 1) * this.#pageSize },
        // Get a summary about each item, with lots of info
        // I tried replacing this to only get the title or id, but no luck.
        "itemSummary",
      ]),
    });

    return fetch(this.api, {
      headers: {
        cookie: Object.entries(this.#cookies)
          .map(([key, value]) => key + "=" + value)
          .join(";"),
      },
      body: parameters,
      method: "POST",
    });
  });

  /**
   * Request the given page of titles from Netflix, parsing it into a NetflixResp
   * @param page The page to fetch
   * @returns `this.#pageSize` number of titles from the anime genre
   * @throws {Error} if HTML request fails (often due to invalid cookies) or response isn't in expected shape
   */
  async #parsedRequest(page: number) {
    const response = await this.#throttledRequest(page);

    if (!response.ok) {
      throw new Error(
        `[Netflix] Request not okay: ${response.status.toString()} ${response.statusText} ${response.status === 401 ? "(Are your cookies valid?)" : ""}`,
      );
    }

    return this.#NetflixResp.parse(await response.json());
  }

  /**
   * Netflix's response. This is hardcoded to our specific request (requesting the
   * 7424 genre over "az").
   */
  readonly #NetflixResp = z
    .object({
      value: z.object({
        genres: z.object({
          "7424": z.object({
            az: z.record(
              z.string(),
              z.object({
                itemSummary: z.object({
                  title: z.string(),
                  videoId: z.number(),
                  type: z.literal(["movie", "show"]),
                }),
              }),
            ),
          }),
        }),
      }),
    })
    .transform((response) =>
      Object.values(response.value.genres["7424"].az).map((video) => {
        let type: Video["type"];
        switch (video.itemSummary.type) {
          case "movie": {
            type = "MOVIE";
            break;
          }
          case "show": {
            type = "TV";
            break;
          }
        }

        return {
          provider_title: video.itemSummary.title,
          provider_url: new URL(
            video.itemSummary.videoId.toString(),
            "https://netflix.com/title/",
          ),
          type,
          provider: this.name,
        };
      }),
    )
    .readonly();
}
