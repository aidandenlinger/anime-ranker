import { mkdir, writeFile } from "node:fs/promises";
import { getRanking, type Rank } from "./anilist.ts";
import type { Provider } from "./providers/index.ts";
import { Hulu } from "./providers/index.ts";
import { join } from "node:path";

const providers: Provider[] = [new Hulu()];

for (const provider of providers) {
  const titles = await provider.getAnime();

  const toWatch = new Set<Rank>();

  for (const title of titles) {
    const ranking = await getRanking(title);
    if (ranking && ranking.score >= 80 && !toWatch.has(ranking)) {
      console.log(`You should watch ${ranking.title} on ${provider.name}`);
      toWatch.add(ranking);
    }
  }

  // We're gonna sort by ranking, highest to lowest
  const serialized = Array.from(toWatch);
  serialized.sort((a, b) => b.score - a.score);

  const OUT_DIR = "out";
  const file = join(
    OUT_DIR,
    `${provider.name}_${new Date().toISOString()}.json`,
  );
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(serialized, null, 2));
  console.log(`Wrote results, sorted by score, to ${file}`);
}
