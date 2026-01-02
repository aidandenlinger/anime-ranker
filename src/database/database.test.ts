import type { MaybeRankedMedia, ScoredMedia } from "./media-schema.ts";
import {
  type TestContext,
  afterEach,
  beforeEach,
  suite,
  test,
} from "node:test";
import { Database } from "./database.ts";

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
    // It also works for media without any rank at all
    // Ensure this behavior works as expected by adding and reading back an entry without a score, and asserting it's at the end of the list.

    database.insertMany([undefinedScore, noRank]);
    t.assert.deepStrictEqual(database.getAll(), [
      rank85StartsWithG,
      rank82StartsWithS,
      rank79StartsWithO,
      rank79StartsWithR,
      undefinedScore,
      noRank,
    ]);

    // We can add rank85 again, on a different provider, and it will use the same ranking entry that's already in the DB
    database.insert(rank85StartsWithGOnNetflix);
    t.assert.deepStrictEqual(database.getAll(), [
      rank85StartsWithG,
      rank85StartsWithGOnNetflix,
      rank82StartsWithS,
      rank79StartsWithO,
      rank79StartsWithR,
      undefinedScore,
      noRank,
    ]);

    // We can delete media (it's backed up in the Deleted table)
    database.deleteMany([rank85StartsWithGOnNetflix, rank82StartsWithS]);
    t.assert.deepStrictEqual(database.getAll(), [
      rank85StartsWithG,
      rank79StartsWithO,
      rank79StartsWithR,
      undefinedScore,
      noRank,
    ]);

    // We can't delete media that isn't in the database
    t.assert.throws(() => {
      database.deleteMany([rank85StartsWithGOnNetflix, rank82StartsWithS]);
    });

    // Adding media with the same providerTitle and provider should fail
    t.assert.throws(() => {
      database.insert(undefinedScore);
    });

    // We can delete media that has a colon in its title
    // (was a problem because I use colons as a separator during deletion)
    database.insert(hasColonInTitle);
    database.delete(hasColonInTitle);

    // We can't add a show without an existing ranking
    t.assert.throws(() => {
      database.insert(pointingToInvalidRank);
    });

    // We can't add a show with invalid scores
    t.assert.throws(() => {
      database.insert({
        ...rank82StartsWithS,
        providerTitle: "unique title",
        score: -1,
      });
    });

    t.assert.throws(() => {
      database.insert({
        ...rank82StartsWithS,
        providerTitle: "unique title",
        score: 101,
      });
    });
  });

  test("Filtering listed rankings", (t: TestContext) => {
    database.insertMany([
      rank85StartsWithG,
      rank82StartsWithS,
      rank79StartsWithO,
      rank79StartsWithR,
      undefinedScore,
      noRank,
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
        .getAll({ rank: { minimumScore: 80 } })
        .every((r) => r.score !== undefined && r.score >= 80),
    );

    t.assert.ok(
      database.getAll({ rank: true }).every((r) => r.score !== undefined),
    );

    t.assert.ok(
      database.getAll({ rank: false }).every(
        (r) =>
          // @ts-expect-error -- our types declare that there shouldn't be a score here, we want to make sure
          r.score === undefined,
      ),
    );

    // Provider and score:
    t.assert.ok(
      database
        .getAll({ rank: { minimumScore: 80 }, provider: "Hulu" })
        .every(
          (r) =>
            r.score !== undefined && r.score >= 80 && r.provider === "Hulu",
        ),
    );

    t.assert.ok(
      database
        .getAll({ rank: true, provider: "Hulu" })
        .every((r) => r.score !== undefined && r.provider === "Hulu"),
    );

    t.assert.ok(
      database.getAll({ rank: false, provider: "Hulu" }).every(
        (r) =>
          // @ts-expect-error -- our types declare that there shouldn't be a score here, we want to make sure
          r.score === undefined && r.provider === "Hulu",
      ),
    );

    t.assert.ok(
      database
        .getAll({ rank: { minimumScore: 80 }, provider: "Netflix" })
        .every(
          (r) =>
            r.score !== undefined && r.score >= 80 && r.provider === "Netflix",
        ),
    );

    t.assert.ok(
      database
        .getAll({ rank: true, provider: "Netflix" })
        .every((r) => r.score !== undefined && r.provider === "Netflix"),
    );

    t.assert.ok(
      database.getAll({ rank: false, provider: "Netflix" }).every(
        (r) =>
          // @ts-expect-error -- our types declare that there shouldn't be a score here, we want to make sure
          r.score === undefined && r.provider === "Netflix",
      ),
    );
    /* eslint-enable @typescript-eslint/no-unnecessary-condition -- we are done with the filter tests */
  });

  test("Diffing", (t: TestContext) => {
    // We can diff the database against a different list.
    // This allows us to see the operations needed to make
    // the database match new data and only fetch new data.
    database.insertMany([
      rank85StartsWithG, // Hulu
      rank85StartsWithGOnNetflix, // Netflix
    ]);

    const { inBoth, onlyInDatabase, notInDatabase } = database.mediaDiff([
      rank85StartsWithG, // this is in both
      rank82StartsWithS, // this is not in the DB
      // and rank85StartsWithGOnNetflix is only in the DB
    ]);

    // To make the DB equal the new state: don't need to do anything here
    t.assert.deepStrictEqual(inBoth, [rank85StartsWithG]);

    // Note that "only in DB" only returns the key, rather than the full data.
    // Delete these titles if you want the database to match the new data.
    t.assert.deepStrictEqual(onlyInDatabase, [
      {
        provider: rank85StartsWithGOnNetflix.provider,
        providerTitle: rank85StartsWithGOnNetflix.providerTitle,
      },
    ]);

    // Fetch data and add this title if you want the database to match the new data.
    t.assert.deepStrictEqual(notInDatabase, [rank82StartsWithS]);

    // This will also work on provider subsets
    const huluDiff = database.mediaDiff([rank85StartsWithG], "Hulu");

    t.assert.deepStrictEqual(huluDiff.inBoth, [rank85StartsWithG]);
    t.assert.deepStrictEqual(huluDiff.notInDatabase, []);
    // If we were considering Netflix titles, this would have an entry
    t.assert.deepStrictEqual(huluDiff.onlyInDatabase, []);

    const netflixDiff = database.mediaDiff([rank82StartsWithS], "Netflix");

    t.assert.deepStrictEqual(netflixDiff.inBoth, []);
    t.assert.deepStrictEqual(netflixDiff.notInDatabase, [rank82StartsWithS]);
    // If we were considering Hulu titles, this would have a hulu entry
    t.assert.deepStrictEqual(netflixDiff.onlyInDatabase, [
      {
        provider: rank85StartsWithGOnNetflix.provider,
        providerTitle: rank85StartsWithGOnNetflix.providerTitle,
      },
    ]);
  });

  afterEach(() => {
    // NOTE: You can avoid having to close the database manually
    // via explicit resource management:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Resource_management#the_using_and_await_using_declarations
    database.close();
  });
});

// Test data

const rank85StartsWithG = {
  providerTitle: "Gurren Lagann",
  providerURL: new URL(
    "https://hulu.com/series/gurren-lagann-6ea27f41-e422-4c58-8e06-9ad1602903b7",
  ),
  type: "TV" as const,
  provider: "Hulu" as const,
  score: 85,
  rankerTitle: "Gurren Lagann",
  rankerURL: new URL("https://anilist.co/anime/2001"),
  ranker: "Anilist" as const,
  lastUpdated: new Date("2025-10-13T02:24:43.409Z"),
  rankId: "Anilist:2001" as const,
  poster: new URL(
    "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2001-XwRnjzGeFWRQ.png",
  ),
  genres: ["Action", "Comedy", "Drama", "Mecha", "Romance", "Sci-Fi"],
  description:
    "In a far away future, mankind lives underground in huge caves, unknowing of a world above with a sky and stars.",
  startDate: new Date(2007, 3, 1),
};

const rank85StartsWithGOnNetflix = {
  providerTitle: "Gurren Lagann",
  providerURL: new URL("https://www.netflix.com/title/70213196"),
  type: "TV" as const,
  provider: "Netflix" as const,
  score: 85,
  rankerTitle: "Gurren Lagann",
  rankerURL: new URL("https://anilist.co/anime/2001"),
  ranker: "Anilist" as const,
  lastUpdated: new Date("2025-10-13T02:24:43.409Z"),
  rankId: "Anilist:2001" as const,
  poster: new URL(
    "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2001-XwRnjzGeFWRQ.png",
  ),
  genres: ["Action", "Comedy", "Drama", "Mecha", "Romance", "Sci-Fi"],
  description:
    "In a far away future, mankind lives underground in huge caves, unknowing of a world above with a sky and stars.",
  startDate: new Date(2007, 3, 1),
};

const rank82StartsWithS = {
  providerTitle: "Suzume",
  providerURL: new URL("https://netflix.com/title/81696498"),
  type: "MOVIE" as const,
  provider: "Netflix" as const,
  score: 82,
  rankerTitle: "Suzume",
  rankerURL: new URL("https://anilist.co/anime/142770"),
  ranker: "Anilist" as const,
  lastUpdated: new Date("2025-10-06T05:29:15.192Z"),
  rankId: "Anilist:142770" as const,
  poster: new URL("https://example.com"),
  genres: [],
  description: undefined,
  startDate: undefined,
};

const hasColonInTitle: ScoredMedia = {
  providerTitle: "Pokemon: Arceus and The Jewel of Life",
  providerURL: new URL(
    "https://hulu.com/movie/pokemon-arceus-and-the-jewel-of-life-bd26295f-ed1b-4673-8308-ed51bd0d4d7f",
  ),
  type: "MOVIE",
  provider: "Hulu",
  score: 68,
  rankerTitle: "Pokémon: Arceus and the Jewel of Life",
  rankerURL: new URL("https://anilist.co/anime/6178"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-11-07T18:14:15.495Z"),
  rankId: "Anilist:6178",
  poster: new URL(
    "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/b6178-QtPWVxYMR2V5.png",
  ),
  genres: ["Action", "Adventure", "Comedy", "Fantasy"],
  description: undefined,
  startDate: new Date("2009-07-18T07:00:00.000"),
};

const rank79StartsWithO: ScoredMedia = {
  providerTitle: "One Piece Film Z",
  providerURL: new URL("https://netflix.com/title/80198443"),
  type: "MOVIE",
  provider: "Netflix",
  score: 79,
  rankerTitle: "One Piece Film: Z",
  rankerURL: new URL("https://anilist.co/anime/12859"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-10-06T05:29:41.304Z"),
  rankId: "Anilist:80198443",
  poster: new URL("https://example.com"),
  genres: [],
  description: undefined,
  startDate: undefined,
};

const rank79StartsWithR: ScoredMedia = {
  providerTitle: "Romantic Killer",
  providerURL: new URL("https://netflix.com/title/81318888"),
  type: "TV",
  provider: "Netflix",
  score: 79,
  rankerTitle: "Romantic Killer",
  rankerURL: new URL("https://anilist.co/anime/153930"),
  ranker: "Anilist",
  lastUpdated: new Date("2025-10-06T05:15:32.534Z"),
  rankId: "Anilist:81318888",
  poster: new URL("https://example.com"),
  genres: [],
  description: undefined,
  startDate: undefined,
};

const undefinedScore: MaybeRankedMedia = {
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
  rankId: "Anilist:188388",
  poster: new URL("https://example.com"),
  genres: [],
  description: undefined,
  startDate: undefined,
};

const noRank: MaybeRankedMedia = {
  providerTitle: "Tokyo Vice",
  providerURL: new URL(
    "https://www.hulu.com/series/tokyo-vice-df9910a9-2102-4a99-818b-cd2ea6b7e5fa",
  ),
  type: "TV",
  provider: "Hulu",
  rankId: undefined,
  lastUpdated: undefined,
  ranker: undefined,
  rankerTitle: undefined,
  rankerURL: undefined,
  score: undefined,
  poster: undefined,
  genres: undefined,
  description: undefined,
  startDate: undefined,
};

const pointingToInvalidRank: MaybeRankedMedia = {
  rankId: "Anilist:0", // this is what we're testing - we shouldn't be able to add this
  providerTitle: "dummy entry",
  providerURL: new URL("https://www.example.com"),
  type: "TV",
  provider: "Hulu",
  lastUpdated: new Date("2025-10-18T05:59:27.684Z"),
};
