import { type TestContext, after, before, suite, test } from "node:test";
import { Database } from "./database.ts";
import type { RankedVideo } from "./ranked-video.ts";
import { rm } from "node:fs/promises";

// This is a demonstration of how to use the DB class.
suite("DB testing", () => {
  let database: Database;
  const DB_PATH = "unit-test.sqlite";

  before(() => {
    database = new Database(DB_PATH);
  });

  test("DB usage example", (t: TestContext) => {
    database.insert(rank85StartsWithG);

    // We can insert and retrieve from the database
    t.assert.deepStrictEqual(database.getAll(), [rank85StartsWithG]);

    database.insert(rank79StartsWithR);
    database.insert(rank82StartsWithS);

    // When we get all, we sort by score.
    // Note that if we were sorting alphabetically, R would come before S, so this asserts score is our primary sort.
    t.assert.deepStrictEqual(database.getAll(), [
      rank85StartsWithG,
      rank82StartsWithS,
      rank79StartsWithR,
    ]);

    database.insert(rank79StartsWithO);

    // We first sort by score, *then* sort by title - we observe this via the entries with a tied 79 rank.
    t.assert.deepStrictEqual(database.getAll(), [
      rank85StartsWithG,
      rank82StartsWithS,
      rank79StartsWithO,
      rank79StartsWithR,
    ]);

    // The zod codec is set up to convert an undefined score to null, and convert it back to undefined when reading from the db.
    // Ensure this behavior works as expected by adding and reading back an entry without a score, and asserting it's at the end of the list.

    database.insert(undefinedScore);
    t.assert.deepStrictEqual(database.getAll(), [
      rank85StartsWithG,
      rank82StartsWithS,
      rank79StartsWithO,
      rank79StartsWithR,
      undefinedScore,
    ]);

    // Adding a video with the same providerTitle and provider should fail
    t.assert.throws(() => {
      database.insert(undefinedScore);
    });
  });

  // Ensure DB is deleted
  after(async () => {
    database.close();
    await rm(DB_PATH, { force: true });
  });
});

// Test data

const rank85StartsWithG: RankedVideo = {
  providerTitle: "Gurren Lagann",
  providerURL: new URL(
    "https://hulu.com/series/gurren-lagann-6ea27f41-e422-4c58-8e06-9ad1602903b7",
  ),
  type: "TV",
  provider: "Hulu",
  score: 85,
  rankerTitle: "Gurren Lagann",
  rankerURL: new URL("https://anilist.co/anime/2001"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-10-13T02:24:43.409Z"),
};

const rank82StartsWithS: RankedVideo = {
  providerTitle: "Suzume",
  providerURL: new URL("https://netflix.com/title/81696498"),
  type: "MOVIE",
  provider: "Netflix",
  score: 82,
  rankerTitle: "Suzume",
  rankerURL: new URL("https://anilist.co/anime/142770"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-10-06T05:29:15.192Z"),
};

const rank79StartsWithO: RankedVideo = {
  providerTitle: "One Piece Film Z",
  providerURL: new URL("https://netflix.com/title/80198443"),
  type: "MOVIE",
  provider: "Netflix",
  score: 79,
  rankerTitle: "One Piece Film: Z",
  rankerURL: new URL("https://anilist.co/anime/12859"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-10-06T05:29:41.304Z"),
};

const rank79StartsWithR: RankedVideo = {
  providerTitle: "Romantic Killer",
  providerURL: new URL("https://netflix.com/title/81318888"),
  type: "TV",
  provider: "Netflix",
  score: 79,
  rankerTitle: "Romantic Killer",
  rankerURL: new URL("https://anilist.co/anime/153930"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-10-06T05:15:32.534Z"),
};

const undefinedScore: RankedVideo = {
  providerTitle: "Digimon Beatbreak",
  providerURL: new URL(
    "https://hulu.com/series/digimon-beatbreak-4c47f9ab-f6b8-45ec-8fb9-fbd5ed1a5529",
  ),
  type: "TV",
  provider: "Hulu",
  score: undefined,
  rankerTitle: "DIGIMON BEATBREAK",
  rankerURL: new URL("https://anilist.co/anime/188388"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-10-06T05:28:27.684Z"),
};
