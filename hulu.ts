import * as cheerio from "cheerio";

const SRC = new URL("https://www.hulu.com/sitemap/genres/anime");

/**
 * @returns a list of all anime on Hulu.
 */
export async function getAnime(): Promise<string[]> {
  const html = await fetch(SRC, { headers: { "User-Agent": "Anime-Ranker" } });
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
