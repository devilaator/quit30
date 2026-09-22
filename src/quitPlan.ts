import type { UserSettings } from './storage';

export function changeQuitPlan(settings: UserSettings, at: number, preparing: boolean, now: number): UserSettings {
  if (!Number.isFinite(at) || (preparing ? at <= now : at > now)) throw new Error('Invalid quit plan');
  if (at === settings.lastCigaretteAt) return settings;
  // Check-ins, lapses, archived periods and all preferences remain intact.
  // Audit previous plans without adding overlapping savings to the current totals.
  return {
    ...settings,
    lastCigaretteAt: at,
    planHistory: [...(settings.planHistory ?? []), { quitAt: settings.lastCigaretteAt, changedAt: now }],
  };
}
