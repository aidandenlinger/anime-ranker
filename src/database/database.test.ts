import {
  type TestContext,
  afterEach,
  beforeEach,
  suite,
  test,
} from "node:test";
import { Database } from "./database.ts";
import type { RankedVideo } from "./ranked-video.ts";

// This is a demonstration of how to use the DB class.
suite("Database testing", () => {
  /** At the start of each test, points to a new, empty database. */
  let database: Database;

  /** Before each test, point to a new in-memory database. */
  beforeEach(() => {
    database = new Database(":memory:");
  });

  test("Adding and listing rankings", (t: TestContext) => {
    database.insert(rank85StartsWithG);

    // We can insert and retrieve from the database
    t.assert.deepStrictEqual(database.getAll(), [rank85StartsWithG]);

    // Inserting rank 82 *after* rank 79, to assert that ordering is unique to insertion order
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

  test("Filtering listed rankings", (t: TestContext) => {
    database.insertMany([
      rank85StartsWithG,
      rank82StartsWithS,
      rank79StartsWithO,
      rank79StartsWithR,
      undefinedScore,
    ]);

    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- these tests are checking that our typing is correct, so we need to make "unnecessary" conditions because we're assuming the types are wrong. */
    // Provider only:
    t.assert.ok(
      database.getAll({ provider: "Hulu" }).every((r) => r.provider === "Hulu"),
    );
    t.assert.ok(
      database
        .getAll({ provider: "Netflix" })
        .every((r) => r.provider === "Netflix"),
    );

    // Score only:
    t.assert.ok(
      database
        .getAll({ minimumScore: 80 })
        .every((r) => r.score !== undefined && r.score >= 80),
    );

    // Provider and score:
    t.assert.ok(
      database
        .getAll({ minimumScore: 80, provider: "Hulu" })
        .every(
          (r) =>
            r.score !== undefined && r.score >= 80 && r.provider === "Hulu",
        ),
    );

    t.assert.ok(
      database
        .getAll({ minimumScore: 80, provider: "Netflix" })
        .every(
          (r) =>
            r.score !== undefined && r.score >= 80 && r.provider === "Netflix",
        ),
    );
    /* eslint-enable @typescript-eslint/no-unnecessary-condition -- we are done with the filter tests */
  });

  afterEach(() => {
    database.close();
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
