import { writeFile } from "node:fs/promises";
import { getRanking, type Rank } from "./anilist.ts";
import * as hulu from "./hulu.ts";

const huluAnime = await hulu.getAnime();

const toWatch = new Set<Rank>();

for (const anime of huluAnime) {
  const ranking = await getRanking(anime);
  if (ranking && ranking.score >= 80 && !toWatch.has(ranking)) {
    console.log(`You should watch ${ranking.title}`);
    toWatch.add(ranking);
  }
}

// We're gonna sort by ranking, highest to lowest
const serialized = Array.from(toWatch);
serialized.sort((a, b) => b.score - a.score);

await writeFile(
  `hulu_${new Date().toISOString()}.json`,
  JSON.stringify(serialized, null, 2),
);
