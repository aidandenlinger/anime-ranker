import type { Media } from "../providers/provider.ts";

/** An array of all supported rankers, for runtime validation. */
export const rankers = ["Anilist"] as const;

/** All supported rankers. */
export type Rankers = (typeof rankers)[number];

/**
 * A service that ranks media.
 */
export type Ranker = Readonly<{
  /** A user-friendly name of the ranker. */
  name: Rankers;
  /** The URL used to access the ranker's data. */
  api: URL;
  /** @returns the ranking, if possible, from the given Video. */
  getRanking(media: Media): Promise<Rank | undefined>;
}>;

/**
 * The ranking of an anime.
 */
export type Rank<Ranker extends Rankers = Rankers> = Readonly<{
  /** A unique identifier for a rank within a Ranker. */
  rankId: `${Ranker}:${string}`;

  /** Name of the ranker. */
  ranker: Ranker;

  /**
   * English title of the media on the ranker.
   * If there is no English title, this should be romaji.
   */
  rankerTitle: string;

  /** URL to the media on the ranker. */
  rankerURL: URL;

  /**
   * The average score of the media on anilist - a weighted average out of
   * 100, accounting for the number of people who reviewed it. See
   * {@link https://anilist.co/forum/thread/2845|this thread} for info on how the
   * average score is determined.
   *
   * A score may be undefined - this is typically because the media is new and
   * doesn't have a ranking yet.
   */
  score?: number | undefined;

  /** The time this ranking was retrieved. */
  lastUpdated: Date;

  /** A URL to an image of a poster for the show. */
  poster: URL;

  /** Genres of the media. */
  genres: string[];

  /** The start date of the media's release. */
  startDate?: Date | undefined;

  /** A small description of the media. */
  description?: string | undefined;
}>;
