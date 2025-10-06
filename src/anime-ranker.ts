import { Netflix, netflixCookiesSchema } from "./providers/netflix.ts";
import { Presets, SingleBar } from "cli-progress";
import type { Provider, Video } from "./providers/provider.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { Anilist } from "./rankers/anilist.ts";
import { Hulu } from "./providers/hulu.ts";
import type { Rank } from "./rankers/ranker.ts";
import { cliInterface } from "./cli-interface.ts";
import path from "node:path";
import shuffle from "knuth-shuffle-seeded";
import z from "zod";

/** A video with its ranking and all associated information. The final output of this script. */
type RankedVideo = Readonly<
  Video &
    Rank & {
      /** The time this ranking was compiled. */
      lastUpdated: Date;
    }
>;

const cliArguments = cliInterface.parse().opts();

const providers: Provider[] = [];

for (const provider of cliArguments.providers) {
  switch (provider) {
    case "Hulu": {
      providers.push(new Hulu());
      break;
    }
    case "Netflix": {
      const netflixCookies = netflixCookiesSchema.safeParse(process.env);

      if (netflixCookies.success) {
        providers.push(new Netflix(netflixCookies.data));
      } else {
        console.warn(
          "Skipping Netflix as required env variables are not defined:",
        );
        console.warn(z.prettifyError(netflixCookies.error));
      }
    }
  }
}

for (const provider of providers) {
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

  // If any testing flags are provided, filter the videos down
  if (cliArguments.testLessTitles) {
    const seed =
      typeof cliArguments.testLessTitles === "number"
        ? cliArguments.testLessTitles
        : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

    console.log(
      `[--test-less-titles] ${provider.name} seed: ${seed.toString()}`,
    );

    videos = shuffle(videos, seed);
    // Only take 10% (but at least 1 element)
    videos = videos.slice(0, Math.max(1, videos.length * 0.1));
  } else if (cliArguments.testTitle) {
    const substrings = cliArguments.testTitle;
    videos = videos.filter((video) =>
      substrings.some((substring) => video.providerTitle.includes(substring)),
    );
    console.log(
      `[--test-titles] Only checking ${videos.map((video) => video.providerTitle).join(", ")}`,
    );
  }

  const results: RankedVideo[] = [];
  const noMatch: Video[] = [];

  // For now, anilist is the only ranker. I've set it up so it's easy to expand this in
  // the future

  const ranker = new Anilist();

  const progressBar = new SingleBar(
    {
      format: `${provider.name} {bar} {percentage}% | ETA: {eta}s | {value}/{total} | Currently Searching: {title}`,
      stopOnComplete: true,
      clearOnComplete: true,
      hideCursor: true,
      gracefulExit: true,
    },
    Presets.shades_grey,
  );
  progressBar.start(videos.length, 0);

  for (const video of videos) {
    progressBar.update({ title: video.providerTitle });
    const ranking = await ranker.getRanking(video);

    progressBar.increment();

    if (!ranking) {
      noMatch.push(video);
      continue;
    }

    results.push({
      ...video,
      ...ranking,
      lastUpdated: new Date(),
    });
  }
  console.log(); // newline

  // We're gonna sort by ranking, highest to lowest, then alphabetically if score is the same
  // undefined -> NEGATIVE_INFINITY, smallest score, end of list
  results.sort(
    (a, b) =>
      (b.score ?? Number.NEGATIVE_INFINITY) -
        (a.score ?? Number.NEGATIVE_INFINITY) ||
      a.providerTitle.localeCompare(b.providerTitle),
  );

  console.log(`On ${provider.name}, you should watch:`);
  for (const video of results) {
    if (video.score && video.score >= 80) {
      console.log(`- ${video.providerTitle} (${video.score.toString()})`);
    }
  }
  console.log(); // newline

  if (noMatch.length > 0) {
    console.warn(
      `Anilist couldn't find a match for ${noMatch.map((t) => t.providerTitle).join(", ")}`,
    );
    if (provider.name === "Netflix") {
      console.warn(
        "Please note that Netflix labels a lot of content as 'Anime' when it isn't considered as such by Anilist.",
      );
    }
  }

  const OUT_DIR = path.join(import.meta.dirname, "..", "out");
  const file = path.join(
    OUT_DIR,
    `${provider.name}_${new Date().toISOString()}.json`,
  );
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(results, undefined, 2));
  console.log(`Wrote all results, sorted by score, to ${file}`);
}
