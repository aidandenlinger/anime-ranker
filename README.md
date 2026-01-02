# Anime/Manga Ranker

Given a supported streaming service, returns a sorted list of all the anime (or manga!) rated 80 or higher on [AniList]. The goal is to allow you to find the generally agreed upon best shows on the services you have, and explore some exclusives that may have flown under your radar.

## Install

This project uses [`pnpm`] and [`node`]. The specific versions used are tracked in [`mise.toml`](./mise.toml). You can automatically install these tools with [`mise`], or manually install the tools yourself.

## Usage

> [!NOTE]
> Since [Anilist] has a [30 requests per minute rate limit][rate limit], this script takes 2 seconds to run per show, and can take a while to run.

Run `pnpm start` to run the script. Without any arguments, it will create or use a sqlite3 database at `database.sqlite`. Use the `--database` flag to specify a different location. Use the `--no-update` flag to skip attempting to update the database and solely print the recommended anime from an existing database for the given providers.

There's an existing database in the `results` folder, feel free to copy it to `database.sqlite` to start off with more data and spend less time fetching. Note that some scores/data may be outdated though.

Run `pnpm start --help` to see all command line options.

### Supported Providers

Without any arguments, the script will query each provider with a small anime library that doesn't require authorization. Currently, that's Hulu and HIDIVE. Use the `--providers` or `p` flag to specify providers you want to run. You can list multiple providers at once, for example `pnpm start --providers Hulu Netflix` to query Hulu and Netflix.

#### Anime

- [Hulu]
- [HIDIVE]
- [Netflix] ([requires authorization](./docs/NETFLIX.md))

#### Manga

- [ShonenJump]
- [VizManga]

### Known Issues

- Right now, the script simply prints out the shows you should watch. The real value is
  exploring the database at `database.sqlite` yourself. See [`database.ts`] for examples
  of queries you can use. I'd like to create a web frontend for exploring this data. For
  the time being, I use [litecli] to mess around with it.

- This script automates a lot, but it is imperfect. Consider it as a very good first pass
  for what's on a service, allowing you to do further research on the shows it finds.
  - It does not store how many seasons/episodes there are on the service, or if the service has it
    subbed or dubbed. This is tricky to do depending on the provider, and to me would be a lot
    more work for little gain, comparing to clicking on `providerURL` and checking yourself.
    I'm open to PRs if you want to add more of this to the script.

  - It needs to find a match between the title on the streaming provider and the title on Anilist.
    When those two titles are too different, it won't find a match. Shows with no match are reported
    by the script. When shows have the same title it can make the wrong
    match, i.e. it thinks "Hunter x Hunter" refers to the 1999 show rather than the 2011 one. This
    may be fixed by sorting via popularity and assuming the more popular show is the one that's available.
    I'm open to PRs to make this better!

  - Depending on how the provider labels their anime, the script may not find every show they
    have, i.e. "Deh-noh Coil" isn't found by the script even though it's currently on US Netflix,
    because Netflix hasn't labelled it as Anime.

- Hulu's output includes "HBO Max on Hulu" shows/movies. If you do not have the "HBO Max" add-on,
  you will not be able to access those shows. I'd like to treat these differently in the future, but
  these shows aren't clearly labelled by Hulu as "HBO MAX" shows so it's non-trivial.

## Contributing

I'm open to contributions! PRs that would be useful would be

- adding more providers
  - Amazon Prime
  - HBO Max
  - Tubi
  - Retrocrush
  - I personally find the above providers more interesting/useful than a Crunchyroll provider. Since the vast majority of streamable anime are on Crunchyroll, you'd be better served going to the Anilist Top-Ranked Anime in general and scrolling through that. The goal of this project, in my eyes, is to find the shows that are already accessible to you. However, if you want to write a Crunchyroll provider, I wouldn't turn it down!
- creating a frontend to explore the SQLite database

Please make an issue stating what you want to work on so that I'm aware and we don't duplicate work!

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
[ShonenJump]: https://www.viz.com/manga-books/shonenjump/section/free-chapters
[VizManga]: https://www.viz.com/manga-books/vizmanga/section/free-chapters
[HIDIVE]: https://www.hidive.com
[`database.ts`]: ./src/database/database.ts
[litecli]: https://litecli.com/
