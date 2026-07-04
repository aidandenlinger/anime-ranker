{
  description = "Basic node dev env";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];

      perSystem =
        { pkgs, ... }:
        let
          essential = with pkgs; [
            nodejs_24
            pnpm_11
          ];
        in
        {
          devShells = {
            default = pkgs.mkShell {
              packages = essential ++ (with pkgs; [ litecli ]);
            };

            # Deps neeed for CI
            ci = pkgs.mkShell {
              packages = essential;
            };
          };
        };
    };
}
