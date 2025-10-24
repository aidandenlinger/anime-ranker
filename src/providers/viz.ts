import type { Provider, Providers } from "./provider.ts";
import { fromURL } from "cheerio";
import z from "zod";

/** All providers that come from Viz, so that we can share an implementation. */
type VizSites = Extract<Providers, "ShonenJump" | "VizManga">;

/**
 * @param name The name of the Viz service
 * @param api The URL to scrape HTML from
 * @returns a list of all manga on the given Viz provider.
 * @throws {Error} if HTML request fails or response isn't as expected
 */
const vizGetMedia =
  <Provider extends VizSites>(name: Provider, api: URL) =>
  async () => {
    let $;
    try {
      $ = await fromURL(api, {
        requestOptions: {
          method: "GET",
          // I've had the request get rejected when it has the default user agent
          /* eslint-disable-next-line @typescript-eslint/naming-convention -- "User-Agent" is a specific header */
          headers: { "User-Agent": "Anime-Ranker" },
        },
      });
    } catch (error) {
      throw new Error(`[${name}] Request not okay`, { cause: error });
    }

    const providerParsed = vizParsed(name);

    // selector from HakuNeko: https://github.com/manga-download/hakuneko/blob/46300e54326daebc1be679035fefcdcc4a874714/src/web/mjs/connectors/VizShonenJump.mjs#L65C42-L65C97
    return $("div.o_sort_container div.o_sortable a.o_chapters-link")
      .map((_index, manga) => {
        const selector = $(manga);

        return providerParsed.parse({
          title: selector.children().last().text().trim(),
          href: selector.attr("href"),
        });
      })
      .toArray();
  };

/**
 * A parsed verion of Viz's data.
 * @param name The source provider of the data we're scraping
 * @returns A parsed title
 */
const vizParsed = <Provider extends VizSites>(name: Provider) =>
  z
    .object({
      title: z.string(),
      href: z.string(),
    })
    .transform(({ title, href }) => ({
      providerTitle: title,
      providerURL: new URL(href, "https://viz.com"),
      type: "MANGA" as const,
      provider: name,
    }))
    .readonly();

/**
 * Manga available on Viz's {@link https://www.viz.com/sj-offer|Shonen Jump service}
 */
export class ShonenJump implements Provider {
  /** Human readable name for Shonen Jump */
  readonly name = "ShonenJump" as const;

  /** Not *really* an api - an html page we parse to get all titles. */
  readonly api = new URL(
    "https://www.viz.com/manga-books/shonenjump/section/free-chapters",
  );

  /** Gets all titles from Shonen Jump */
  readonly getMedia = vizGetMedia(this.name, this.api);
}

/**
 * Manga available on Viz's {@link https://www.viz.com/vm-offer|Viz Manga service}
 */
export class VizManga implements Provider {
  /** Human readable name for VizManga */
  readonly name = "VizManga" as const;

  /** Not *really* an api - an html page we parse to get all titles. */
  readonly api = new URL(
    "https://www.viz.com/manga-books/vizmanga/section/free-chapters",
  );

  /** Gets all titles from Viz Manga */
  readonly getMedia = vizGetMedia(this.name, this.api);
}
