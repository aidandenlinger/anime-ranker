import { mkdir, writeFile } from "node:fs/promises";
import { getRanking, type Rank } from "./anilist.ts";
import type { Provider, Video } from "./providers/index.ts";
import { Hulu, Netflix } from "./providers/index.ts";
import { join } from "node:path";

type RankedVideo = Video & Rank & { lastUpdated: Date };

const providers: Provider[] = [new Hulu()];

if (process.env.SECURENETFLIXID && process.env.NETFLIXID) {
  providers.push(
    new Netflix({
      SecureNetflixId: process.env.SECURENETFLIXID,
      NetflixId: process.env.NETFLIXID,
    }),
  );
} else {
  console.warn("SECURENETFLIXID or NETFLIXID not defined, skipping Netflix...");
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

  const noMatch: Video[] = [];

  for (const video of videos) {
    const ranking = await getRanking(video);
    if (!ranking) {
      noMatch.push(video);
      continue;
    }

    if (ranking.score >= 80 && !seenTitles.has(ranking.anilist_title)) {
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

  if (noMatch.length > 0) {
    console.log(
      `Anilist couldn't find a match for ${JSON.stringify(noMatch.map((t) => t.provider_title))}`,
    );
    if (provider.name === "Netflix") {
      console.log(
        "Please note that Netflix labels a lot of content as 'Anime' when it isn't considered as such by Anilist.",
      );
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
