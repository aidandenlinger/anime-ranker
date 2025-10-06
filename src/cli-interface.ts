import {
  Command,
  InvalidArgumentError,
  Option,
} from "@commander-js/extra-typings";
import { type Providers, providers } from "./providers/provider.ts";

export const cliInterface = new Command()
  .addOption(
    new Option(
      "-p, --providers <provider...>",
      "Which providers to query. Note: Some providers require authentication, see the README.",
    )
      .choices(providers)
      .default(
        ["Hulu"] satisfies Providers[],
        "Providers with a small library and no authentication required",
      ),
  )
  .addOption(
    new Option(
      "--test-less-titles [seed]",
      "Internal testing flag. Fetch all titles from providers, but only query a random 10% of them to anilist to reduce time spent. Optionally takes a seed to test on the same inputs, assuming that the provider hasn't changed their titles.",
    )
      .argParser(parseArgumentToInt)
      .default(false)
      .hideHelp()
      .conflicts(["testTitle"]),
  )
  .addOption(
    new Option(
      "--test-title <titles...>",
      "Internal testing flag. Filters provider titles down to those which contain any of the substrings provided here.",
    )
      .hideHelp()
      .conflicts(["testLessTitles"]),
  );

/**
 * @param input A CLI argument to be parsed into a number
 * @returns parsed value
 * @throws {InvalidArgumentError} if the input is not a number
 */
function parseArgumentToInt(input: string): number {
  const parsedValue = Number.parseInt(input);
  if (Number.isNaN(parsedValue)) {
    throw new InvalidArgumentError("Not a number.");
  }
  return parsedValue;
}
