import type { Media, Provider, Providers } from "./providers/provider.ts";
import { Netflix, netflixCookiesSchema } from "./providers/netflix.ts";
import { Presets, SingleBar } from "cli-progress";
import { ShonenJump, VizManga } from "./providers/viz.ts";
import { cliInterface, logStyleText } from "./cli-interface.ts";
import { Anilist } from "./rankers/anilist.ts";
import { Database } from "./database/database.ts";
import { Hulu } from "./providers/hulu.ts";
import type { MediaPrimaryKey } from "./database/media-schema.ts";
import process from "node:process";
import shuffle from "knuth-shuffle-seeded";
import z from "zod";

/** The minimum score an anime must hold to be printed at the end of the program as recommended. */
const SCORE_THRESHOLD = 80;

/**
 * Entrypoint to the application. Fetches arguments via cli arguments and calls
 * the two operations - updating and printing results from the database.
 */
async function main() {
  const cliArguments = cliInterface.parse().opts();

  console.log(`Using database ${cliArguments.database}`);
  using database = new Database(cliArguments.database);

  if (cliArguments.update) {
    await updateDatabase(database, cliArguments.providers, {
      testLessTitles: cliArguments.testLessTitles,
      testTitle: cliArguments.testTitle,
    });
  }

  printRecommendedMedia(database, cliArguments.providers);
}

/** CLI options intended for testing of this program. */
interface TestOptions {
  /**
   * True to test 10% of titles, or a specific seed from a previous usage of
   * this parameter to retry a scenario. Note that if the provider's underlyng
   * titles change, the seed will be worthless.
   */
  testLessTitles: boolean | number;
  /** Will only fetch titles including this substring */
  testTitle: string[] | undefined;
}

/**
 * Updates the database for the given providers.
 * @param database The database to update
 * @param providerStrings List of providers to update on
 * @param testOptions Optional parameters for testing
 */
async function updateDatabase(
  database: Database,
  providerStrings: Providers[],
  testOptions?: TestOptions,
) {
  const providers: Provider[] = [];

  for (const provider of providerStrings) {
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

  console.log("Fetching media list...");
  const mediaFetch = await Promise.allSettled(
    providers.map((provider) =>
      provider.getMedia().then((list) => ({ provider: provider.name, list })),
    ),
  );

  for (const failedPromise of mediaFetch.filter(
    (result) => result.status === "rejected",
  )) {
    if (failedPromise.reason instanceof Error) {
      console.warn(failedPromise.reason.message);
    } else {
      console.warn(
        "Fetching media for a provider failed",
        failedPromise.reason,
      );
    }
  }

  const mediaListByProvider = mediaFetch
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  let mediaToAdd: Media[] = [];
  let mediaToDelete: MediaPrimaryKey[] = [];
  for (const { provider, list } of mediaListByProvider) {
    const { notInDatabase, onlyInDatabase } = database.mediaDiff(
      list,
      provider,
    );

    mediaToAdd = [...mediaToAdd, ...notInDatabase];
    mediaToDelete = [...mediaToDelete, ...onlyInDatabase];
  }

  // If any testing flags are provided, filter the media down
  if (testOptions?.testLessTitles) {
    const seed =
      typeof testOptions.testLessTitles === "number"
        ? testOptions.testLessTitles
        : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

    console.log(
      `[--test-less-titles] providers: ${providers.map((provider) => provider.name).join(", ")} seed: ${seed.toString()}`,
    );

    mediaToAdd = shuffle(mediaToAdd, seed);
    // Take 10% (but at least 1 element)
    const PERCENTAGE = 0.1;
    mediaToAdd = mediaToAdd.slice(
      0,
      Math.max(1, mediaToAdd.length * PERCENTAGE),
    );
  } else if (testOptions?.testTitle) {
    const substrings = testOptions.testTitle;
    mediaToAdd = mediaToAdd.filter((media) =>
      substrings.some((substring) => media.providerTitle.includes(substring)),
    );
    console.log(
      `[--test-titles] Only checking ${mediaToAdd.map((media) => media.providerTitle).join(", ")}`,
    );
  }

  if (mediaToDelete.length > 0) {
    logStyleText(
      "red",
      `Deleting these media (as they are no longer on the provider):\n${mediaToDelete.map((entry) => `- ${entry.providerTitle} (${entry.provider})`).join("\n")}`,
    );

    database.deleteMany(mediaToDelete);
  }

  // For now, anilist is the only ranker. I've set it up so it's easy to expand this in
  // the future

  if (mediaToAdd.length > 0) {
    logStyleText(
      "green",
      `Adding these media:\n${mediaToAdd.map((entry) => `- ${entry.providerTitle} (${entry.provider})`).join("\n")}`,
    );

    const ranker = new Anilist();

    const progressBar = new SingleBar(
      {
        format: `{bar} {percentage}% | ETA: {eta_formatted} | {value}/{total} | Currently Searching: {title}`,
        stopOnComplete: true,
        clearOnComplete: true,
        hideCursor: true,
        gracefulExit: true,
      },
      Presets.shades_grey,
    );
    progressBar.start(mediaToAdd.length, 0);

    for (const media of mediaToAdd) {
      progressBar.update({ title: media.providerTitle });
      const rank = await ranker.getRanking(media);

      progressBar.increment();

      database.insert({
        ...media,
        ...rank,
      });
    }
    console.log(
      `\nWrote all results (including those below ${SCORE_THRESHOLD.toString()}) to ${database.path}`,
    );
  }
}

/**
 * Prints media above the SCORE_THRESHOLD for the given providers.
 * @param database The database to fetch information from
 * @param providers The providers to get information for
 */
function printRecommendedMedia(database: Database, providers: Providers[]) {
  for (const provider of providers) {
    console.log(`On ${provider}, you should check out:`);
    for (const media of database.getAll({
      rank: { minimumScore: SCORE_THRESHOLD },
      provider: provider,
    })) {
      console.log(
        `- ${media.providerTitle}${media.startDate ? ` (${media.startDate.getFullYear().toString()})` : ""} - ${media.score.toString()}`,
      );
    }
    console.log(); // newline

    const noRank = database.getAll({ rank: false, provider: provider });
    if (noRank.length > 0) {
      console.warn(
        `Anilist couldn't find a ranking for:\n${noRank.map((t) => `- ${t.providerTitle}`).join("\n")}\n`,
      );
      if (provider === "Netflix") {
        console.warn(
          "Please note that Netflix labels a lot of content as 'Anime' when it isn't considered as such by Anilist.\n",
        );
      }
    }
  }
}

await main();
