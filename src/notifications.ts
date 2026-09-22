// Existing concrete-date scheduler, extracted without changing its trigger mechanism.
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { copy, t } from './i18n';
import { russianMotivation } from './content';
import type { Language } from './model';
import type { UserSettings } from './storage';
const CHALLENGE_DAYS = 30;
const NOTIFICATION_CHANNEL = 'quit30-daily';
function formatMoney(n: number) { return '€' + n.toFixed(2); }
type NotificationsModule = typeof import('expo-notifications');
export const notificationsUnavailableInExpoGo = Platform.OS === 'android' && isRunningInExpoGo();
let notificationsModule: NotificationsModule | null = null;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
async function getNotificationsModule(): Promise<NotificationsModule | null> {
    if (notificationsUnavailableInExpoGo || Platform.OS === 'web')
        return null;
    if (notificationsModule)
        return notificationsModule;
    if (!notificationsModulePromise) {
        notificationsModulePromise = import('expo-notifications')
            .then((Notifications) => {
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldPlaySound: true,
                    shouldSetBadge: false,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });
            notificationsModule = Notifications;
            return Notifications;
        })
            .catch(() => null);
    }
    return notificationsModulePromise;
}
export async function cancelDailyReminder(): Promise<void> {
    try {
        const Notifications = await getNotificationsModule();
        if (!Notifications)
            return;
        await Notifications.cancelAllScheduledNotificationsAsync();
    }
    catch {
        // App remains usable without notification access.
    }
}
type MotivationPlan = {
    at: number;
    titleEt: string;
    bodyEt: string;
    titleEn: string;
    bodyEn: string;
    key: string;
};
function buildMotivationPlans(settings: UserSettings): MotivationPlan[] {
    const dayMs = 86400000;
    const plans: MotivationPlan[] = [];
    const add = (at: number, key: string, titleEt: string, bodyEt: string, titleEn: string, bodyEn: string) => {
        plans.push({ at, key, titleEt, bodyEt, titleEn, bodyEn });
    };
    const quit = settings.lastCigaretteAt;
    add(quit + 12 * 60 * 60 * 1000, 'time-12h', '🍪 Pool päeva tehtud!', '12 tundi suitsuvaba. Võta virtuaalne küpsis — oled selle välja teeninud.', '🍪 Half a day done!', '12 hours smoke-free. Take a virtual cookie — you earned it.');
    add(quit + dayMs, 'time-24h', '🏅 Esimene päev tehtud!', '24 tundi suitsuvaba. Esimene täispäev on sinu.', '🏅 First day complete!', '24 hours smoke-free. Your first full day is yours.');
    add(quit + 3 * dayMs, 'time-3d', '🔥 3 päeva suitsuvaba', 'Kolm päeva järjest. Ära anna seda viieminutilisele suitsuisule tagasi.', '🔥 3 days smoke-free', 'Three days in a row. Do not hand that progress back to a five-minute craving.');
    add(quit + 7 * dayMs, 'time-7d', '🏆 Nädal suitsuvaba', `7 päeva tehtud. Umbes ${formatMoney(settings.dailySpend * 7)} on sulle jäänud.`, '🏆 One week smoke-free', `7 days done. About ${formatMoney(settings.dailySpend * 7)} has stayed with you.`);
    add(quit + 14 * dayMs, 'time-14d', '🔥 Kaks nädalat', `14 päeva suitsuvaba. Umbes ${formatMoney(settings.dailySpend * 14)} säästetud.`, '🔥 Two weeks', `14 days smoke-free. About ${formatMoney(settings.dailySpend * 14)} saved.`);
    add(quit + 30 * dayMs, 'time-30d', '🏆 QUIT30 – 30 päeva!', `30 päeva tehtud. Umbes ${formatMoney(settings.dailySpend * 30)} jäi suitsule kulutamata.`, '🏆 QUIT30 – 30 days!', `30 days complete. About ${formatMoney(settings.dailySpend * 30)} was not spent on cigarettes.`);
    for (const amount of [10, 25, 50, 100, 200]) {
        const daysNeeded = amount / settings.dailySpend;
        if (daysNeeded <= 30) {
            add(quit + daysNeeded * dayMs, `money-${amount}`, `💰 ${amount} € säästetud`, `${amount} € jäi sulle, mitte suitsule. Vaata, kui kaugel on järgmine saavutus.`, `💰 €${amount} saved`, `€${amount} stayed with you instead of going to cigarettes. Check your next milestone.`);
        }
    }
    for (const amount of [25, 50, 100, 250, 500]) {
        const daysNeeded = amount / settings.cigarettesPerDay;
        if (daysNeeded <= 30) {
            add(quit + daysNeeded * dayMs, `cigs-${amount}`, `🚭 ${amount} sigaretti suitsetamata`, `${amount} sigaretti, mida sa ei ole suitsetanud. See number kasvab edasi.`, `🚭 ${amount} cigarettes not smoked`, `${amount} cigarettes you did not smoke. That number keeps growing.`);
        }
    }
    plans.sort((a, b) => a.at - b.at);
    return plans;
}
// Serialize schedule replacement: settings changes must not interleave cancellation/scheduling.
let scheduling: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = scheduling.then(job, job);
    scheduling = next.catch(() => undefined);
    return next;
}
async function clearReminders(Notifications: NotificationsModule) {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(pending.filter(n => n.content.data?.kind !== 'test-notification')
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
export function configureNotifications(settings: UserSettings): Promise<boolean> {
    return enqueue(() => configureNow(settings));
}
async function configureNow(settings: UserSettings): Promise<boolean> {
    try {
        const Notifications = await getNotificationsModule();
        if (!Notifications)
            return false;
        const wantsAny = settings.notificationsEnabled || settings.motivationNotificationsEnabled;
        if (!wantsAny) {
            await clearReminders(Notifications);
            return true;
        }
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
                name: copy(settings.language, 'QUIT30 teavitused', 'QUIT30 notifications', 'Уведомления QUIT30'),
                importance: Notifications.AndroidImportance.DEFAULT,
            });
        }
        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
            const requested = await Notifications.requestPermissionsAsync();
            status = requested.status;
        }
        if (status !== 'granted') {
            await clearReminders(Notifications);
            return false;
        }
        await clearReminders(Notifications);
        if (settings.notificationsEnabled || (settings.motivationNotificationsEnabled && Date.now() < settings.lastCigaretteAt)) {
            const now = Date.now();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            // Schedule concrete reminders for the rest of the 30-day challenge.
            // This mirrors the milestone notifications, which already proved reliable
            // on the test phones while the app was closed.
            for (let offset = 0; offset <= CHALLENGE_DAYS; offset += 1) {
                const reminderDate = new Date(today);
                reminderDate.setDate(reminderDate.getDate() + offset);
                reminderDate.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);
                const at = reminderDate.getTime();
                if (at <= now + 5000 || (!settings.notificationsEnabled && at >= settings.lastCigaretteAt))
                    continue;
                const elapsedDaysAtReminder = Math.max(0, (at - settings.lastCigaretteAt) / 86400000);
                const preparing = at < settings.lastCigaretteAt;
                const smokeFreeDay = preparing ? 0 : Math.floor(elapsedDaysAtReminder) + 1;
                // Keep the existing rolling concrete-date window after day 30 as well.
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: preparing ? t(settings.language, 'prepNotificationTitle') : copy(settings.language, `QUIT30 🔥 ${smokeFreeDay}. päev`, `QUIT30 🔥 Day ${smokeFreeDay}`, `QUIT30 🔥 День ${smokeFreeDay}`),
                        body: preparing ? t(settings.language, settings.motivationNotificationsEnabled ? (offset % 2 === 0 ? 'prepNotificationBody' : 'prepNotificationTip') : 'prepNotificationReminder') : copy(settings.language, 'Ava QUIT30 ja vaata, kuidas sul täna läheb.', 'Open QUIT30 and check in with yourself today.', 'Откройте QUIT30 и отметьте, как прошёл день.'),
                        sound: true,
                        data: { kind: settings.notificationsEnabled ? 'daily-reminder' : 'preparation-motivation', day: smokeFreeDay },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: reminderDate,
                        channelId: NOTIFICATION_CHANNEL,
                    },
                });
            }
        }
        if (settings.motivationNotificationsEnabled) {
            const now = Date.now();
            const plans = buildMotivationPlans(settings);
            for (const plan of plans) {
                if (plan.at <= now + 5000)
                    continue;
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: settings.language === 'ru' ? russianMotivation(plan.key).title : settings.language === 'et' ? plan.titleEt : plan.titleEn,
                        body: settings.language === 'ru' ? russianMotivation(plan.key).body : settings.language === 'et' ? plan.bodyEt : plan.bodyEn,
                        sound: true,
                        data: { kind: 'motivation', milestone: plan.key },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: new Date(plan.at),
                        channelId: NOTIFICATION_CHANNEL,
                    },
                });
            }
        }
        return true;
    }
    catch {
        return false;
    }
}
export type TestNotificationResult = 'scheduled' | 'denied' | 'unavailable' | 'failed';
export function scheduleTestNotification(language: Language): Promise<TestNotificationResult> {
    return enqueue(() => scheduleTestNow(language));
}
async function scheduleTestNow(language: Language): Promise<TestNotificationResult> {
    try {
        const Notifications = await getNotificationsModule();
        if (!Notifications)
            return 'unavailable';
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
                name: copy(language, 'QUIT30 teavitused', 'QUIT30 notifications', 'Уведомления QUIT30'),
                importance: Notifications.AndroidImportance.DEFAULT,
            });
        }
        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
            const requested = await Notifications.requestPermissionsAsync();
            status = requested.status;
        }
        if (status !== 'granted')
            return 'denied';
        const testDate = new Date(Date.now() + 5000);
        await Notifications.scheduleNotificationAsync({
            content: {
                title: copy(language, 'QUIT30 🔔 Test', 'QUIT30 🔔 Test', 'QUIT30 🔔 Тест'),
                body: copy(language, 'Kui näed seda suletud äpiga, töötab taustateavitus õigesti.', 'If you see this with the app closed, background delivery works.', 'Если вы видите это при закрытом приложении, доставка уведомлений работает.'),
                sound: true,
                data: { kind: 'test-notification' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: testDate,
                channelId: NOTIFICATION_CHANNEL,
            },
        });
        return 'scheduled';
    }
    catch {
        return 'failed';
    }
}
