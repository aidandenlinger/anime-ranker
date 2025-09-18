import { type Provider, type Video } from "./provider.ts";
import { fromURL } from "cheerio";
import z from "zod";

/**
 * Gets a list of all anime under {@link https://hulu.com|Hulu's} anime sitemap.
 */
export class Hulu implements Provider {
  name: Provider["name"] = "Hulu";

  // Of note - they actually have separate pages for TV and movies.
  // - https://www.hulu.com/sitemap/genres/anime-movies
  // - https://www.hulu.com/sitemap/genres/anime-tv
  // I'm sticking with the simple one-request-gets-both approach, but it's
  // good to have the option if I decide to refactor
  api = new URL("https://www.hulu.com/sitemap/genres/anime");

  /**
   * @returns a list of all anime on Hulu.
   * @throws {Error} if HTML request fails or response isn't as expected
   */
  async getAnime() {
    let $;
    try {
      $ = await fromURL(this.api, {
        requestOptions: {
          method: "GET",
          // I've had the request get rejected when it has the default user agent
          headers: { "User-Agent": "Anime-Ranker" },
        },
      });
    } catch (error) {
      throw new Error(`[Hulu] Request not okay: ${JSON.stringify(error)}}`);
    }

    const titles = $("div .ListCardItem")
      .children()
      .map((_, element) => {
        const selector = $(element).children().first();

        return this.#HuluParsed.parse({
          title: selector.attr("title"),
          href: selector.attr("href"),
        });
      })
      .toArray();

    return titles;
  }

  /**
   * A parsed version of Hulu's site data.
   */
  #HuluParsed = z
    .object({
      title: z.string(),
      href: validHuluHref,
    })
    .transform(({ title, href }) => {
      let type: Video["type"];
      if (hrefIs("/movie", href)) {
        type = "MOVIE";
      } else if (hrefIs("/series", href)) {
        type = "TV";
      } else {
        // If I ever add another validHuluUrl type, this will fail compilation :)
        type = href satisfies never;
      }

      const provider_url = new URL(href, "https://hulu.com");
      // We don't need the referrer
      provider_url.searchParams.delete("lp_referrer");

      return { provider_title: title, provider_url, type, provider: this.name };
    })
    .readonly();
}

// Some URL utilities. I need to define types outside of the class, so it felt
// better to store everything outside and together.

/** The valid possibilities for a url to start with, relative to hulu.com. */
const validHrefPrefix = z.enum(["/movie", "/series"]);
/** The valid possibilities for a url to start with, relative to hulu.com. */
type ValidHrefPrefix = z.infer<typeof validHrefPrefix>;

/** An acceptable href for a Hulu entry. */
const validHuluHref = z
  .templateLiteral([validHrefPrefix, z.string()])
  .readonly();

/**
 * A smarter version of `href.startsWith` which tightens the string definition,
 * allowing for exhaustive checking.
 * @param prefix The prefix to check for
 * @param href The href to check the prefix on
 * @returns if href starts with prefix, with a type assertion
 */
function hrefIs<Prefix extends ValidHrefPrefix>(
  prefix: Prefix,
  href: string,
): href is `${Prefix}${string}` {
  return href.startsWith(prefix);
}
