import { formatDistanceToNow, startOfWeek, startOfMonth, subDays, subMonths } from "date-fns";

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday
}

export function getMonthStart(date: Date = new Date()): Date {
  return startOfMonth(date);
}

export function getPrevWeekStart(date: Date = new Date()): Date {
  return startOfWeek(subDays(date, 7), { weekStartsOn: 1 });
}

export function getPrevMonthStart(date: Date = new Date()): Date {
  return startOfMonth(subMonths(date, 1));
}

export function relativeTime(date: Date | string | null): string {
  if (!date) return "never";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function calcActivityScore(commits: number, prsMerged: number, issuesClosed: number): number {
  return commits + prsMerged * 3 + issuesClosed * 2;
}

export function calcTrend(currentScore: number, prevScore: number): string {
  if (currentScore === 0 && prevScore === 0) return "none";
  if (prevScore === 0) return "increasing";
  const ratio = currentScore / prevScore;
  if (ratio >= 1.2) return "increasing";
  if (ratio <= 0.8) return "declining";
  return "steady";
}

export function deriveProjectStatus(lastActivityAt: Date | null): string {
  if (!lastActivityAt) return "stalled";
  const daysSince = (Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000;
  if (daysSince <= 7) return "active";
  if (daysSince <= 14) return "slow";
  return "stalled";
}
