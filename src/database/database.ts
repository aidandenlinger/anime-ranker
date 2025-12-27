// eslint-disable-next-line n/no-unsupported-features/node-builtins -- I'm actively choosing to use this experimental feature to avoid a dependency
import { DatabaseSync, type SQLTagStore } from "node:sqlite";
import {
  type MaybeRankedMedia,
  type MediaPrimaryKey,
  type ScoredMedia,
  createDeletedTable,
  createMediaTable,
  createRanksTable,
  maybeRankedMediaSchema,
  mediaAndRankIdSchema,
  mediaPrimaryKeySchema,
  rankSchema,
} from "./media-schema.ts";
import {
  type Media,
  type Providers,
  providers,
} from "../providers/provider.ts";
import { P, match } from "ts-pattern";
import type { Rank } from "../rankers/ranker.ts";
import assert from "node:assert/strict";
import z from "zod";

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
    this.#db.exec(createDeletedTable);
  }

  /**
   * @param entry Video to add to the database
   * @throws {Error} if media with the same providerTitle and provider is in the database
   */
  insert(entry: MaybeRankedMedia) {
    // NOTE: Ranks must be created first because Media has a `REFERENCES` to Ranks
    // @ts-expect-error -- `safeEncode` has a needlessly strict type signature, as if it was `encode`. I expect encoding to fail sometimes (when rank isn't defined), which is why I'm using `safeEncode` instead of `encode`. Ignore the type signature and allow the falliable action to occur.
    const maybeRank = rankSchema.safeEncode(entry);
    if (maybeRank.success) {
      const {
        rankId,
        rankerTitle,
        rankerURL,
        score,
        ranker,
        lastUpdated,
        poster,
        description,
        genres,
        startDate,
      } = maybeRank.data;

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- we don't care to learn about the resulting changes here
      this.#sql.run`
        INSERT INTO Ranks (
            "rankId",
            "rankerTitle",
            "rankerURL",
            "score",
            "ranker",
            "lastUpdated",
            "poster",
            "genres",
            "startDate",
            "description"
        )
        VALUES (
            ${rankId},
            ${rankerTitle},
            ${rankerURL},
            ${score},
            ${ranker},
            ${lastUpdated},
            ${poster},
            ${genres},
            ${startDate},
            ${description}
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
   * Soft delete an entry from the database by removing a media
   * from the Media table and moving it to the Deleted table.
   * @param media The primary key of the media to delete
   * @throws {Error} if media is not in the table
   */
  delete(media: MediaPrimaryKey) {
    // Insert the row into the deleted table
    const insertResults = this.#sql.run`
      INSERT INTO Deleted
      SELECT *
      FROM Media
      WHERE
          "provider" = ${media.provider}
          AND "providerTitle" = ${media.providerTitle}
    `;

    if (insertResults.changes === 0) {
      throw new Error(
        `${media.provider} ${media.providerTitle} does not appear to be in the table and cannot be deleted.`,
      );
    }

    // Remove it from Media table
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- we don't care to learn about the resulting changes here
    this.#sql.run`
      DELETE FROM Media
      WHERE
          "provider" = ${media.provider}
          AND "providerTitle" = ${media.providerTitle}
    `;

    // TODO: garbage collection of the Ranks table
    // by checking if there are any media that point to it,
    // and deleting if there are none
  }

  /**
   * Delete many media in one transaction.
   * @param mediaList The media to delete
   * @throws {Error} if any of the media are not in the table. This function deletes every entry it can before throwing this error.
   */
  deleteMany(mediaList: MediaPrimaryKey[]) {
    this.#db.exec("BEGIN TRANSACTION");
    const errors = [];
    for (const media of mediaList) {
      try {
        this.delete(media);
      } catch {
        errors.push(media);
      }
    }
    this.#db.exec("COMMIT");

    if (errors.length > 0) {
      throw new Error(
        `Some media were not in the database and could not be deleted:\n${errors.map((entry) => `  - ${entry.provider}, ${entry.providerTitle}`).join("\n")}`,
      );
    }
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
   * Compare the database against a list of media, only for the specified provider. Designed so you can synchronize
   * the database to a new set of media.
   * @param medias The set of media to compare the database against
   * @param provider Optional provider subset to compare against
   * @returns Information on if the media is in the new set and database, only in the database, or not in the database
   */
  mediaDiff<
    Entry extends MediaPrimaryKey<Provider>,
    Provider extends Providers,
  >(medias: Entry[], provider?: Provider) {
    // Map our titles to their identifying string, because JavaScript sets
    // can't hold objects
    const titlesInRequest = new Map(
      medias.map((entry) => [
        `${entry.provider}:${entry.providerTitle}` as const,
        entry,
      ]),
    );

    const titlesInRequestSet = new Set(titlesInRequest.keys());
    const titlesInDatabase = this.#titles(provider);

    const inBoth = [...titlesInRequestSet.intersection(titlesInDatabase)].map(
      (key) => titlesInRequest.get(key),
    );

    assert.ok(inBoth.every((entry) => entry !== undefined));

    const notInDatabase = [
      ...titlesInRequestSet.difference(titlesInDatabase),
    ].map((key) => titlesInRequest.get(key));

    assert.ok(notInDatabase.every((entry) => entry !== undefined));

    const onlyInDatabase = [
      ...titlesInDatabase.difference(titlesInRequestSet),
    ].map((key) => {
      const [rawProvider, providerTitle] = key.split(":");
      const databaseProvider = z.enum(providers).parse(rawProvider);
      assert.ok(provider === undefined || databaseProvider === provider);
      assert.ok(providerTitle);

      return { provider: databaseProvider, providerTitle } as const;
    });

    return {
      inBoth,
      onlyInDatabase,
      notInDatabase,
    };
  }

  /** @returns all titlesin the database via an identifier string, for use with a set */
  #titles(): ReadonlySet<`${Providers}:${string}`>;

  /**
   * @param provider Optional provider to filter the results to
   * @returns all titles in the database with a certain provider via an identifier string, for use with a set
   */
  #titles<Provider extends Providers>(
    provider?: Provider,
  ): ReadonlySet<`${Provider}:${string}`>;

  /**
   * @param provider Optional provider to filter the results to
   * @returns all titles in the database with a certain provider via an identifier string, for use with a set
   */
  #titles(provider?: Providers) {
    return new Set(
      match(provider satisfies Providers | undefined)
        .with(
          P.nonNullable,
          (provider) =>
            this.#sql.all`
              SELECT
                  "provider",
                  "providerTitle"
              FROM Media
              WHERE
                  "provider" = ${provider}
              ORDER BY "providerTitle" ASC, "provider" ASC`,
        )
        .otherwise(
          () =>
            this.#sql.all`
              SELECT
                  "provider",
                  "providerTitle"
              FROM Media
              ORDER BY "providerTitle" ASC, "provider" ASC
          `,
        )
        .map((result) => mediaPrimaryKeySchema.parse(result))
        .map((entry) => {
          if (provider === undefined) {
            return `${entry.provider}:${entry.providerTitle}` as const;
          }

          assert.ok(entry.provider === provider);
          return `${provider}:${entry.providerTitle}` as const;
        }),
    );
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
