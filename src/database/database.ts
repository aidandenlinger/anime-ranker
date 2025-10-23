import {
  type MaybeRankedMedia,
  type RankedMedia,
  createRankedMediaTable,
  maybeRankedMediaSchema,
} from "./media-schema.ts";
import { P, match } from "ts-pattern";
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- I'm actively choosing to use this experimental feature to avoid a dependency
import { DatabaseSync } from "node:sqlite";
import type { Providers } from "../providers/provider.ts";
import assert from "node:assert/strict";

/**
 * Class to add and list entries from a database. It must be closed when operations are done!
 */
export class Database {
  /** The filepath of this database. */
  readonly path: string;

  /** Our connection to the database which actually lets us read/write. */
  readonly #conn: DatabaseSync;

  // TODO: when @types/node updates, migrate to using SQLTagStore and set minimum node version to 24.9
  /** A cache of our prepared statements, to allow for efficent reuse. */
  readonly #preparedStatements;

  /**
   * @param databasePath A filepath to write a new or load an old database,
   * or the string ":memory:" for a non-persistent, in memory database.
   */
  constructor(databasePath: string) {
    this.path = databasePath;
    this.#conn = new DatabaseSync(databasePath);
    this.#conn.exec(createRankedMediaTable);
    // Compile our statements ahead of time
    this.#preparedStatements = {
      insert: this.#conn.prepare(this.#insertStatement),
      getAll: this.#conn.prepare(this.#getAll),
      getAllProvider: this.#conn.prepare(this.#getAllProvider),
      getAllProviderNoScore: this.#conn.prepare(this.#getAllProviderNoScore),
      getAllNoScore: this.#conn.prepare(this.#getAllNoScore),
      getAllMinimumScore: this.#conn.prepare(this.#getAllMinimumScore),
      getAllProviderMininimumScore: this.#conn.prepare(
        this.#getAllProviderMinimumScore,
      ),
    };
  }

  /** SQL statement to insert a given RankedVideo into the SQL database. */
  readonly #insertStatement = `
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
        :providerTitle,
        :type,
        :providerURL,
        :provider,
        :rankerTitle,
        :rankerURL,
        :score,
        :ranker,
        :lastUpdated
    )
  `;

  /**
   * @param media Video to add to the database
   * @throws {Error} if media with the same providerTitle and provider is in the database
   */
  insert(media: MaybeRankedMedia) {
    this.#preparedStatements.insert.run(maybeRankedMediaSchema.encode(media));
  }

  /**
   * Insert multiple media into the database in one transaction.
   * @param mediaList The media to add
   * @throws {Error} if media with the same providerTitle and provider is in the database
   */
  insertMany(mediaList: MaybeRankedMedia[]) {
    this.#conn.exec("BEGIN TRANSACTION");
    for (const media of mediaList) {
      this.insert(media);
    }
    this.#conn.exec("COMMIT");
  }

  /** SQL statement to get all rankings from the SQL database. */
  readonly #getAll = `
    SELECT * FROM Ranks
    ORDER BY score DESC, providerTitle ASC
  `;

  /** SQL statement to get all rankings from a certain provider. */
  readonly #getAllProvider = `
    SELECT * FROM Ranks
    WHERE provider = :provider
    ORDER BY score DESC, providerTitle ASC
  `;

  /** SQL statement to get all entries for a provider without a score */
  readonly #getAllProviderNoScore = `
    SELECT * FROM Ranks
    WHERE
        provider = :provider
        AND score IS NULL
    ORDER BY score DESC, providerTitle ASC
  `;

  /** SQL statement to get all rankings with a minimum score. */
  readonly #getAllMinimumScore = `
    SELECT * FROM Ranks
    WHERE score >= :minimumScore
    ORDER BY score DESC, providerTitle ASC
  `;

  /** SQL statement to get all entries lacking a score. */
  readonly #getAllNoScore = `
    SELECT * FROM Ranks
    WHERE score IS NULL
    ORDER BY score DESC, providerTitle ASC
  `;

  /** SQL statement to get all rankings with a certain provider and a minimum score. */
  readonly #getAllProviderMinimumScore = `
    SELECT * FROM Ranks
    WHERE
        provider = :provider
        AND score >= :minimumScore
    ORDER BY score DESC, providerTitle ASC
  `;

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
      .with([undefined, undefined], () => this.#preparedStatements.getAll.all())
      .with([P.nonNullable.select(), undefined], (provider) =>
        this.#preparedStatements.getAllProvider.all({ provider }),
      )
      .with(
        [undefined, P.union(true, { minimumScore: P.nonNullable.select() })],
        (minimumScore) =>
          this.#preparedStatements.getAllMinimumScore.all({
            minimumScore: minimumScore ?? 0,
          }),
      )
      .with([undefined, false], () =>
        this.#preparedStatements.getAllNoScore.all(),
      )
      .with([P.nonNullable.select(), false], (provider) =>
        this.#preparedStatements.getAllProviderNoScore.all({
          provider,
        }),
      )
      .with(
        [P.nonNullable, P.union(true, { minimumScore: P.nonNullable })],
        ([provider, scoreOptions]) =>
          this.#preparedStatements.getAllProviderMininimumScore.all({
            provider,
            minimumScore:
              typeof scoreOptions === "boolean" ? 0 : scoreOptions.minimumScore,
          }),
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
   * Closes the connection to the database.
   * This object is unusable after this is called.
   * Should be called when done with the database!
   */
  close() {
    if (this.#conn.isOpen) {
      this.#conn.close();
    }
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
