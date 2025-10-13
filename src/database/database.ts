import {
  type RankedVideo,
  createRankedVideoTable,
  rankedVideoSchema,
} from "./ranked-video.ts";
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- I'm actively choosing to use this experimental feature to avoid a dependency
import { DatabaseSync } from "node:sqlite";

/**
 * Class to add and list entries from a database. It must be closed when operations are done!
 */
export class Database {
  /** Our connection to the database which actually lets us read/write. */
  readonly #conn: DatabaseSync;

  // TODO: when @types/node updates, migrate to using SQLTagStore and set minimum node version to 24.9
  /** A cache of our prepared statements, to allow for efficent reuse. */
  readonly #preparedStatements;

  /** @param databasePath A filepath to an existing database, or the place to write a new database */
  constructor(databasePath: string) {
    this.#conn = new DatabaseSync(databasePath);
    this.#conn.exec(createRankedVideoTable);
    // Compile our statements ahead of time
    this.#preparedStatements = {
      insert: this.#conn.prepare(this.#insertStatement),
      getAll: this.#conn.prepare(this.#getAll),
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

  /** SQL statement to get all rankings from the SQL database. */
  readonly #getAll = `
    SELECT * FROM Ranks
    ORDER BY score DESC, providerTitle ASC
  `;

  /** @returns All RankedVideos in the database */
  getAll() {
    return this.#preparedStatements.getAll
      .all()
      .map((result) => rankedVideoSchema.parse(result));
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
