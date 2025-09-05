export interface Provider {
  /** A user-friendly name of the provider. */
  name: string;
  /** The URL used to access the provider's data. */
  api: URL;
  /** A function to retrieve all anime titles from the provider. */
  getAnime(): Promise<string[]>;
}

export { Hulu } from "./hulu.ts";
export { Netflix } from "./netflix.ts";
