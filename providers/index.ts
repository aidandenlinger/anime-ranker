export interface Provider {
  name: string;
  getAnime(): Promise<string[]>;
}
export { Hulu } from "./hulu.ts";
