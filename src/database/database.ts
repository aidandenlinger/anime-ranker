// eslint-disable-next-line n/no-unsupported-features/node-builtins -- I'm actively choosing to use this experimental feature to avoid a dependency
import { DatabaseSync, type SQLTagStore } from "node:sqlite";
import {
  type MaybeRankedMedia,
  type RankedMedia,
  createRankedMediaTable,
  maybeRankedMediaSchema,
} from "./media-schema.ts";
import { P, match } from "ts-pattern";
import type { Providers } from "../providers/provider.ts";
import assert from "node:assert/strict";

/**
 * Class to add and list entries from a database. It must be closed when operations are done!
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
    // eslint-disable-next-line n/no-sync -- there is no async sqlite3 library at the moment
    this.#db = new DatabaseSync(databasePath);
    this.#sql = this.#db.createTagStore();

    this.#db.exec(createRankedMediaTable);
  }

  /**
   * @param media Video to add to the database
   * @throws {Error} if media with the same providerTitle and provider is in the database
   */
  insert(media: MaybeRankedMedia) {
    const {
      providerTitle,
      type,
      providerURL,
      provider,
      rankerTitle,
      rankerURL,
      score,
      ranker,
      lastUpdated,
    } = maybeRankedMediaSchema.encode(media);

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- we don't care to learn about the resulting changes here
    this.#sql.run`
      INSERT INTO Ranks (
          providerTitle,
          type,
          providerURL,
          provider,
          rankerTitle,
          rankerURL,
          score,
          ranker,
          lastUpdated
      )
      VALUES (
          ${providerTitle},
          ${type},
          ${providerURL},
          ${provider},
          ${rankerTitle},
          ${rankerURL},
          ${score},
          ${ranker},
          ${lastUpdated}
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
   * @returns All RankedVideos with a minimum score
   */
  getAll<Provider extends Providers>(options: {
    /** Entry must have a score. */
    score:
      | true
      | {
          /** A minimum score for an entry to have. */
          minimumScore: number;
        };
    /** A provider that the entries must be on. */
    provider?: Provider;
  }): RequiredProperty<RankedMedia<Provider>, "score">[];

  /**
   * @param options Optional criteria that the listed media must fufill
   * @returns All RankedVideos meeting the criteria
   */
  getAll<Provider extends Providers>(
    options?: GetAllOptions<Provider>,
  ): MaybeRankedMedia<Provider>[];

  /**
   * @param options Optional criteria that the listed media must fufill
   * @returns All RankedVideos meeting the criteria
   */
  getAll(options?: GetAllOptions) {
    const results = match([options?.provider, options?.score])
      .with(
        [undefined, undefined],
        () =>
          this.#sql.all`
            SELECT * FROM Ranks
            ORDER BY score DESC, providerTitle ASC
          `,
      )
      .with(
        [P.nonNullable.select(), undefined],
        (provider) =>
          this.#sql.all`
            SELECT * FROM Ranks
            WHERE provider = ${provider}
            ORDER BY score DESC, providerTitle ASC
          `,
      )
      .with(
        [undefined, P.union(true, { minimumScore: P.nonNullable.select() })],
        (minimumScore) =>
          this.#sql.all`
            SELECT * FROM Ranks
            WHERE score >= ${minimumScore ?? 0}
            ORDER BY score DESC, providerTitle ASC
          `,
      )
      .with(
        [undefined, false],
        () =>
          this.#sql.all`
          SELECT * FROM Ranks
          WHERE score IS NULL
          ORDER BY score DESC, providerTitle ASC
        `,
      )
      .with(
        [P.nonNullable.select(), false],
        (provider) =>
          this.#sql.all`
            SELECT * FROM Ranks
            WHERE
                provider = ${provider}
                AND score IS NULL
            ORDER BY score DESC, providerTitle ASC
          `,
      )
      .with(
        [P.nonNullable, P.union(true, { minimumScore: P.nonNullable })],
        ([provider, scoreOptions]) =>
          this.#sql.all`
            SELECT * FROM Ranks
            WHERE
                provider = ${provider}
                AND score >= ${typeof scoreOptions === "boolean" ? 0 : scoreOptions.minimumScore}
            ORDER BY score DESC, providerTitle ASC
          `,
      )
      .exhaustive()
      .map((result) => maybeRankedMediaSchema.parse(result));

    // Some runtime asserts to ensure our typing is correct, and catch any errors if we change the SQL statements.
    if (options?.provider) {
      const provider = options.provider;
      assert.ok(results.every((r) => r.provider === provider));
    }

    if (options?.score === false) {
      assert.ok(results.every((r) => r.score === undefined));
    } else if (options?.score) {
      const minimumScore =
        typeof options.score === "boolean" ? 0 : options.score.minimumScore;
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
  /** Enforce that media has or doesn't have a score, or what the minimum score must be. */
  score?:
    | boolean
    | {
        /** A minimum score an entry must have to be listed. */
        minimumScore: number;
      };
  /** An optional provider for listed media. */
  provider?: Provider;
}>;

/** Utility type to make a field optional and non nullable. Based on https://stackoverflow.com/a/53050575 */
type RequiredProperty<Type, Key extends keyof Type> = {
  [Property in Key]-?: Required<NonNullable<Type[Property]>>;
} & Omit<Type, Key>;
