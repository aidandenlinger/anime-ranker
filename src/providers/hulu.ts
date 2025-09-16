import type { Provider, Video } from "./provider.ts";
import { load as cheerioLoad } from "cheerio";
import z from "zod";

/**
 * Gets a list of all anime under {@link https://hulu.com|Hulu's} anime sitemap.
 */
export class Hulu implements Provider {
  name: Provider["name"] = "Hulu";

  api = new URL("https://www.hulu.com/sitemap/genres/anime");

  /**
   * @returns a list of all anime on Hulu.
   * @throws {Error} if HTML request fails
   */
  async getAnime(): Promise<Video[]> {
    const html = await fetch(this.api, {
      headers: { "User-Agent": "Anime-Ranker" },
    });
    if (!html.ok) {
      throw new Error(
        `[Hulu] Request not okay: ${html.status.toString()} ${html.statusText}`,
      );
    }
    const text = await html.text();
    const $ = cheerioLoad(text);

    const titles = $("div .ListCardItem")
      .children()
      .map((_, element) => {
        const selector = $(element).children().first();

        const parsed = z
          .object({
            provider_title: z.string(),
            provider_url: z.codec(z.string(), z.instanceof(URL), {
              decode: (href) => new URL(href, "https://hulu.com"),
              encode: (value) => value.pathname,
            }),
          })
          .readonly()
          .parse({
            provider_title: selector.attr("title"),
            provider_url: selector.attr("href"),
          });

        // We don't need the referrer
        parsed.provider_url.searchParams.delete("lp_referrer");

        let type: Video["type"];
        if (parsed.provider_url.pathname.startsWith("/movie")) {
          type = "MOVIE";
        } else if (parsed.provider_url.pathname.startsWith("/series")) {
          type = "TV";
        } else {
          console.warn(
            `Unexpected url path ${parsed.provider_url.pathname} doesn't start with '/movie' or '/series'`,
          );
          return;
        }

        return {
          ...parsed,
          type,
          provider: this.name,
        } satisfies Video;
      })
      .toArray();

    return titles;
  }
}
