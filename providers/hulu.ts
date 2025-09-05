import * as cheerio from "cheerio";
import type { Provider } from "./index.ts";

/**
 * Gets a list of all anime under Hulu's anime sitemap.
 */
export class Hulu implements Provider {
  name = "Hulu";

  api = new URL("https://www.hulu.com/sitemap/genres/anime");

  /**
   * @returns a list of all anime on Hulu.
   */
  async getAnime(): Promise<string[]> {
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
      .map((_, el) => $(el).children().first().attr("title"))
      .toArray();

    return titles;
  }
}
