import type { Media, Provider } from "../provider.ts";
import rawMovies from "./movies.json" with { type: "json" };
import rawShows from "./shows.json" with { type: "json" };

/** Provider of a **static** list of media labeled Anime on Amazon Prime. */
export class AmazonPrime implements Provider {
  /** Human-readable identifier for AmazonPrime */
  readonly name = "AmazonPrime";

  /** Not really an API, but the url where they show media labeled anime */
  readonly api = new URL("https://www.amazon.com/gp/video/genre/anime");

  // https://www.amazon.com/gp/video/genre/anime - Prime shows labeled "Anime".
  // Click on TV Shows -> View More
  // Scroll to bottom of page (so all entries load)
  // Run in browser console:
  // Array.from(document.querySelectorAll('div>ul article')).map((u) => ({providerTitle: u.attributes["data-card-title"].nodeValue, providerURL: u.querySelector('a').href}))
  // right click and copy object
  // manually spotcheck any title that's just "Season 1"
  /** Static list of shows on Amazon. Last updaed 5/5/26 */
  readonly shows = rawShows.map((entry) => ({
    ...entry,
    type: "TV" as const,
    provider: "AmazonPrime" as const,
    providerURL: new URL(entry.providerURL.replace(/\/ref=.*$/, "")),
  })) satisfies Media[];

  // https://www.amazon.com/gp/video/genre/anime - Prime shows labeled "Anime".
  // Click on Movies -> View More (or go to TV Shows, then change the filter from TV Shows to movies)
  // Scroll to bottom of page (so all entries load)
  // Run in browser console:
  // Array.from(document.querySelectorAll('div>ul article')).map((u) => ({providerTitle: u.attributes["data-card-title"].nodeValue, providerURL: u.querySelector('a').href}))
  // right click and copy object
  /** Static list of movies on Amazon. Last updaed 5/5/26 */
  readonly movies = rawMovies.map((entry) => ({
    ...entry,
    type: "MOVIE" as const,
    provider: "AmazonPrime" as const,
    providerURL: new URL(entry.providerURL.replace(/\/ref=.*$/, "")),
  })) satisfies Media[];

  /** Prints a warning that this provider does not update itself */
  constructor() {
    console.log(
      "WARNING: AmazonPrime shows require a **manual** refresh! See documentation for more info",
    );
  }

  /**
   * @returns a **static** list of anime on Amazon. Must be updated manually :(
   */
  getMedia() {
    return Promise.resolve([...this.shows, ...this.movies]);
  }
}
