import type { Roast } from "./types";

export type WorstOfWeekCandidate = { roast: Roast; score: number };

export function selectWorstOfWeek(roasts: readonly Roast[], now: Date = new Date()): WorstOfWeekCandidate | undefined {
  const published = roasts.filter((roast) => roast.status === "PUBLISHED");
  if (published.length === 0) return undefined;

  const nowTime = now.getTime();
  const cutoff = nowTime - 7 * 24 * 60 * 60 * 1000;
  const recent = published.filter((roast) => {
    const createdAt = new Date(roast.createdAt).getTime();
    return createdAt >= cutoff && createdAt <= nowTime;
  });
  const candidates = recent.length > 0 ? recent : published;

  return candidates.reduce<WorstOfWeekCandidate | undefined>((best, roast) => {
    const candidate = { roast, score: roast.fairCount + roast.funnyCount };
    if (!best) return candidate;

    const roastTime = new Date(roast.createdAt).getTime();
    const bestTime = new Date(best.roast.createdAt).getTime();
    if (candidate.score > best.score || (candidate.score === best.score && roastTime > bestTime)) return candidate;
    return best;
  }, undefined);
}
