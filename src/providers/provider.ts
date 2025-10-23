/**
 * An array of all supported providers, for access at runtime.
 */
export const providers = ["Hulu", "Netflix"] as const;

/**
 * All supported providers.
 */
export type Providers = (typeof providers)[number];

/**
 * A streaming provider, and a way to get a list of media on it.
 */
export type Provider = Readonly<{
  /** A user-friendly name of the provider. */
  name: Providers;
  /** The URL used to access the provider's data. */
  api: URL;
  /** @returns all anime titles from the provider. */
  getMedia(): Promise<Media[]>;
}>;

/** Acceptable types of media. */
export const mediaType = ["TV", "MOVIE", "MANGA"] as const;

/**
 * Media (anime or manga) from a provider.
 */
export type Media<Provider extends Providers = Providers> = Readonly<{
  /** The tile of the media on the provider. */
  providerTitle: string;
  /** What type of media this is */
  type: (typeof mediaType)[number];
  /** Where to access the media on the provider. */
  providerURL: URL;
  /** The provider this media is on. */
  provider: Provider;
}>;
