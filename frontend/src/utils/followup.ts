import { Patient } from '@/src/api/client';

// A patient is considered overdue for post-op review if:
// - Surgery happened MORE than FOLLOWUP_DAYS ago (default 42 days / 6 weeks)
// - AND no result/outcome has been recorded yet
export const FOLLOWUP_DAYS = 42;

export function isOverdue(p: Patient, globalDays: number): boolean {
  if (!p.date_of_surgery) return false;
  const dos = new Date(p.date_of_surgery);
  if (Number.isNaN(dos.getTime())) return false;
  const days = p.followup_days && p.followup_days > 0 ? p.followup_days : globalDays;
  const diff = (Date.now() - dos.getTime()) / (1000 * 60 * 60 * 24);
  const noResult = !(p.result && p.result.trim().length > 0);
  const noPostOp = !(p.post_op && p.post_op.length > 0);
  return diff > days && (noResult || noPostOp);
}

export function daysSinceSurgery(p: Patient): number | null {
  if (!p.date_of_surgery) return null;
  const dos = new Date(p.date_of_surgery);
  if (Number.isNaN(dos.getTime())) return null;
  return Math.floor((Date.now() - dos.getTime()) / (1000 * 60 * 60 * 24));
}
