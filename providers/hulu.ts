import * as cheerio from "cheerio";
import type { Provider, Video } from "./index.ts";

/**
 * Gets a list of all anime under Hulu's anime sitemap.
 */
export class Hulu implements Provider {
  name = "Hulu";

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
        const provider_title = selector.attr("title");
        if (!provider_title) {
          console.warn("No title");
          return undefined;
        }

        const href = selector.attr("href");
        if (!href) {
          console.warn("No href");
          return undefined;
        }

        const provider_url = new URL(href, "https://hulu.com");
        // We don't need the referrer
        provider_url.searchParams.delete("lp_referrer");

        let type: Video["type"];
        if (provider_url.pathname.startsWith("/movie")) {
          type = "MOVIE";
        } else if (provider_url.pathname.startsWith("/series")) {
          type = "TV";
        } else {
          console.warn(`Unexpected url path ${provider_url.pathname}`);
          return undefined;
        }

        return {
          provider_title,
          provider_url,
          type,
          provider: this.name,
        } satisfies Video;
      })
      .toArray();

    return titles;
  }
}
