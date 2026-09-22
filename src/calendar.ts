import { dateKey, DAY } from './model';
import type { UserSettings } from './storage';

export function civilDay(at: number) {
  const d = new Date(at);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
}
export function monthStart(at: number) { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
export function shiftMonth(at: number, delta: number) { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime(); }
export function journeyDay(at: number, settings: UserSettings): number | null {
  let start: number | undefined;
  if (civilDay(at) >= civilDay(settings.lastCigaretteAt)) start = settings.lastCigaretteAt;
  else {
    start = settings.periods.find(p => civilDay(at) >= civilDay(p.start) && civilDay(at) <= civilDay(p.end))?.start;
    if (start === undefined) start = [...(settings.planHistory ?? [])].reverse().find(p => civilDay(at) >= civilDay(p.quitAt) && civilDay(at) <= civilDay(p.changedAt))?.quitAt;
  }
  return start === undefined ? null : civilDay(at) - civilDay(start) + 1;
}
export function calendarMonth(month: number, now: number, settings: UserSettings) {
  const d = new Date(monthStart(month));
  const leading = (d.getDay() + 6) % 7; // Monday first, including Sunday-start months.
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const confirmed = new Set([...settings.confirmedDates, ...settings.periods.flatMap(p => p.confirmedDates)]);
  const lapses = new Set(settings.lapses.map(l => dateKey(l.at)));
  return Array.from({ length: Math.ceil((leading + days) / 7) * 7 }, (_, i) => {
    const day = i - leading + 1;
    if (day < 1 || day > days) return null;
    const at = new Date(d.getFullYear(), d.getMonth(), day).getTime();
    const key = dateKey(at);
    const state = lapses.has(key) ? 'lapse' : confirmed.has(key) ? 'confirmed' : civilDay(at) > civilDay(now) ? 'future' : 'past';
    return { day, at, key, state, today: key === dateKey(now), journeyDay: journeyDay(at, settings) };
  });
}
