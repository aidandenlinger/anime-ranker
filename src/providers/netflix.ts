import { type Provider, type Video, videoType } from "./provider.ts";
import pThrottle from "p-throttle";
import z from "zod";

/**
 * Netflix's response. This is hardcoded to our specific request (requesting the
 * 7424 genre over "az").
 */
const NetflixResp = z
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
                type: z.codec(
                  z.literal(["movie", "show"]),
                  z.literal(videoType),
                  {
                    decode: (type) => {
                      switch (type) {
                        case "movie":
                          return "MOVIE";
                        case "show":
                          return "TV";
                      }
                    },
                    encode: (type) => {
                      switch (type) {
                        case "TV":
                          return "show";
                        case "MOVIE":
                          return "movie";
                      }
                    },
                  },
                ),
              }),
            }),
          ),
        }),
      }),
    }),
  })
  .readonly();

/** Cookies required to authenticate to Netflix. Must be associated with an active session. */
export type NetflixCookies = Readonly<{
  /** A required cookie to authorize with Netflix. */
  SecureNetflixId: string;
  /** A required cookie to authorize with Netflix. */
  NetflixId: string;
}>;

// The Netflix API isn't public, so there's no public rate limiting mechanism.
// We want to be friendly as possible to avoid any issues, so we only make one
// request per second.
const throttle = pThrottle({
  limit: 1, // don't request again until we've gotten an answer.
  interval: 1000, // one request per second. This is an arbitrary, friendly value.
});

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
   * @returns a list of all anime in the Anime genre of Netflix
   * @throws {Error} if Netflix cookies are invalid
   */
  async getAnime(): Promise<Video[]> {
    // We request 48 titles at a time, to match with the webapp's behavior
    const CHUNK = 48;

    let iter = 0;
    let titles: Video[] = [];

    const throttledReq = throttle(async (params: URLSearchParams) =>
      fetch(this.api, {
        headers: {
          cookie: Object.entries(this.#cookies)
            .map(([key, value]: [string, string]) => key + "=" + value)
            .join(";"),
        },
        body: params,
        method: "POST",
      }),
    );

    // titles from *this* iteration. needs to be defined out of the block so we can use it in the while condition
    let iterTitles: Video[];
    do {
      const attempt = await throttledReq(
        new URLSearchParams({
          path: JSON.stringify([
            "genres",
            // "7424" is the anime genre on netflix. it doesn't get *everything*
            // (ie Den-noh Coil) but it gets the vast majority, which is good enough for me :)
            7424,
            // get titles from A-Z. alternatives: "su" (suggestions for you),
            // "yr" (by year), "za" (backwards alphabetically)
            "az",
            { from: iter * CHUNK + 1, to: (iter + 1) * CHUNK },
            // Get a summary about each item, with lots of info
            // I tried replacing this to only get the title or id, but no luck.
            "itemSummary",
          ]),
        }),
      );

      if (!attempt.ok) {
        throw new Error(
          `Netflix request not okay: ${attempt.status.toString()} ${attempt.statusText} ${attempt.status === 401 ? "(Are your cookies valid?)" : ""}`,
        );
      }

      const json = NetflixResp.parse(await attempt.json());
      iterTitles = Object.values(json.value.genres["7424"].az).map((v) => ({
        provider_title: v.itemSummary.title,
        provider_url: new URL(
          v.itemSummary.videoId.toString(),
          "https://netflix.com/title/",
        ),
        type: v.itemSummary.type,
        provider: this.name,
      }));

      titles = titles.concat(iterTitles);

      iter += 1;
    } while (iterTitles.length === CHUNK); // Once we don't receive a full chunk of videos, we're at the end of the list

    return titles;
  }
}
