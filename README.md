# Anime/Manga Ranker

Given a supported streaming service, returns a sorted list of all the anime (or manga!) rated 80 or higher on [AniList].

Note that this script is imperfect, and is (at the time of writing) in active development.

## Install

### Javascript Dependencies

This project uses [`pnpm`] and [`node`]. The specific versions used are tracked in [`mise.toml`](./mise.toml). You can automatically install these versions with [`mise`], or manually install them yourself.

### SQLite

This project uses [`sqlite3`] to store its data. This comes preinstalled (or is available) on the vast majority of Linux distributions and macOS. It will need to be installed on Windows, or you can use [Windows Subsystem for Linux][WSL] to access a Linux environment on Windows.

## Usage

> [!NOTE]
> Since [Anilist] has a [30 requests per minute rate limit][rate limit], this script takes 2 seconds to run per show, and can take a while to run as a result.

Run `pnpm start` to run the script. Without any arguments, it will save the data to a sqlite3 database in the `out` folder.

Run `pnpm start --help` to see all command line options.

### Supported Providers

Without any arguments, the script will query each provider with a small library that doesn't require authorization. Use the `--providers` or `p` flag to specify providers you want to run. You can list multiple providers at once, for example `pnpm start --providers Hulu Netflix` to query Hulu and Netflix.

#### Anime

- [Hulu]
- [Netflix] ([requires authorization](./docs/NETFLIX.md))

### Known Issues

- Hulu's output includes "HBO Max on Hulu" shows/movies. If you do not have the "HBO Max" add-on,
  you will not be able to access those shows. I'd like to treat these differently in the future.

- This script does not track which language each provider has (ie does it have the dub, the sub,
  both?). This should be straightforward to add to Netflix, but is a pain for Hulu since they do
  this in several different ways (some shows have two entries, one subbed and one dubbed; some shows
  double the episodes and include the sub and dub under one entry, and sometimes it just has the dub
  which you can't tell until you look at episode titles). I may not fix this.

## Contributing

This repo is currently a construction zone with many large, rapid changes. I will not be accepting
contributions at this time, because I don't want to change the codebase out from under your feet :).
Once the foundation is more stable, I'll be open to contributions.

## License

MIT

[AniList]: https://anilist.co
[`pnpm`]: https://pnpm.io/
[`node`]: https://nodejs.org/en
[`mise`]: https://mise.jdx.dev/
[`sqlite3`]: https://sqlite.org/
[WSL]: https://learn.microsoft.com/en-us/windows/wsl/install
[rate limit]: https://docs.anilist.co/guide/rate-limiting
[Hulu]: https://hulu.com
[Netflix]: https://netflix.com
