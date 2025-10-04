import { Command, Option } from "@commander-js/extra-typings";
import { type Providers, providers } from "./providers/provider.ts";

export const cliInterface = new Command().addOption(
  new Option(
    "-p, --providers <provider...>",
    "Which providers to query. Note: Some providers require authentication, see the README.",
  )
    .choices(providers)
    .default(
      ["Hulu"] satisfies Providers[],
      "Providers with a small library and no authentication required",
    ),
);

// TODO: --debug flag for personal use
// TODO: --verbose flag with logger
