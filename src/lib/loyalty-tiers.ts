// Purely cosmetic membership tiers based on lifetime credit earned (not
// current balance — spending credit shouldn't demote you). No schema
// change: computed from the sum of reward_credits amounts already earned.
export const TIERS = [
  { name: "New Member", emoji: "🌱", minEarned: 0 },
  { name: "Rising Star", emoji: "✨", minEarned: 25 },
  { name: "VIP", emoji: "💎", minEarned: 75 },
  { name: "Legend", emoji: "👑", minEarned: 150 },
] as const;

export function getTierProgress(lifetimeEarned: number) {
  let current: (typeof TIERS)[number] = TIERS[0];
  let next: (typeof TIERS)[number] | null = null;

  for (let i = 0; i < TIERS.length; i++) {
    if (lifetimeEarned >= TIERS[i].minEarned) {
      current = TIERS[i];
      next = TIERS[i + 1] ?? null;
    }
  }

  const progressPercent = next
    ? Math.min(
        100,
        Math.round(
          ((lifetimeEarned - current.minEarned) / (next.minEarned - current.minEarned)) * 100,
        ),
      )
    : 100;

  return {
    current,
    next,
    progressPercent,
    amountToNext: next ? Math.max(0, next.minEarned - lifetimeEarned) : 0,
  };
}
