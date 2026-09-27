// This Worker's environment, read once from its bindings (wrangler.jsonc vars and secrets).
import { env } from "cloudflare:workers";
import { loadConfig, type Config } from "~/lib/config";

let config: Config | undefined;

export function getConfig(): Config {
  config ??= loadConfig(env as unknown as Record<string, string | undefined>);
  return config;
}
