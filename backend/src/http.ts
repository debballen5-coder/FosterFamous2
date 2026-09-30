import type { InstallationPrincipal } from "./services/installation-security";

export type AppEnv = {
  Variables: {
    installation: InstallationPrincipal | null;
  };
};
