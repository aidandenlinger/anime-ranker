import { Netflix, netflixCookiesSchema } from "./providers/netflix.ts";
import { Presets, SingleBar } from "cli-progress";
import { ShonenJump, VizManga } from "./providers/viz.ts";
import { Anilist } from "./rankers/anilist.ts";
import { Database } from "./database/database.ts";
import { Hulu } from "./providers/hulu.ts";
import type { Provider } from "./providers/provider.ts";
import { cliInterface } from "./cli-interface.ts";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import shuffle from "knuth-shuffle-seeded";
import z from "zod";

/** The minimum score an anime must hold to be printed at the end of the program as recommended. */
const SCORE_THRESHOLD = 80;

const cliArguments = cliInterface.parse().opts();

const providers: Provider[] = [];

for (const provider of cliArguments.providers) {
  switch (provider) {
    case "Hulu": {
      providers.push(new Hulu());
      break;
    }
    case "ShonenJump": {
      providers.push(new ShonenJump());
      break;
    }
    case "VizManga": {
      providers.push(new VizManga());
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

const OUT_DIR = path.join(import.meta.dirname, "..", "out");
await mkdir(OUT_DIR, { recursive: true });
using database = new Database(
  path.join(OUT_DIR, `${new Date().toISOString()}.sqlite`),
);

for (const provider of providers) {
  let mediaList;
  try {
    mediaList = await provider.getMedia();
  } catch (error) {
    if (error instanceof Error) {
      console.warn(error.message);
    }
    console.warn(`Skipping ${provider.name} due to error...`);
    continue;
  }

  // If any testing flags are provided, filter the media down
  if (cliArguments.testLessTitles) {
    const seed =
      typeof cliArguments.testLessTitles === "number"
        ? cliArguments.testLessTitles
        : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

    console.log(
      `[--test-less-titles] ${provider.name} seed: ${seed.toString()}`,
    );

    mediaList = shuffle(mediaList, seed);
    // Take 10% (but at least 1 element)
    const PERCENTAGE = 0.1;
    mediaList = mediaList.slice(0, Math.max(1, mediaList.length * PERCENTAGE));
  } else if (cliArguments.testTitle) {
    const substrings = cliArguments.testTitle;
    mediaList = mediaList.filter((media) =>
      substrings.some((substring) => media.providerTitle.includes(substring)),
    );
    console.log(
      `[--test-titles] Only checking ${mediaList.map((media) => media.providerTitle).join(", ")}`,
    );
  }

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
  progressBar.start(mediaList.length, 0);

  for (const media of mediaList) {
    progressBar.update({ title: media.providerTitle });
    const rank = await ranker.getRanking(media);

    progressBar.increment();

    database.insert({
      ...media,
      ...rank,
    });
  }
  console.log(); // newline

  console.log(`On ${provider.name}, you should check out:`);
  for (const media of database.getAll({
    rank: { minimumScore: SCORE_THRESHOLD },
    provider: provider.name,
  })) {
    console.log(
      `- ${media.providerTitle}${media.startDate ? ` (${media.startDate.getFullYear().toString()})` : ""} - ${media.score.toString()}`,
    );
  }
  console.log(); // newline

  const noRank = database.getAll({ rank: false, provider: provider.name });
  if (noRank.length > 0) {
    console.warn(
      `Anilist couldn't find a ranking for ${noRank.map((t) => t.providerTitle).join(", ")}`,
    );
    if (provider.name === "Netflix") {
      console.warn(
        "Please note that Netflix labels a lot of content as 'Anime' when it isn't considered as such by Anilist.",
      );
    }
  }
}

console.log(`Wrote all results, sorted by score, to ${database.path}`);
