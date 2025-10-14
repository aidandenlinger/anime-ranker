import { P, match } from "ts-pattern";
import {
  type RankedVideo,
  createRankedVideoTable,
  rankedVideoSchema,
} from "./ranked-video.ts";
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

  /** @param databasePath A filepath to an existing database, or the place to write a new database */
  constructor(databasePath: string) {
    this.path = databasePath;
    this.#conn = new DatabaseSync(databasePath);
    this.#conn.exec(createRankedVideoTable);
    // Compile our statements ahead of time
    this.#preparedStatements = {
      insert: this.#conn.prepare(this.#insertStatement),
      getAll: this.#conn.prepare(this.#getAll),
      getAllProvider: this.#conn.prepare(this.#getAllProvider),
      getAllMinScore: this.#conn.prepare(this.#getAllMinimumScore),
      getAllProviderMinScore: this.#conn.prepare(
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
   * @param video Video to add to the database
   * @throws {Error} if a video with the same providerTitle and provider is in the database
   */
  insert(video: RankedVideo) {
    this.#preparedStatements.insert.run(rankedVideoSchema.encode(video));
  }

  /**
   * Insert many videos into the database in one transaction.
   * @param videos The videos to add
   * @throws {Error} if a video with the same providerTitle and provider is in the database
   */
  insertMany(videos: RankedVideo[]) {
    this.#conn.exec("BEGIN TRANSACTION");
    for (const video of videos) {
      this.insert(video);
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

  /** SQL statement to get all rankings with a minimum score. */
  readonly #getAllMinimumScore = `
    SELECT * FROM Ranks
    WHERE score >= :minimumScore
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
   * @param options Optional criteria that the listed videos must fufill
   * @returns All RankedVideos with a minimum score
   */
  getAll<Provider extends Providers>(
    options: RequiredProperty<GetAllOptions<Provider>, "minimumScore">,
  ): RequiredProperty<RankedVideo<Provider>, "score">[];

  /**
   * @param options Optional criteria that the listed videos must fufill
   * @returns All RankedVideos meeting the criteria
   */
  getAll<Provider extends Providers>(
    options?: GetAllOptions<Provider>,
  ): RankedVideo<Provider>[];

  /**
   * @param options Optional criteria that the listed videos must fufill
   * @returns All RankedVideos meeting the criteria
   */
  getAll(options?: GetAllOptions) {
    const results = match([options?.provider, options?.minimumScore])
      .with([undefined, undefined], () => this.#preparedStatements.getAll.all())
      .with([P.nonNullable.select(), undefined], (provider) =>
        this.#preparedStatements.getAllProvider.all({ provider }),
      )
      .with([undefined, P.nonNullable.select()], (minimumScore) =>
        this.#preparedStatements.getAllMinScore.all({ minimumScore }),
      )
      .with([P.nonNullable, P.nonNullable], ([provider, minimumScore]) =>
        this.#preparedStatements.getAllProviderMinScore.all({
          provider,
          minimumScore,
        }),
      )
      .exhaustive()
      .map((result) => rankedVideoSchema.parse(result));

    // Some runtime asserts to ensure our typing is correct, and catch any errors if we change the SQL statements.
    if (options?.provider) {
      const provider = options.provider;
      assert.ok(results.every((r) => r.provider === provider));
    }

    if (options?.minimumScore) {
      const minimumScore = options.minimumScore;
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
  /** An optional minimum score for listed videos. */
  minimumScore?: number;
  /** An optional provider for listed videos. */
  provider?: Provider;
}>;

/** Utility type to make a field optional and non nullable. Based on https://stackoverflow.com/a/53050575 */
type RequiredProperty<Type, Key extends keyof Type> = {
  [Property in Key]-?: Required<NonNullable<Type[Property]>>;
} & Omit<Type, Key>;
