const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

const time = new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Europe/Paris" });

export function formatTime(value: string) {
  return time.format(new Date(value));
}

export function formatDate(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "";
}

export function ago(value: string | Date, now = Date.now()) {
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  const abs = Math.abs(seconds);
  const [n, unit] =
    abs < 60
      ? [abs, "s"]
      : abs < 3600
        ? [Math.floor(abs / 60), "min"]
        : abs < 86400
          ? [Math.floor(abs / 3600), "h"]
          : abs < 86400 * 60
            ? [Math.floor(abs / 86400), "d"]
            : [Math.floor(abs / (86400 * 30)), "mo"];
  return seconds >= 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}

export function age(birthdate: string | null) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const now = new Date();
  return now.getFullYear() - b.getFullYear() - (now < new Date(now.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}
