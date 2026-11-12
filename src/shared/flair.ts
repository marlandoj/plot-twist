/**
 * Streak milestone titles. Flair is only written when a player crosses a milestone,
 * so it is a handful of Reddit API calls per player, not one per play.
 */
export type Milestone = { days: number; title: string; background: string };

export const MILESTONES: readonly Milestone[] = [
  { days: 3, title: 'Resident', background: '#E9A23B' },
  { days: 7, title: 'Mayor', background: '#2BA39B' },
  { days: 14, title: 'Town Planner', background: '#3E7CB1' },
  { days: 30, title: 'City Founder', background: '#8E4FC2' },
  { days: 100, title: 'Plot Legend', background: '#D9483B' },
];

export const milestoneFor = (streak: number): Milestone | null => {
  let found: Milestone | null = null;
  for (const m of MILESTONES) if (streak >= m.days) found = m;
  return found;
};

export const flairText = (m: Milestone) => `${m.title}, ${m.days}-day streak`;

/** Returns the milestone just reached, or null when no new flair is due. */
export const crossedMilestone = (before: number, after: number): Milestone | null =>
  MILESTONES.find((m) => before < m.days && after >= m.days) ?? null;

export const nextMilestone = (streak: number): Milestone | null =>
  MILESTONES.find((m) => m.days > streak) ?? null;
