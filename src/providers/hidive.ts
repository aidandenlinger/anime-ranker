import type { Media, Provider } from "./provider.ts";
import JSON5 from "json5";
import { fromURL } from "cheerio";
import { match } from "ts-pattern";
import pThrottle from "p-throttle";
import { stringToHttpURL } from "../database/media-schema.ts";
import z from "zod";

const HIDIVE_URL = "https://www.hidive.com";

/**
 * Gets a list of all anime under {@link https://www.hidive.com/browse|HIDIVE's} catalog.
 */
export class Hidive implements Provider {
  /** Human-readable name for HIDIVE */
  readonly name = "Hidive" as const;
  /** HIDIVE's full environment setup for prod, extracted from their main JS file */
  readonly #environment: EnvironmentConfiguration;
  /** Our HIDIVE session tokens */
  readonly #session: Session;
  /** The HTTP API endpoint for HIDIVE */
  // Typically https://dce-frontoffice.imggaming.com, but not hardcoding that in case it changes
  readonly api: URL;

  /**
   * Initalize a HIDIVE provider. This is effectively the constructor
   * since getting the environment configuration requires async fetches.
   * @returns a new HIDIVE provider for the PROD environment
   */
  static async init() {
    let $;
    try {
      $ = await fromURL(HIDIVE_URL);
    } catch (error) {
      throw new Error(`[${this.name}] Request not okay`, { cause: error });
    }

    // We're looking for the latest url to `/code/js/app.HASH.js`. The HASH can change when updated.
    // This Javascript file contains information on the environment.
    const pathToAppScript = $("script")
      .toArray()
      .map((element) => element.attribs["src"])
      .find((path) => path !== undefined && /code\/js\/app\..*\.js/.test(path));

    if (!pathToAppScript) {
      throw new Error(`Could not find path to ${this.name} main script`);
    }

    const mainScriptResp = await fetch(new URL(pathToAppScript, HIDIVE_URL));
    const mainScriptText = await mainScriptResp.text();

    // Now, extract the environment details from the app script.
    // Note: this regex extraction only works because ENV_CONF doesn't have any nested objects,
    // so I can just look for the last }. This extraction would need to be more complicated otherwise.
    const environmentJSON = /\{ENV_CONF:(\{[^}]*})/.exec(mainScriptText);

    if (!environmentJSON?.[1]) {
      throw new Error(
        `Could not find ENV_CONF object in ${this.name} main script`,
      );
    }

    // I'm extracting an object from JavaScript code, it isn't a proper JSON object. The keys are not quoted.
    // Using a JSON5 parser safely handles this.
    const environment = environmentConfigurationSchema.parse(
      JSON5.parse(environmentJSON[1]),
    );

    // Now with the environment, we can initialize a session. This gives us tokens we can use
    // for API requests.
    const sessionResp = await fetch(
      new URL("/api/v1/init", environment.httpapi),
      {
        /* eslint-disable @typescript-eslint/naming-convention -- HTTP headers can't be camelcase */
        headers: new Headers({
          "x-api-key": environment.API_KEY,
          Origin: HIDIVE_URL,
          /* eslint-enable @typescript-eslint/naming-convention -- done with HTTP headers */
        }),
      },
    );

    const session = sessionSchema.parse(await sessionResp.json());

    return new Hidive(environment, session);
  }

  /**
   * Use {@link init} to create a HIDIVE provider. This is the final
   * synchronous step to save the variables retrieved in init and create the provider.
   * @param environment The URLs to access for the HIDIVE API
   * @param session Session tokens to make API requests with
   */
  private constructor(environment: EnvironmentConfiguration, session: Session) {
    this.#environment = environment;
    this.#session = session;
    this.api = environment.httpapi;
  }

  /** @returns A list of all anime on HIDIVE. */
  async getMedia() {
    const media = new Map<string, Media>();

    let content;
    for (const animeType of ["TV", "MOVIE"] as const) {
      do {
        content = await this.#getContent(
          animeType,
          content?.paging.moreDataAvailable
            ? content.paging.lastSeen
            : undefined,
        );

        // The very first bucket, called "TV Series" or "Movies", contain popular titles.
        // These titles will be included in the alphabetical buckets below, so ignore them.
        content.buckets = content.buckets.filter(
          (bucket) => !["TV Series", "MOVIES"].includes(bucket.name),
        );

        // Do additional paging for each bucket if necessary and gather all the titles
        for (let bucket of content.buckets) {
          let contentList = bucket.contentList;

          while (bucket.paging.moreDataAvailable) {
            bucket = await this.#getBucketNextPage(
              animeType,
              bucket.exid,
              bucket.paging.lastSeen,
            );

            contentList = [...contentList, ...bucket.contentList];
          }

          for (const content of contentList) {
            if (media.get(content.title) === undefined) {
              const animeTypePrefix = match(animeType)
                .with("TV", () => "season")
                .with("MOVIE", () => "playlist")
                .exhaustive();

              media.set(content.title, {
                provider: "Hidive",
                providerTitle: content.title,
                type: animeType,
                providerURL: new URL(
                  `/${animeTypePrefix}/${content.id.toString()}`,
                  HIDIVE_URL,
                ),
              });
            }
          }
        }
      } while (content.paging.moreDataAvailable);
    }

    return [...media.values()];
  }

  /**
   * Each HIDIVE section holds several buckets. This endpoint will retrieve
   * 10 buckets with 12 entries per bucket, like their webapp does. There is
   * one bucket per letter of the alphabet.
   * @param section Which section to fetch from
   * @param lastSeen The value of `paging.lastSeen`, will get the next buckets
   * @returns the requested buckets and pagination status
   */
  readonly #getContent = async (section: "TV" | "MOVIE", lastSeen?: string) => {
    const url = new URL(`/api/v4/content/${contentName[section]}`, this.api);
    // Get at maximum 10 buckets per request (one bucket for each letter of the alphabet), matching webapp behavior
    url.searchParams.append("bpp", "10");
    // Get at maximum 12 shows per bucket, matching webapp behavior
    url.searchParams.append("rpp", "12");
    if (lastSeen) {
      url.searchParams.append("lastSeen", lastSeen);
    }

    const request = await this.#throttledRequest(url);
    const json = await request.json();
    return contentSchema.parse(json);
  };

  /**
   * When you request content, we get 12 entries per bucket. If there are more
   * entries, use this to fetch the next 10 entries.
   * @param section The section the bucket is in
   * @param exid The ID for the bucket you want to get entries for
   * @param lastSeen Use `paging.lastSeen` to get more pagination
   * @returns The next 10 entries in the bucket
   */
  readonly #getBucketNextPage = async (
    section: "TV" | "MOVIE",
    exid: string,
    lastSeen: string,
  ) => {
    const url = new URL(
      `/api/v4/content/${contentName[section]}/bucket/${exid}`,
      this.api,
    );
    // Fetch 10 more shows for this bucket, matching webapp behavior
    url.searchParams.append("rpp", "10");
    // Fetching from last seen
    url.searchParams.append("lastSeen", lastSeen);

    const request = await this.#throttledRequest(url);
    const json = await request.json();
    return bucketSchema.parse(json);
  };

  /**
   * Make requests to the HIDIVE api. Rate limited to 2 requests per second.
   * I made this limit up myself and it may not be necessary, but I want to be
   * a good citizen and that's fast enough for me.
   * @param URL the URL to query
   */
  readonly #throttledRequest = pThrottle({
    // Only ever have one outgoing request
    limit: 1,
    // Arbitrary rate limit of .5 seconds between each request to not get rate limited
    interval: 500,
  })(
    /* eslint-disable-next-line unicorn/consistent-function-scoping -- we never want to make unthrottled requests, so this arrow function must be defined within the throttle */
    async (url: URL) =>
      await fetch(url, {
        /* eslint-disable @typescript-eslint/naming-convention -- HTTP headers can't be camelcase */
        headers: new Headers({
          "x-api-key": this.#environment.API_KEY,
          Realm: "dce.hidive",
          Authorization: `Bearer ${this.#session.authorisationToken}`,
        }),
        /* eslint-enable @typescript-eslint/naming-convention -- done with HTTP headers */
      }),
  );
}

/* eslint-disable @typescript-eslint/naming-convention -- already standardized on using all caps for these content types */
const contentName = {
  // https://www.hidive.com/section/TV%20Series
  TV: "TV%20Series",
  // https://www.hidive.com/section/Movies
  MOVIE: "Movies",
} as const;
/* eslint-enable @typescript-eslint/naming-convention -- done */

const pagingSchema = z.union([
  z.object({ moreDataAvailable: z.literal(true), lastSeen: z.string() }),
  z.object({ moreDataAvailable: z.literal(false) }),
]);

const bucketSchema = z.object({
  name: z.string(),
  exid: z.string(),
  paging: pagingSchema,
  contentList: z.array(
    z
      .object({
        id: z.number(),
        title: z.string(),
        series: z.optional(
          z.object({
            title: z.string(),
          }),
        ),
      })
      .transform(({ id, title, series }) => ({
        id,
        // For TV shows, we want series.title. `title` is often "Season 1" or something else useless
        // Movies don't have series, so in that case we want the actual title.
        title: series?.title ?? title,
      })),
  ),
});

const contentSchema = z.object({
  paging: pagingSchema,
  buckets: z.array(bucketSchema),
});

/** Session tokens needed to make API requests to HIDIVE. */
type Session = z.infer<typeof sessionSchema>;

const sessionSchema = z
  .object({
    authentication: z.object({
      authorisationToken: z.string(),
      refreshToken: z.string(),
    }),
  })
  .transform((init) => init.authentication);

/** HIDIVE's object to describe their production environment */
type EnvironmentConfiguration = z.infer<typeof environmentConfigurationSchema>;

/* eslint-disable @typescript-eslint/naming-convention -- this is HIDIVE's schema, I don't control the variable names here */
const environmentConfigurationSchema = z.object({
  env: z.literal("PROD"),
  httpapi: stringToHttpURL,
  beaconapi: stringToHttpURL,
  multibeaconapi: stringToHttpURL,
  matcheventsapi: stringToHttpURL,
  vespersearchapi: stringToHttpURL,
  MUXKEY: z.string(),
  SENTRY_DSN: stringToHttpURL,
  API_KEY: z.string(),
  PUBNUB_SUB_KEY: z.string(),
  PUBNUB_SUB_KEY_DCE_PAYMENT: z.string(),
  PUBNUB_SUB_KEY_VCID: z.string(),
  PUBNUB_SUB_KEY_PAYMENT: z.string(),
  PUBNUB_SUB_KEY_MATCH_EVENTS: z.string(),
  turkcellRestUrl: stringToHttpURL,
  gtaId: z.string(),
  ADOBE_AUTH: stringToHttpURL,
  IMAGE_RESIZER_FORMAT: z.string(),
  GYGIA_AUTH: stringToHttpURL,
  VERSION: z.string(),
});
/* eslint-enable @typescript-eslint/naming-convention -- Reenabling after HIDIVE conf block */
