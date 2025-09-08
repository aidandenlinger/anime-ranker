/**
 * A streaming provider, and a way to get a list of anime on it.
 */
export interface Provider {
  /** A user-friendly name of the provider. */
  name: "Hulu" | "Netflix";
  /** The URL used to access the provider's data. */
  api: URL;
  /** A function to retrieve all anime titles from the provider. */
  getAnime(): Promise<Video[]>;
}

/**
 * A video on a streaming service.
 */
export interface Video {
  /* The tile of the show on the provider. */
  provider_title: string;
  /* If it is a TV show or a movie. */
  type: "TV" | "MOVIE";
  /* How to access the show on the provider. */
  provider_url: URL;
  /* The provider this show is on. */
  provider: Provider["name"];
}

export { Hulu } from "./hulu.ts";
export { Netflix } from "./netflix.ts";
