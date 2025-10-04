/**
 * An array of all supported providers, for access at runtime.
 */
export const providers = ["Hulu", "Netflix"] as const;

/**
 * All supported providers.
 */
export type Providers = (typeof providers)[number];

/**
 * A streaming provider, and a way to get a list of anime on it.
 */
export type Provider = Readonly<{
  /** A user-friendly name of the provider. */
  name: Providers;
  /** The URL used to access the provider's data. */
  api: URL;
  /** @returns all anime titles from the provider. */
  getAnime(): Promise<Video[]>;
}>;

/** Acceptable types of media for an anime. */
export const videoType = ["TV", "MOVIE"] as const;

/**
 * A video on a streaming service.
 */
export type Video = Readonly<{
  /** The tile of the show on the provider. */
  provider_title: string;
  /** If it is a TV show or a movie. */
  type: (typeof videoType)[number];
  /** How to access the show on the provider. */
  provider_url: URL;
  /** The provider this show is on. */
  provider: Providers;
}>;
