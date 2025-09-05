export interface Provider {
  name: string;
  getAnime(): Promise<string[]>;
}
export { Hulu } from "./hulu.ts";
export { Netflix } from "./netflix.ts";
