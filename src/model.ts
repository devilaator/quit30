export type Language = 'et' | 'en' | 'ru';
export type SmokingProfile = {
    packSize: number;
    packPrice: number;
    packDays: number;
};
export type Lapse = {
    id: string;
    at: number;
    cigarettes: number;
    restart: boolean;
};
export type Period = {
    start: number;
    end: number;
    money: number;
    cigarettes: number;
    confirmedDates: string[];
};
export type Journey = {
    profile: SmokingProfile;
    reasons: string[];
    lapses: Lapse[];
    periods: Period[];
    cravingsManaged: number;
    lastManagedCraving: number | null;
};
export const DAY = 86400000;
export function calculateHabit(profile: SmokingProfile, manual?: number) {
    if (![profile.packSize, profile.packPrice, profile.packDays].every(n => Number.isFinite(n) && n > 0) || !Number.isInteger(profile.packSize))
        return null;
    const result = { dailySpend: profile.packPrice / profile.packDays, cigarettesPerDay: manual ?? profile.packSize / profile.packDays };
    return Object.values(result).every(n => Number.isFinite(n) && n > 0) ? result : null;
}
export function migrateJourney(data: Record<string, unknown>): Journey {
    const daily = typeof data.dailySpend === 'number' && data.dailySpend > 0 ? data.dailySpend : 1;
    const cigs = typeof data.cigarettesPerDay === 'number' && data.cigarettesPerDay > 0 ? data.cigarettesPerDay : 20;
    const fallback = { packSize: 20, packDays: 20 / cigs, packPrice: daily * 20 / cigs };
    const profile = data.profile as SmokingProfile | undefined;
    return {
        profile: profile && calculateHabit(profile) ? profile : fallback,
        reasons: Array.isArray(data.reasons) ? data.reasons.filter((x): x is string => typeof x === 'string').slice(0, 3).map(x => x.slice(0, 120)) : [],
        lapses: Array.isArray(data.lapses) ? data.lapses.filter((x): x is Lapse => !!x && typeof x.id === 'string' && Number.isFinite(x.at) && Number.isInteger(x.cigarettes) && x.cigarettes > 0) : [],
        periods: Array.isArray(data.periods) ? data.periods.filter((x): x is Period => !!x && Number.isFinite(x.start) && Number.isFinite(x.end) && Number.isFinite(x.money) && Number.isFinite(x.cigarettes) && Array.isArray(x.confirmedDates)) : [],
        cravingsManaged: typeof data.cravingsManaged === 'number' && Number.isFinite(data.cravingsManaged) ? Math.max(0, Math.floor(data.cravingsManaged)) : 0,
        lastManagedCraving: typeof data.lastManagedCraving === 'number' ? data.lastManagedCraving : null,
    };
}
export function periodTotals(settings: Journey & {
    lastCigaretteAt: number;
    dailySpend: number;
    cigarettesPerDay: number;
}, now: number) {
    const days = Math.max(0, now - settings.lastCigaretteAt) / DAY;
    // A restart's cigarette cost was already included in the archived period.
    const lapses = settings.lapses.filter(l => l.at >= settings.lastCigaretteAt && l.at <= now &&
        !(l.restart && settings.periods.some(p => p.end === l.at)));
    const smoked = lapses.reduce((sum, l) => sum + l.cigarettes, 0);
    return { money: Math.max(0, days * settings.dailySpend - smoked * settings.dailySpend / settings.cigarettesPerDay), cigarettes: Math.max(0, days * settings.cigarettesPerDay - smoked) };
}
export function continuousStart(settings: Journey & {
    lastCigaretteAt: number;
}, now: number) {
    return Math.max(settings.lastCigaretteAt, ...settings.lapses.filter(l => l.at <= now && l.at >= settings.lastCigaretteAt).map(l => l.at));
}
export function dateKey(at: number) {
    const d = new Date(at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const achievementDays = [1, 3, 7, 14, 21, 30, 50, 100, 183, 365];
export function earnedAchievements(elapsed: number) { return achievementDays.filter(d => elapsed >= d * DAY); }
export function canConfirm(dayStart: number, now: number, quitAt: number, confirmed: string[], lapses: Lapse[]) {
    const quitDay = new Date(quitAt);
    quitDay.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const key = dateKey(dayStart);
    return now >= quitAt && dayStart >= quitDay.getTime() && dayStart <= today.getTime() && now - dayStart < 48 * 3600000 && !confirmed.includes(key) && !lapses.some(l => dateKey(l.at) === key);
}
export function recordLapse<T extends Journey & {
    lastCigaretteAt: number;
    dailySpend: number;
    cigarettesPerDay: number;
    confirmedDates: string[];
}>(settings: T, lapse: Lapse): T {
    const updated = { ...settings, lapses: [...settings.lapses, lapse], confirmedDates: settings.confirmedDates.filter(d => d !== dateKey(lapse.at)) };
    if (lapse.restart) {
        const totals = periodTotals(updated, lapse.at);
        updated.periods = [...settings.periods, { start: settings.lastCigaretteAt, end: lapse.at, money: totals.money, cigarettes: totals.cigarettes, confirmedDates: updated.confirmedDates.filter(d => d < dateKey(lapse.at)) }];
        updated.lastCigaretteAt = lapse.at;
        updated.confirmedDates = updated.confirmedDates.filter(d => d > dateKey(lapse.at));
    }
    return updated;
}
