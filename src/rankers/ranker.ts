import type { Video } from "../providers/provider.ts";

/**
 * A service that ranks a video.
 */
export type Ranker = Readonly<{
  /** A user-friendly name of the ranker. */
  name: "Anilist";
  /** The URL used to access the ranker's data. */
  api: URL;
  /** @returns the ranking, if possible, from the given Video. */
  getRanking(video: Video): Promise<Rank | undefined>;
}>;

/**
 * The ranking of an anime.
 */
export type Rank = Readonly<{
  /**
   * English title of the show on the ranker.
   * If there is no English title, this should be romaji.
   */
  ranker_title: string;
  /** URL to the show on the ranker. */
  ranker_url: URL;
  /**
   * The average score of the show on anilist - a weighted average out of
   * 100, accounting for the number of people who reviewed it. See
   * {@link https://anilist.co/forum/thread/2845|this thread} for info on how the
   * average score is determined.
   *
   * A score may be undefined - this is typically because the show is new and
   * doesn't have a ranking yet.
   */
  score: number | undefined;
  /** Name of the ranker. */
  ranker: Ranker["name"];
}>;
