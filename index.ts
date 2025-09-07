import { mkdir, writeFile } from "node:fs/promises";
import { getRanking, type Rank } from "./anilist.ts";
import type { Provider, Video } from "./providers/index.ts";
import { Hulu, Netflix } from "./providers/index.ts";
import { join } from "node:path";

type RankedVideo = Video & Rank & { lastUpdated: Date };

const providers: Provider[] = [new Hulu()];

if (process.env.NETFLIX_COOKIES === undefined) {
  console.warn("NETFLIX_COOKIES not defined, skipping Netflix...");
} else {
  providers.push(new Netflix(process.env.NETFLIX_COOKIES));
}

for (const provider of providers) {
  console.log(`Querying ${provider.name}...`);
  let videos;
  try {
    videos = await provider.getAnime();
  } catch (e) {
    if (e instanceof Error) {
      console.warn(e.message);
    }
    console.warn(`Skipping ${provider.name} due to error...`);
    continue;
  }

  // I originally had a `Set<Rank>`, but turns out Javascript sets work on
  // object instances, *not* object data. I still want to store my data as
  // a `Rank` to keep the context of what the string and number are, so
  // this set is solely to make sure `toWatch` doesn't have duplicates
  const seenTitles = new Set<string>();
  const toWatch: RankedVideo[] = [];

  for (const video of videos) {
    const ranking = await getRanking(video);
    if (
      ranking &&
      ranking.score >= 80 &&
      !seenTitles.has(ranking.anilist_title)
    ) {
      console.log(
        `You should watch ${ranking.anilist_title} on ${provider.name}`,
      );
      seenTitles.add(ranking.anilist_title);
      toWatch.push({
        ...video,
        ...ranking,
        lastUpdated: new Date(),
      });
    }
  }

  // We're gonna sort by ranking, highest to lowest
  toWatch.sort((a, b) => b.score - a.score);

  const OUT_DIR = "out";
  const file = join(
    OUT_DIR,
    `${provider.name}_${new Date().toISOString()}.json`,
  );
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(toWatch, null, 2));
  console.log(`Wrote results, sorted by score, to ${file}`);
}
