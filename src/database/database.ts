// eslint-disable-next-line n/no-unsupported-features/node-builtins -- I'm actively choosing to use this experimental feature to avoid a dependency
import { DatabaseSync, type SQLTagStore } from "node:sqlite";
import {
  type MaybeRankedMedia,
  type ScoredMedia,
  createMediaTable,
  createRanksTable,
  maybeRankedMediaSchema,
  mediaAndRankIdSchema,
  rankSchema,
} from "./media-schema.ts";
import type { Media, Providers } from "../providers/provider.ts";
import { P, match } from "ts-pattern";
import type { Rank } from "../rankers/ranker.ts";
import assert from "node:assert/strict";

/**
 * Class to add and list entries from a database. Use explicit resource management or close it when you're done.
 */
export class Database {
  /** The filepath of this database. */
  readonly path: string;

  /** Our interface to perform SQL queries. */
  readonly #sql: SQLTagStore;

  // TODO: follow the outcome of https://github.com/nodejs/node/issues/60448, I may get to delete this
  /** Our SQL database. */
  readonly #db: DatabaseSync;

  /**
   * @param databasePath A filepath to write a new or load an old database,
   * or the string ":memory:" for a non-persistent, in memory database.
   */
  constructor(databasePath: string) {
    this.path = databasePath;
    this.#db = new DatabaseSync(databasePath);
    this.#sql = this.#db.createTagStore();

    // NOTE: Ranks must be created first because Media has a `REFERENCES` to Ranks
    this.#db.exec(createRanksTable);
    this.#db.exec(createMediaTable);
  }

  /**
   * @param entry Video to add to the database
   * @throws {Error} if media with the same providerTitle and provider is in the database
   */
  insert(entry: MaybeRankedMedia) {
    // NOTE: Ranks must be created first because Media has a `REFERENCES` to Ranks
    // TODO(rank-zod): This validation is silly but I'm lazy and it typechecks, would be nice
    // to handle it in zod instead
    if (
      entry.rankId &&
      entry.rankerTitle &&
      entry.rankerURL &&
      entry.ranker &&
      entry.lastUpdated
    ) {
      const { rankId, rankerTitle, rankerURL, score, ranker, lastUpdated } =
        rankSchema.encode({
          rankId: entry.rankId,
          rankerTitle: entry.rankerTitle,
          rankerURL: entry.rankerURL,
          score: entry.score,
          ranker: entry.ranker,
          lastUpdated: entry.lastUpdated,
        });

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- we don't care to learn about the resulting changes here
      this.#sql.run`
        INSERT INTO Ranks (
            "rankId",
            "rankerTitle",
            "rankerURL",
            "score",
            "ranker",
            "lastUpdated"
        )
        VALUES (
            ${rankId},
            ${rankerTitle},
            ${rankerURL},
            ${score},
            ${ranker},
            ${lastUpdated}
        )
        ON CONFLICT ("rankId")
        DO UPDATE SET
            "score" = "excluded"."score",
            "lastUpdated" = "excluded"."lastUpdated"
      `;
      // TODO: only update when excluded.lastUpdated > lastUpdated
    }

    const { providerTitle, type, providerURL, provider, rankId } =
      mediaAndRankIdSchema.encode(entry);

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- we don't care to learn about the resulting changes here
    this.#sql.run`
      INSERT INTO Media (
          providerTitle,
          type,
          providerURL,
          provider,
          rankId
      )
      VALUES (
          ${providerTitle},
          ${type},
          ${providerURL},
          ${provider},
          ${rankId}
      )
    `;
  }

  /**
   * Insert multiple media into the database in one transaction.
   * @param mediaList The media to add
   * @throws {Error} if media with the same providerTitle and provider is in the database
   */
  insertMany(mediaList: MaybeRankedMedia[]) {
    this.#db.exec("BEGIN TRANSACTION");
    for (const media of mediaList) {
      this.insert(media);
    }
    this.#db.exec("COMMIT");
  }

  /**
   * Get all with a minimum score defined - score cannot be undefined.
   * @param options Optional criteria that the listed media must fufill
   * @returns All media with a rank
   */
  getAll<Provider extends Providers>(options: {
    /** Entry must have a rank. */
    rank: true;
    /** A provider that the entries must be on. */
    provider?: Provider;
  }): (Media<Provider> & Rank)[];

  /**
   * Get all with a minimum score defined - score cannot be undefined.
   * @param options Optional criteria that the listed media must fufill
   * @returns All media with a minimum score
   */
  getAll<Provider extends Providers>(options: {
    /** Entry must have a score. */
    rank: {
      /** A minimum score for an entry to have. */
      minimumScore: number;
    };
    /** A provider that the entries must be on. */
    provider?: Provider;
  }): ScoredMedia<Provider>[];

  /**
   * @param options Optional criteria that the listed media must fufill
   * @returns All media meeting the criteria
   */
  getAll<Provider extends Providers>(options: {
    /** Entries without a rank. */
    rank: false;
    /** A provider that the entries must be on. */
    provider?: Provider;
  }): Media<Provider>[];

  /**
   * @param options Optional criteria that the listed media must fufill
   * @returns All RankedVideos meeting the criteria
   */
  getAll(options?: GetAllOptions): MaybeRankedMedia[];

  /**
   * @param options Optional criteria that the listed media must fufill
   * @returns All RankedVideos meeting the criteria
   */
  getAll(options?: GetAllOptions) {
    const results = match([options?.provider, options?.rank])
      .with(
        [undefined, undefined],
        () =>
          this.#sql.all`
            SELECT
                Media.*,
                Ranks.*
            FROM Media
            LEFT OUTER JOIN Ranks USING ("rankId")
            ORDER BY
                Ranks."score" DESC NULLS LAST,
                Media."providerTitle" ASC,
                Media."provider" ASC
          `,
      )
      .with(
        [P.nonNullable.select(), undefined],
        (provider) =>
          this.#sql.all`
            SELECT
                Media.*,
                Ranks.*
            FROM Media
            LEFT OUTER JOIN Ranks USING ("rankId")
            WHERE provider = ${provider}
            ORDER BY
                Ranks."score" DESC NULLS LAST,
                Media."providerTitle" ASC,
                Media."provider" ASC
          `,
      )
      .with(
        [undefined, P.union(true, { minimumScore: P.nonNullable.select() })],
        (minimumScore) =>
          this.#sql.all`
            SELECT
                Media.*,
                Ranks.*
            FROM Media
            INNER JOIN Ranks USING ("rankId")
            WHERE score >= ${minimumScore ?? 0}
            ORDER BY
                Ranks."score" DESC NULLS LAST,
                Media."providerTitle" ASC,
                Media."provider" ASC
          `,
      )
      .with(
        [undefined, false],
        () =>
          this.#sql.all`
            SELECT *
            FROM Media
            WHERE "rankId" IS NULL
            ORDER BY "providerTitle" ASC, "provider" ASC
        `,
      )
      .with(
        [P.nonNullable.select(), false],
        (provider) =>
          this.#sql.all`
            SELECT *
            FROM Media
            WHERE
                "provider" = ${provider}
                AND "rankId" IS NULL
            ORDER BY "providerTitle" ASC, "provider" ASC
          `,
      )
      .with(
        [P.nonNullable, P.union(true, { minimumScore: P.nonNullable })],
        ([provider, scoreOptions]) =>
          this.#sql.all`
            SELECT
                Media.*,
                Ranks.*
            FROM Media
            LEFT OUTER JOIN Ranks USING ("rankId")
            WHERE
                provider = ${provider}
                AND score >= ${typeof scoreOptions === "boolean" ? 0 : scoreOptions.minimumScore}
            ORDER BY
                Ranks."score" DESC NULLS LAST,
                Media."providerTitle" ASC,
                Media."provider" ASC
          `,
      )
      .exhaustive()
      .map((result) => {
        // TODO(rank-zod): handle null in zod only
        const nullToUndefined = Object.fromEntries(
          Object.entries(result).map(([key, value]) => [
            key,
            value ?? undefined,
          ]),
        );
        return maybeRankedMediaSchema.parse(nullToUndefined);
      });

    // Some runtime asserts to ensure our typing is correct, and catch any errors if we change the SQL statements.
    if (options?.provider) {
      const provider = options.provider;
      assert.ok(results.every((r) => r.provider === provider));
    }

    if (options?.rank === false) {
      assert.ok(results.every((r) => r.score === undefined));
    } else if (options?.rank) {
      const minimumScore =
        typeof options.rank === "boolean" ? 0 : options.rank.minimumScore;
      assert.ok(
        results.every((r) => r.score !== undefined && r.score >= minimumScore),
      );
    }

    return results;
  }

  /**
   * NOTE: You could avoid calling this function manually
   * by using explicit resource management instead:
   * `using database = new Database(...)` will automatically close
   * the database at the end of its scope.
   *
   * Closes the connection to the database.
   * This should be called if resource management wasn't used and you're
   * done with the database!
   * The database is unusable after this is called.
   */
  close() {
    if (this.#db.isOpen) {
      this.#db.close();
    }
  }

  /**
   * Closes the connection to the database when done.
   */
  [Symbol.dispose]() {
    this.close();
  }
}

/** Optional filters for retrieving rankings. */
type GetAllOptions<Provider extends Providers = Providers> = Readonly<{
  /** Enforce that media has or doesn't have a rank, or what the minimum score must be. */
  rank?:
    | boolean
    | {
        /** A minimum score an entry must have to be listed. */
        minimumScore: number;
      };
  /** An optional provider for listed media. */
  provider?: Provider;
}>;
