# Anime Ranker

Given a supported streaming service, returns a sorted list of all the anime rated 80 or higher on [AniList].

Note that this script is imperfect, and is (at the time of writing) in active development.

## Install

This project uses [`pnpm`] and [`node`]. The specific versions used are tracked in [`mise.toml`](./mise.toml).

## Usage

Run `pnpm start` to run the script. It prints results to stdout as it encounters them, and saves the
final, sorted results in the `out` folder.

> [!NOTE]
> Since [Anilist] has a [30 requests per minute rate limit][rate limit], this script takes a while to run.

### Supported Providers

Currently, the script unconditionally goes through each provider that it can.

- [Hulu]
- [Netflix] ([requires authorization](./docs/NETFLIX.md))

### Known Issues

- There's zero CLI interface :p this will be worked on!

- Hulu's output includes "HBO Max on Hulu" shows/movies. If you do not have the "HBO Max" add-on,
  you will not be able to access those shows. I'd like to treat these differently in the future.

- Some show matches are very inaccurate. This often happens when a non-anime show is in the list,
  and anilist returns the closest match. For example, the Hulu live-action show "Tokyo Vice" (why
  is it labeled anime???) returns the anilist score for "The Tokyo Project". I plan to fix this by
  implementing a "string similarity" feature and only accepting high ranked matches.

- This script does not track which language each provider has (ie does it have the dub, the sub,
  both?). This should be straightforward to add to Netflix, but is a pain for Hulu since they do
  this in several different ways (some shows have two entries, one subbed and one dubbed; some shows
  double the episodes and include the sub and dub under one entry, and sometimes it just has the dub
  which you can't tell until you look at episode titles). I may not fix this.

- In general, I realized this is building a database and I'd rather store _all_ the output as a
  sqlite db. Then, the script will become about _updating_ the database with new shows/removing
  removed ones, rather than fetching every show every time, and you can play with the data.

## Contributing

This repo is currently a construction zone with many large, rapid changes. I will not be accepting
contributions at this time, because I don't want to change the codebase out from under your feet :).
Once the foundation is more stable, I'll be open to contributions.

## License

MIT

[AniList]: https://anilist.co
[`pnpm`]: https://pnpm.io/
[`node`]: https://nodejs.org/en
[rate limit]: https://docs.anilist.co/guide/rate-limiting
[Hulu]: https://hulu.com
[Netflix]: https://netflix.com
