import * as cheerio from "cheerio";
import type { Provider } from "./index.ts";

const SRC = new URL("https://www.hulu.com/sitemap/genres/anime");

export class Hulu implements Provider {
  name = "Hulu";

  /**
   * @returns a list of all anime on Hulu.
   */
  async getAnime(): Promise<string[]> {
    const html = await fetch(SRC, {
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
