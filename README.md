# Anime Ranker

Given a supported streaming service, returns a sorted list of all the anime rated 80 or higher on [AniList].

## Install

This project uses [`pnpm`] and [`node`]. The specific versions used are tracked in [`mise.toml`](./mise.toml).

## Usage

Run `pnpm start` to run the script. It prints results to stdout as it encounters them, and saves the final, sorted results in the `out` folder.

> [!NOTE]
> Since [Anilist] has a [30 requests per minute rate limit][rate limit], this script takes a while to run.

## Contributing

I'm open to PRs that add additional streaming services! Add them in the `providers` folder.

## License

MIT

[AniList]: https://anilist.co
[`pnpm`]: https://pnpm.io/
[`node`]: https://nodejs.org/en
[rate limit]: https://docs.anilist.co/guide/rate-limiting
