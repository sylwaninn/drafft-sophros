// What a Worker needs to serve one environment, checked from its bindings. Anything missing or
// contradictory stops every request with a clear error rather than half-working.
export type DrafftEnv = "dev" | "staging" | "production";

export interface Config {
  env: DrafftEnv;
  auth: { mode: "access"; teamDomain: string; audience: string } | { mode: "dev"; email: string };
  supabaseUrl: string;
  supabaseKey: string;
  mediaUrl: string;
  /** Signs media links (routes/media.ts); the same MEDIA_SIGNING_KEY as the backend of this environment. */
  mediaSigningKey: string | null;
  stream: { key: string; secret: string } | null;
}

export function loadConfig(vars: Record<string, string | undefined>): Config {
  const value = (name: string) => vars[name]?.trim() || undefined;
  const required = (name: string) => {
    const v = value(name);
    if (!v) throw new Error(`sophros: missing ${name}`);
    return v;
  };

  const drafftEnv = required("DRAFFT_ENV");
  if (drafftEnv !== "dev" && drafftEnv !== "staging" && drafftEnv !== "production") {
    throw new Error(`sophros: unknown DRAFFT_ENV ${drafftEnv}`);
  }

  let auth: Config["auth"];
  if (value("AUTH_MODE") === "dev") {
    // A fixed identity is only ever acceptable on the dev server (which works against staging).
    if (drafftEnv !== "dev") throw new Error("sophros: AUTH_MODE=dev is for DRAFFT_ENV=dev only");
    auth = { mode: "dev", email: required("DEV_STAFF_EMAIL").toLowerCase() };
  } else {
    auth = {
      mode: "access",
      teamDomain: required("ACCESS_TEAM_DOMAIN").replace(/\/+$/, ""),
      audience: required("ACCESS_AUD"),
    };
  }

  const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");
  if (!supabaseUrl.startsWith("https://")) {
    throw new Error("sophros: SUPABASE_URL must be https");
  }

  const streamKey = value("STREAM_API_KEY");
  const streamSecret = value("STREAM_API_SECRET");

  return {
    env: drafftEnv,
    auth,
    supabaseUrl,
    supabaseKey: required("SUPABASE_SECRET_KEY"),
    mediaUrl: required("MEDIA_PUBLIC_URL").replace(/\/+$/, ""),
    // Unset while the bucket is still public: links stay plain.
    mediaSigningKey: value("MEDIA_SIGNING_KEY") ?? null,
    stream: streamKey && streamSecret ? { key: streamKey, secret: streamSecret } : null,
  };
}
