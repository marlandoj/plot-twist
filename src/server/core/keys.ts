/** Every Redis key Plot Twist uses. Documented in docs/REDIS.md. */
export const keys = {
  day: (date: string) => `pt:day:${date}`,
  queue: () => 'pt:queue',
  attempt: (date: string, user: string) => `pt:attempt:${date}:${user}`,
  leaderboard: (date: string) => `pt:lb:${date}`,
  perfect: (date: string) => `pt:perfect:${date}`,
  posted: (date: string, user: string) => `pt:posted:${date}:${user}`,
  streak: (user: string) => `pt:streak:${user}`,
  week: (weekKey: string) => `pt:week:${weekKey}`,
  suggestion: (id: string) => `pt:sugg:${id}`,
  pending: () => 'pt:sugg:pending',
  approved: () => 'pt:sugg:approved',
};

/** ISO week key, e.g. 2026-W46. Mondays start the week, matching the difficulty ramp. */
export const weekKey = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export const epochDay = (date: string) => Math.round(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
