import { Journey, Language, migrateJourney } from './model';
export type UserSettings = Journey & {
    language: Language;
    dailySpend: number;
    cigarettesPerDay: number;
    goalName: string;
    goalPrice: number;
    lastCigaretteAt: number;
    reminderHour: number;
    reminderMinute: number;
    notificationsEnabled: boolean;
    motivationNotificationsEnabled: boolean;
    confirmedDates: string[];
    planHistory?: { quitAt: number; changedAt: number }[];
};
function wrap(value: number, min: number, max: number) { const span = max - min + 1; return ((((value - min) % span) + span) % span) + min; }
function isDateKey(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
export function normalizeSettings(parsed: unknown): UserSettings | null {
    if (parsed == null || typeof parsed !== 'object')
        return null;
    const data = parsed as Record<string, unknown>;
    if (typeof data.dailySpend !== 'number' ||
        typeof data.cigarettesPerDay !== 'number' ||
        typeof data.goalName !== 'string' ||
        typeof data.goalPrice !== 'number' ||
        typeof data.lastCigaretteAt !== 'number') {
        return null;
    }
    const reminderHour = typeof data.reminderHour === 'number' && Number.isInteger(data.reminderHour)
        ? wrap(data.reminderHour, 0, 23)
        : 20;
    const reminderMinute = typeof data.reminderMinute === 'number' && Number.isInteger(data.reminderMinute)
        ? wrap(data.reminderMinute, 0, 59)
        : 0;
    if (![data.dailySpend, data.cigarettesPerDay, data.goalPrice, data.lastCigaretteAt].every(n => typeof n === "number" && Number.isFinite(n)) || data.dailySpend <= 0 || data.cigarettesPerDay <= 0 || data.goalPrice <= 0)
        return null;
    return {
        ...data,
        ...migrateJourney(data),
        ...(Array.isArray(data.planHistory) ? { planHistory: data.planHistory.filter(p => p && Number.isFinite(p.quitAt) && Number.isFinite(p.changedAt)) } : {}),
        language: data.language === 'ru' ? 'ru' : data.language === 'en' ? 'en' : 'et',
        dailySpend: data.dailySpend,
        cigarettesPerDay: data.cigarettesPerDay,
        goalName: data.goalName,
        goalPrice: data.goalPrice,
        lastCigaretteAt: data.lastCigaretteAt,
        reminderHour,
        reminderMinute,
        notificationsEnabled: data.notificationsEnabled === true,
        motivationNotificationsEnabled: typeof data.motivationNotificationsEnabled === 'boolean'
            ? data.motivationNotificationsEnabled
            : true,
        confirmedDates: Array.isArray(data.confirmedDates)
            ? data.confirmedDates.filter(isDateKey)
            : [],
    };
}
