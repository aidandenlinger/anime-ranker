import * as cheerio from "cheerio";
import * as z from "zod";
import type { Provider, Video } from "./provider.ts";

/**
 * Gets a list of all anime under {@link https://hulu.com|Hulu's} anime sitemap.
 */
export class Hulu implements Provider {
  name: Provider["name"] = "Hulu";

  api = new URL("https://www.hulu.com/sitemap/genres/anime");

  /**
   * @returns a list of all anime on Hulu.
   */
  async getAnime(): Promise<Video[]> {
    const html = await fetch(this.api, {
      headers: { "User-Agent": "Anime-Ranker" },
    });
    if (!html.ok) {
      throw new Error("HTML request is not okay");
    }
    const text = await html.text();
    const $ = cheerio.load(text);

    const titles = $("div .ListCardItem")
      .children()
      .map((_, el) => {
        const selector = $(el).children().first();

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
          return undefined;
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
