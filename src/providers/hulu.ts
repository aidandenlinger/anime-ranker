import type { Media, Provider } from "./provider.ts";
import { fromURL } from "cheerio";
import z from "zod";

/**
 * Gets a list of all anime under {@link https://hulu.com|Hulu's} anime sitemap.
 */
export class Hulu implements Provider {
  /** Human-readable identifier for the provider */
  name = "Hulu" as const;

  // Of note - they actually have separate pages for TV and movies.
  // - https://www.hulu.com/sitemap/genres/anime-movies
  // - https://www.hulu.com/sitemap/genres/anime-tv
  // I'm sticking with the simple one-request-gets-both approach, but it's
  // good to have the option if I decide to refactor
  // Another note - they maintain a list of what's being added/removed every month at https://press.hulu.com/schedule/
  /** Not *really* an api - an html page we parse to get all titles. */
  api = new URL("https://www.hulu.com/sitemap/genres/anime");

  /**
   * @returns a list of all anime on Hulu.
   * @throws {Error} if HTML request fails or response isn't as expected
   */
  async getMedia() {
    let $;
    try {
      $ = await fromURL(this.api, {
        requestOptions: {
          method: "GET",
          // I've had the request get rejected when it has the default user agent
          /* eslint-disable-next-line @typescript-eslint/naming-convention -- "User-Agent" is a specific header */
          headers: { "User-Agent": "Anime-Ranker" },
        },
      });
    } catch (error) {
      throw new Error(`[${this.name}] Request not okay`, { cause: error });
    }

    const titles = $("div .ListCardItem")
      .children()
      .map((_, element) => {
        const selector = $(element).children().first();

        return this.#huluParsed.parse({
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
  readonly #huluParsed = z
    .object({
      title: z.string(),
      href: validHuluHref,
    })
    .transform(({ title, href }) => {
      let type: Media["type"];
      if (hrefIs("/movie", href)) {
        type = "MOVIE";
      } else if (hrefIs("/series", href)) {
        type = "TV";
      } else {
        // If I ever add another validHuluUrl type, this will fail compilation :)
        type = href satisfies never;
      }

      const providerURL = new URL(href, "https://hulu.com");
      // We don't need the referrer
      providerURL.searchParams.delete("lp_referrer");

      return {
        providerTitle: title,
        providerURL: providerURL,
        type,
        provider: this.name,
      };
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
