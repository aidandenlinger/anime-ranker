import type { Provider, Video } from "./providers/provider.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { Anilist } from "./rankers/anilist.ts";
import { Hulu } from "./providers/hulu.ts";
import { Netflix } from "./providers/netflix.ts";
import type { Rank } from "./rankers/ranker.ts";
import path from "node:path";
import z from "zod";

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
    console.warn("Skipping Netflix as required env variables are not defined:");
    console.warn(z.prettifyError(netflixCookies.error));
  }
}

for (const provider of providers) {
  console.log(`Querying ${provider.name}...`);
  let videos;
  try {
    videos = await provider.getAnime();
  } catch (error) {
    if (error instanceof Error) {
      console.warn(error.message);
    }
    console.warn(`Skipping ${provider.name} due to error...`);
    continue;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DEBUG
  if (DEBUG) {
    // FIXME
    // shuffle the array
    for (let a_index = videos.length - 1; a_index > 0; a_index--) {
      const b_index = Math.floor(Math.random() * (a_index + 1));
      const a_value = videos[a_index];
      const b_value = videos[b_index];
      if (a_value && b_value) {
        [videos[a_index], videos[b_index]] = [b_value, a_value];
      }
    }
    // Only take 10% (but at least 1 element)
    videos = videos.slice(0, Math.max(1, videos.length * 0.1));
  }

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

    if (ranking.score && ranking.score >= 80) {
      console.log(
        `You should watch ${ranking.ranker_title} on ${provider.name}`,
      );
      toWatch.push({
        ...video,
        ...ranking,
        lastUpdated: new Date(),
      });
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DEBUG
    } else if (DEBUG) {
      // FIXME
      console.log(
        `Skipping ${ranking.ranker_title} as score is ${ranking.score?.toString() ?? "undefined"}`,
      );
      toWatch.push({
        ...video,
        ...ranking,
        lastUpdated: new Date(),
      });
    }
  }

  if (noMatch.length > 0) {
    console.warn(
      `Anilist couldn't find a match for ${JSON.stringify(noMatch.map((t) => t.provider_title))}`,
    );
    if (provider.name === "Netflix") {
      console.warn(
        "Please note that Netflix labels a lot of content as 'Anime' when it isn't considered as such by Anilist.",
      );
    }
  }

  // We're gonna sort by ranking, highest to lowest
  // undefined -> Infinity, largest number, so end of list
  toWatch.sort((a, b) => (b.score ?? Infinity) - (a.score ?? Infinity));

  const OUT_DIR = path.join(import.meta.dirname, "..", "out");
  const file = path.join(
    OUT_DIR,
    `${provider.name}_${new Date().toISOString()}.json`,
  );
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(toWatch, undefined, 2));
  console.log(`Wrote results, sorted by score, to ${file}`);
}
