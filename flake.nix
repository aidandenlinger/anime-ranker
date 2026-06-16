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
          # Disable unwanted hardening flags that can cause unexpected behavor
          # https://github.com/NixOS/nixpkgs/issues/18995#issuecomment-4061380978
          mkShellNoHardening =
            args:
            pkgs.mkShell (
              {
                hardeningDisable = [ "all" ];
                NIX_ENFORCE_NO_NATIVE = false;
              }
              // args
            );
        in
        {
          devShells = {
            default = mkShellNoHardening {
              nativeBuildInputs = with pkgs; [
                nodejs_24
                pnpm_10
              ];
            };
          };
        };
    };
}
