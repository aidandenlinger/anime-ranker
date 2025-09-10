import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";

import { Hulu, Netflix, type Provider, type Video } from "./providers/index.ts";
import { Anilist, type Rank } from "./rankers/index.ts";

// FIXME Temp to log every show regardless of score and to only query 10% of retrieved shows
const DEBUG = false;

/** A video with its ranking and all associated information. The final output of this script. */
type RankedVideo = Readonly<
  Video &
    Rank & {
      /** The time this ranking was compiled. */
      lastUpdated: Date;
    }
>;

const providers: Provider[] = [new Hulu()];

{
  const netflixCookies = z
    .object({
      SecureNetflixId: z.string(),
      NetflixId: z.string(),
    })
    .readonly()
    .safeParse(process.env);

  if (netflixCookies.success) {
    providers.push(new Netflix(netflixCookies.data));
  } else {
    console.warn(
      "SECURENETFLIXID or NETFLIXID not defined, skipping Netflix...",
    );
  }
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DEBUG
  if (DEBUG) {
    // FIXME
    // shuffle the array
    for (let i = videos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const i_val = videos[i];
      const j_val = videos[j];
      if (i_val && j_val) {
        [videos[i], videos[j]] = [j_val, i_val];
      }
    }
    // Only take 10% (but at least 1 element)
    videos = videos.slice(0, Math.max(1, videos.length * 0.1));
  }

  // I originally had a `Set<Rank>`, but turns out Javascript sets work on
  // object instances, *not* object data. I still want to store my data as
  // a `Rank` to keep the context of what the string and number are, so
  // this set is solely to make sure `toWatch` doesn't have duplicates
  const seenTitles = new Set<string>();
  const toWatch: RankedVideo[] = [];

  const noMatch: Video[] = [];

  // For now, anilist is the only ranker. I've set it up so it's easy to expand this in
  // the future

  const ranker = new Anilist();

  for (const video of videos) {
    const ranking = await ranker.getRanking(video);
    if (!ranking) {
      noMatch.push(video);
      continue;
    }

    if (ranking.score >= 80 && !seenTitles.has(ranking.ranker_title)) {
      console.log(
        `You should watch ${ranking.ranker_title} on ${provider.name}`,
      );
      seenTitles.add(ranking.ranker_title);
      toWatch.push({
        ...video,
        ...ranking,
        lastUpdated: new Date(),
      });
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DEBUG
    } else if (DEBUG) {
      // FIXME
      console.log(
        `Skipping ${ranking.ranker_title} as score is ${ranking.score.toString()}`,
      );
      seenTitles.add(ranking.ranker_title);
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

  const OUT_DIR = join(import.meta.dirname, "..", "out");
  const file = join(
    OUT_DIR,
    `${provider.name}_${new Date().toISOString()}.json`,
  );
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(toWatch, null, 2));
  console.log(`Wrote results, sorted by score, to ${file}`);
}
