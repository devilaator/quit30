import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

const STORAGE_KEY = 'quit30.userSettings.v1';
const CRAVING_END_KEY = 'quit30.cravingEndsAt.v1';
const CRAVING_SECONDS = 5 * 60;
const TICK_MS = 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const CHALLENGE_DAYS = 30;
const NOTIFICATION_CHANNEL = 'quit30-daily';

const COLORS = {
  bg: '#070A08',
  card: '#121814',
  cardBorder: '#1E2A22',
  green: '#22C55E',
  greenDim: '#16351F',
  greenText: '#86EFAC',
  text: '#F4F7F5',
  muted: '#8B9A90',
  input: '#0C110E',
  danger: '#F87171',
  white: '#FFFFFF',
};

type Language = 'et' | 'en';

type UserSettings = {
  language: Language;
  dailySpend: number;
  cigarettesPerDay: number;
  goalName: string;
  goalPrice: number;
  lastCigaretteAt: number;
  reminderHour: number;
  reminderMinute: number;
  notificationsEnabled: boolean;
  confirmedDates: string[];
};

type FormState = {
  dailySpend: string;
  cigarettesPerDay: string;
  goalName: string;
  goalPrice: string;
};

type FormErrors = Partial<Record<keyof FormState | 'lastCigaretteAt', string>>;

type LastCigarettePreset = 'today' | 'yesterday' | '3days' | '7days' | 'custom';

type SettingsDraft = FormState & {
  language: Language;
  reminderHour: number;
  reminderMinute: number;
  notificationsEnabled: boolean;
};

type NotificationsModule = typeof import('expo-notifications');

const TEXT = {
  et: {
    language: 'Keel',
    kicker: '30 PÄEVA. ÜKS OTSUS.',
    subtitle: 'Jälgi suitsuvaba aega, säästetud raha ja eesmärki, mille nimel loobud.',
    spendQuestion: 'Kui palju kulutasid suitsetamisele päevas?',
    cigarettesQuestion: 'Mitu sigaretti suitsetasid päevas?',
    savingsQuestion: 'Mille jaoks tahad raha säästa?',
    targetPrice: 'Eesmärgi hind (€)',
    lastCigarette: 'Millal tegid viimase sigareti?',
    today: 'Täna',
    yesterday: 'Eile',
    days3: '3 päeva tagasi',
    days7: '7 päeva tagasi',
    customDate: 'Vali kuupäev',
    progressStarts: 'Arvestus algab valitud kuupäevast, mitte äpi paigaldamisest.',
    reminderQuestion: 'Mis kell peaks QUIT30 sulle iga päev meelde tuletama?',
    hour: 'Tund',
    minute: 'Minut',
    expoGoNote: 'Igapäevased teavitused töötavad development- ja production-buildis. Androidi Expo Go-s neid ei ajastata.',
    reminderDefault: 'Vaikimisi 20:00. Teavituse luba küsitakse alles pärast QUIT30 alustamist.',
    start: 'ALUSTA QUIT30',
    chooseDate: 'Vali viimase sigareti kuupäev',
    day: 'Päev',
    month: 'Kuu',
    year: 'Aasta',
    useDate: 'Kasuta seda kuupäeva',
    cancel: 'Tühista',
    smokeFree: 'SUITSUVABA',
    currentDay: 'Praegune suitsuvaba päev',
    sinceLast: 'Alates viimasest sigaretist',
    todayConfirmed: '✓ Tänane päev kinnitatud',
    confirmToday: '✓ KINNITA TÄNANE PÄEV',
    confirmYesterday: 'Kinnita eilne päev',
    moneySaved: 'Säästetud raha',
    cigarettesNotSmoked: 'Suitsetamata sigarette',
    savingFor: 'Säästad eesmärgiks',
    ofGoal: 'eesmärgist',
    challenge30: '30 päeva väljakutse',
    challengeFromQuit: 'Arvestus algab viimasest sigaretist, mitte äpi paigaldamise päevast.',
    legend: '✓ kinnitatud  • kinnitamata  ○ tulevik',
    todaysThought: 'Tänane mõte',
    cravingButton: 'MUL ON SUITSUISU',
    cravingHint: '5 minuti suitsuisu taimer',
    rideItOut: 'Pea need minutid vastu',
    cravingDone: 'Sa said viis minutit hakkama.',
    cravingActive: 'Isu tõuseb ja langeb. Oota see hetk ära.',
    backDashboard: 'Tagasi avalehele',
    close: 'Sulge',
    settings: 'Seaded',
    dailyReminder: 'Igapäevase meeldetuletuse aeg',
    dailyNotifications: 'Igapäevased teavitused',
    notificationsOff: 'Teavitused on väljas. QUIT30 töötab ka ilma nendeta.',
    notificationDenied: 'Teavituste luba ei antud. QUIT30 töötab edasi ilma meeldetuletusteta.',
    dailyCost: 'Päevane suitsetamiskulu (€)',
    cigarettesPerDay: 'Sigarette päevas',
    savingsGoal: 'Säästueesmärk',
    goalPrice: 'Eesmärgi hind (€)',
    quitDateNote: 'Loobumise kuupäeva siin ei muudeta.',
    saveSettings: 'Salvesta seaded',
    errorAmount: 'Sisesta kehtiv summa, mis on suurem kui 0.',
    errorWholeNumber: 'Sisesta täisarv, mis on suurem kui 0.',
    errorGoal: 'Kirjuta, mille jaoks soovid säästa.',
    errorLastCigarette: 'Vali, millal tegid viimase sigareti.',
    errorFuture: 'Viimane sigaret ei saa olla tulevikus.',
  },
  en: {
    language: 'Language',
    kicker: '30 DAYS. ONE DECISION.',
    subtitle: 'Track smoke-free time, money saved, and the goal you are quitting for.',
    spendQuestion: 'How much did you spend on smoking per day?',
    cigarettesQuestion: 'How many cigarettes did you smoke per day?',
    savingsQuestion: 'What do you want to save money for?',
    targetPrice: 'Target price of that goal (€)',
    lastCigarette: 'When did you have your last cigarette?',
    today: 'Today',
    yesterday: 'Yesterday',
    days3: '3 days ago',
    days7: '7 days ago',
    customDate: 'Custom date',
    progressStarts: 'Progress starts from the selected date, not from app install.',
    reminderQuestion: 'What time should QUIT30 remind you every day?',
    hour: 'Hour',
    minute: 'Minute',
    expoGoNote: 'Daily reminders work in development and production builds. Expo Go on Android cannot schedule them.',
    reminderDefault: 'Default is 20:00. Permission is requested only after you start QUIT30.',
    start: 'START QUIT30',
    chooseDate: 'Choose last cigarette date',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    useDate: 'Use this date',
    cancel: 'Cancel',
    smokeFree: 'SMOKE-FREE',
    currentDay: 'Current smoke-free day',
    sinceLast: 'Since last cigarette',
    todayConfirmed: '✓ Today confirmed',
    confirmToday: '✓ CONFIRM TODAY',
    confirmYesterday: 'Confirm yesterday',
    moneySaved: 'Money saved',
    cigarettesNotSmoked: 'Cigarettes not smoked',
    savingFor: 'Saving for',
    ofGoal: 'of your goal',
    challenge30: '30-day challenge',
    challengeFromQuit: 'From your last cigarette, not from install day.',
    legend: '✓ confirmed  • unconfirmed  ○ future',
    todaysThought: 'Today’s thought',
    cravingButton: 'I AM CRAVING A CIGARETTE',
    cravingHint: '5-minute craving timer',
    rideItOut: 'Ride it out',
    cravingDone: 'You made it through five minutes.',
    cravingActive: 'The urge will peak and fall. Stay here.',
    backDashboard: 'Back to dashboard',
    close: 'Close',
    settings: 'Settings',
    dailyReminder: 'Daily reminder time',
    dailyNotifications: 'Daily notifications',
    notificationsOff: 'Notifications are off. QUIT30 still works without them.',
    notificationDenied: 'Notification permission was denied. QUIT30 will keep working without reminders.',
    dailyCost: 'Daily smoking cost (€)',
    cigarettesPerDay: 'Cigarettes per day',
    savingsGoal: 'Savings goal',
    goalPrice: 'Goal price (€)',
    quitDateNote: 'Quit date is not changed here.',
    saveSettings: 'Save settings',
    errorAmount: 'Enter a valid amount greater than 0.',
    errorWholeNumber: 'Enter a whole number greater than 0.',
    errorGoal: 'Tell us what you want to save for.',
    errorLastCigarette: 'Choose when you had your last cigarette.',
    errorFuture: 'Last cigarette cannot be in the future.',
  },
} as const;

function t(language: Language, key: keyof typeof TEXT.en): string {
  return TEXT[language][key];
}

const notificationsUnavailableInExpoGo = Platform.OS === 'android' && isRunningInExpoGo();

let notificationsModule: NotificationsModule | null = null;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (notificationsUnavailableInExpoGo || Platform.OS === 'web') return null;
  if (notificationsModule) return notificationsModule;
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function daysAgoMs(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function combineDateWithNowTime(date: Date): number {
  const now = new Date();
  const combined = new Date(date);
  combined.setHours(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  const ts = combined.getTime();
  return ts > Date.now() ? Date.now() : ts;
}

function formatExactDuration(ms: number, language: Language): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const dayUnit = language === 'et' ? 'p' : 'd';
  return `${days}${dayUnit} ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

function formatMoney(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addLocalDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function wrap(value: number, min: number, max: number): number {
  const span = max - min + 1;
  return ((((value - min) % span) + span) % span) + min;
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeSettings(parsed: unknown): UserSettings | null {
  if (parsed == null || typeof parsed !== 'object') return null;
  const data = parsed as Record<string, unknown>;
  if (
    typeof data.dailySpend !== 'number' ||
    typeof data.cigarettesPerDay !== 'number' ||
    typeof data.goalName !== 'string' ||
    typeof data.goalPrice !== 'number' ||
    typeof data.lastCigaretteAt !== 'number'
  ) {
    return null;
  }

  const reminderHour =
    typeof data.reminderHour === 'number' && Number.isInteger(data.reminderHour)
      ? wrap(data.reminderHour, 0, 23)
      : 20;
  const reminderMinute =
    typeof data.reminderMinute === 'number' && Number.isInteger(data.reminderMinute)
      ? wrap(data.reminderMinute, 0, 59)
      : 0;

  return {
    language: data.language === 'en' ? 'en' : 'et',
    dailySpend: data.dailySpend,
    cigarettesPerDay: data.cigarettesPerDay,
    goalName: data.goalName,
    goalPrice: data.goalPrice,
    lastCigaretteAt: data.lastCigaretteAt,
    reminderHour,
    reminderMinute,
    notificationsEnabled: data.notificationsEnabled === true,
    confirmedDates: Array.isArray(data.confirmedDates)
      ? data.confirmedDates.filter(isDateKey)
      : [],
  };
}

function canConfirmDate(dayStart: number, now: number): boolean {
  if (dayStart > startOfLocalDay(now)) return false;
  return now - dayStart < FORTY_EIGHT_HOURS_MS;
}

function challengeThought(
  day: number,
  dailySpend: number,
  elapsedDays: number,
  language: Language,
): string {
  const clampedDay = Math.min(CHALLENGE_DAYS, Math.max(1, day));
  const spentNow = formatMoney(elapsedDays * dailySpend);
  const todayCost = formatMoney(dailySpend);
  const weekCost = formatMoney(dailySpend * 7);
  const monthCost = formatMoney(dailySpend * 30);

  const english = [
    `Day 1. You already chose a different future. ${todayCost} stays with you instead of smoke.`,
    `Day 2. Cravings pass. ${todayCost} you used to burn today can start working for you.`,
    `Day 3. If you had kept smoking, you would have spent ${spentNow} by now.`,
    `Day 4. Three days in, your body is already changing. Keep the streak honest.`,
    `Day 5. One working week of this and you keep ${weekCost}. Stay with today.`,
    `Day 6. You are not waiting for motivation. You are collecting proof.`,
    `Day 7. One week. That is ${weekCost} you did not hand to cigarettes.`,
    `Day 8. Another smoke-free day. Open QUIT30 and check in.`,
    `Day 9. The urge is a wave. You have ridden it before. You can again.`,
    `Day 10. Double digits. ${spentNow} is already back on your side.`,
    `Day 11. Your clothes, car and hands do not need to smell of smoke anymore.`,
    `Day 12. Every unsmoked cigarette is a vote for the life you want.`,
    `Day 13. You do not have to plan your day around smoke breaks.`,
    `Day 14. Two weeks. ${formatMoney(dailySpend * 14)} not spent on smoke.`,
    `Day 15. Halfway through QUIT30. Do not give day 15 to a five-minute craving.`,
    `Day 16. You have already proved you can get through difficult moments.`,
    `Day 17. Tomorrow-you is counting on the check-in you make today.`,
    `Day 18. You no longer need to check how many cigarettes are left in the pack.`,
    `Day 19. If you had kept smoking, you would have spent ${spentNow} by now.`,
    `Day 20. Twenty days of choosing. That pattern is becoming your new normal.`,
    `Day 21. Three weeks. ${formatMoney(dailySpend * 21)} closer to your goal.`,
    `Day 22. The craving is temporary. Your progress is real.`,
    `Day 23. You do not need a perfect past. You only need today.`,
    `Day 24. The money keeps stacking because you keep showing up.`,
    `Day 25. Five days from 30. Do not negotiate with a craving tonight.`,
    `Day 26. You can already see the finish line. Keep walking.`,
    `Day 27. If you had kept smoking, 30 days would have cost ${monthCost}.`,
    `Day 28. Almost there. Protect the progress you have already made.`,
    `Day 29. One more honest day. That is the whole method.`,
    `Day 30. Thirty days. ${spentNow} saved, and a new default: smoke-free.`,
  ];

  const estonian = [
    `1. päev. Sa valisid juba teise suuna. Täna jääb ${todayCost} suitsu asemel sulle.`,
    `2. päev. Suitsuisu läheb üle. ${todayCost}, mille varem ära põletaksid, jääb nüüd sinu jaoks.`,
    `3. päev. Kui oleksid jätkanud, oleksid praeguseks kulutanud umbes ${spentNow}.`,
    `4. päev. Sa ei pea enam iga tegevuse vahel mõtlema järgmisele suitsupausile.`,
    `5. päev. Ühe töönädalaga jääb sulle umbes ${weekCost}.`,
    `6. päev. Sa ei oota enam motivatsiooni — sa kogud tõendeid, et saad hakkama.`,
    `7. päev. Nädal täis. ${weekCost}, mida sa ei andnud sigarettidele.`,
    `8. päev. Veel üks suitsuvaba päev. Kinnita see QUIT30-s.`,
    `9. päev. Suitsuisu on nagu laine: see tõuseb ja läheb jälle alla.`,
    `10. päev. Kahekohaline number. Umbes ${spentNow} on juba sinu poolel.`,
    `11. päev. Riided, auto ja käed ei pea enam suitsu järgi haisema.`,
    `12. päev. Iga suitsetamata sigaret kinnitab sinu enda otsust.`,
    `13. päev. Sa ei pea enam oma päeva suitsupauside järgi planeerima.`,
    `14. päev. Kaks nädalat. ${formatMoney(dailySpend * 14)} jäi suitsule kulutamata.`,
    `15. päev. Pool QUIT30-st on tehtud. Ära anna seda viieminutilisele suitsuisule tagasi.`,
    `16. päev. Sa oled juba tõestanud, et saad rasketest hetkedest läbi.`,
    `17. päev. Homme on sul hea meel, kui tänase päeva jälle ära kinnitad.`,
    `18. päev. Sa ei pea enam kontrollima, mitu sigaretti pakis alles on.`,
    `19. päev. Kui oleksid jätkanud, oleksid praeguseks kulutanud umbes ${spentNow}.`,
    `20. päev. Kakskümmend päeva järjest — sellest hakkab saama uus normaalsus.`,
    `21. päev. Kolm nädalat. ${formatMoney(dailySpend * 21)} lähemal sinu eesmärgile.`,
    `22. päev. Suitsuisu on ajutine. See, mida oled juba saavutanud, on päris.`,
    `23. päev. Sul pole vaja täiuslikku minevikku. Sul on vaja ainult tänast päeva.`,
    `24. päev. Raha koguneb, sest sina jätkad.`,
    `25. päev. Viis päeva 30-ni. Ära hakka täna õhtul suitsuisuga läbirääkimisi pidama.`,
    `26. päev. Finiš on juba näha. Liigu samamoodi edasi.`,
    `27. päev. Kui oleksid suitsetamist jätkanud, läheks 30 päevaga umbes ${monthCost}.`,
    `28. päev. Peaaegu kohal. Hoia seda, mille oled juba saavutanud.`,
    `29. päev. Veel üks päev. Just nii see töötabki.`,
    `30. päev. Kolmkümmend päeva. Umbes ${spentNow} säästetud ja uus harjumus on tekkinud.`,
  ];

  return (language === 'et' ? estonian : english)[clampedDay - 1];
}

function shiftDate(date: Date, unit: 'day' | 'month' | 'year', delta: number): Date {
  const next = new Date(date);
  if (unit === 'day') next.setDate(next.getDate() + delta);
  if (unit === 'month') next.setMonth(next.getMonth() + delta);
  if (unit === 'year') next.setFullYear(next.getFullYear() + delta);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (next.getTime() > today.getTime()) return new Date();
  return next;
}

async function cancelDailyReminder(): Promise<void> {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // App remains usable without notification access.
  }
}

async function enableDailyReminder(settings: UserSettings): Promise<boolean> {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
        name: settings.language === 'et' ? 'QUIT30 igapäevane meeldetuletus' : 'QUIT30 daily reminder',
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
      await cancelDailyReminder();
      return false;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    const elapsedDays = Math.max(0, Date.now() - settings.lastCigaretteAt) / 86400000;
    const smokeFreeDay = Math.floor(elapsedDays) + 1;
    await Notifications.scheduleNotificationAsync({
      content: {
        title:
          settings.language === 'et'
            ? `QUIT30 🔥 ${smokeFreeDay}. päev`
            : `QUIT30 🔥 Day ${smokeFreeDay}`,
        body:
          settings.language === 'et'
            ? 'Veel üks suitsuvaba päev. Ava QUIT30 ja kinnita tänane päev.'
            : 'Another smoke-free day. Open QUIT30 and check in.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.reminderHour,
        minute: settings.reminderMinute,
        channelId: NOTIFICATION_CHANNEL,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [language, setLanguage] = useState<Language>('et');
  const [now, setNow] = useState(() => Date.now());
  const [cravingOpen, setCravingOpen] = useState(false);
  const [cravingLeft, setCravingLeft] = useState(CRAVING_SECONDS);
  const [cravingEndsAt, setCravingEndsAt] = useState<number | null>(null);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customDate, setCustomDate] = useState(() => new Date());
  const [preset, setPreset] = useState<LastCigarettePreset | null>(null);
  const [lastCigaretteAt, setLastCigaretteAt] = useState<number | null>(null);
  const [reminderHour, setReminderHour] = useState(20);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [form, setForm] = useState<FormState>({
    dailySpend: '',
    cigarettesPerDay: '',
    goalName: '',
    goalPrice: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [settingsErrors, setSettingsErrors] = useState<FormErrors>({});
  const [settingsNote, setSettingsNote] = useState<string | null>(null);

  const refreshCravingFromClock = useCallback(async () => {
    let endsAt = cravingEndsAt;

    // If state was lost (app restart / Expo reload), restore the deadline.
    if (endsAt == null) {
      try {
        const raw = await AsyncStorage.getItem(CRAVING_END_KEY);
        const restored = raw ? Number(raw) : NaN;
        if (Number.isFinite(restored) && restored > 0) {
          endsAt = restored;
          setCravingEndsAt(restored);
        }
      } catch {
        // Ignore unreadable timer state.
      }
    }

    if (endsAt == null) {
      setCravingLeft(CRAVING_SECONDS);
      return;
    }

    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    setCravingLeft(remaining);

    if (remaining <= 0) {
      try {
        await AsyncStorage.removeItem(CRAVING_END_KEY);
      } catch {
        // Ignore storage cleanup errors.
      }
    }
  }, [cravingEndsAt]);

  const persistSettings = useCallback(async (next: UserSettings) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSettings(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const normalized = normalizeSettings(JSON.parse(raw));
          if (normalized) setSettings(normalized);
        }
      } catch {
        // Keep onboarding if storage is unreadable.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [settings]);

  useEffect(() => {
    if (!cravingOpen) return;

    void refreshCravingFromClock();

    const id = setInterval(() => {
      void refreshCravingFromClock();
    }, TICK_MS);

    return () => clearInterval(id);
  }, [cravingOpen, refreshCravingFromClock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshCravingFromClock();
      }
    });
    return () => subscription.remove();
  }, [refreshCravingFromClock]);

  useEffect(() => {
    if (notificationsUnavailableInExpoGo || !settings?.notificationsEnabled) return;
    void enableDailyReminder(settings);
  }, [
    settings?.notificationsEnabled,
    settings?.reminderHour,
    settings?.reminderMinute,
    settings?.lastCigaretteAt,
  ]);

  const stats = useMemo(() => {
    if (!settings) return null;
    const elapsedMs = Math.max(0, now - settings.lastCigaretteAt);
    const elapsedDays = elapsedMs / 86400000;
    const moneySaved = elapsedDays * settings.dailySpend;
    const cigarettesAvoided = elapsedDays * settings.cigarettesPerDay;
    const smokeFreeDay = Math.floor(elapsedDays) + 1;
    const goalProgress = Math.min(100, (moneySaved / settings.goalPrice) * 100);
    const challengeStart = startOfLocalDay(settings.lastCigaretteAt);
    const todayStart = startOfLocalDay(now);
    const yesterdayStart = addLocalDays(todayStart, -1);
    const todayKey = formatDateLabel(todayStart);
    const yesterdayKey = formatDateLabel(yesterdayStart);
    const confirmed = new Set(settings.confirmedDates);
    const calendar = Array.from({ length: CHALLENGE_DAYS }, (_, index) => {
      const dayStart = addLocalDays(challengeStart, index);
      const key = formatDateLabel(dayStart);
      const isFuture = dayStart > todayStart;
      const isConfirmed = confirmed.has(key);
      const state: 'confirmed' | 'current' | 'future' = isFuture
        ? 'future'
        : isConfirmed
          ? 'confirmed'
          : 'current';
      return { day: index + 1, key, dayStart, state };
    });

    return {
      elapsedMs,
      elapsedDays,
      moneySaved,
      cigarettesAvoided,
      smokeFreeDay,
      goalProgress,
      challengeStart,
      todayStart,
      yesterdayStart,
      todayKey,
      yesterdayKey,
      todayConfirmed: confirmed.has(todayKey),
      yesterdayConfirmed: confirmed.has(yesterdayKey),
      canConfirmToday: canConfirmDate(todayStart, now),
      canConfirmYesterday:
        yesterdayStart >= challengeStart && canConfirmDate(yesterdayStart, now),
      calendar,
    };
  }, [now, settings]);

  const setField = useCallback((key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const applyPreset = useCallback((next: LastCigarettePreset) => {
    setPreset(next);
    setErrors((prev) => ({ ...prev, lastCigaretteAt: undefined }));
    if (next === 'today') setLastCigaretteAt(Date.now());
    if (next === 'yesterday') setLastCigaretteAt(daysAgoMs(1));
    if (next === '3days') setLastCigaretteAt(daysAgoMs(3));
    if (next === '7days') setLastCigaretteAt(daysAgoMs(7));
    if (next === 'custom') {
      setCustomDate(new Date());
      setCustomPickerOpen(true);
    }
  }, []);

  const confirmCustomDate = useCallback(() => {
    const ts = combineDateWithNowTime(customDate);
    setLastCigaretteAt(ts);
    setPreset('custom');
    setCustomPickerOpen(false);
  }, [customDate]);

  const startQuit = useCallback(async () => {
    const dailySpend = parsePositiveNumber(form.dailySpend);
    const cigarettesPerDay = parsePositiveInt(form.cigarettesPerDay);
    const goalPrice = parsePositiveNumber(form.goalPrice);
    const goalName = form.goalName.trim();
    const nextErrors: FormErrors = {};

    if (dailySpend == null) nextErrors.dailySpend = t(language, 'errorAmount');
    if (cigarettesPerDay == null) {
      nextErrors.cigarettesPerDay = t(language, 'errorWholeNumber');
    }
    if (!goalName) nextErrors.goalName = t(language, 'errorGoal');
    if (goalPrice == null) nextErrors.goalPrice = t(language, 'errorAmount');
    if (lastCigaretteAt == null) {
      nextErrors.lastCigaretteAt = t(language, 'errorLastCigarette');
    } else if (lastCigaretteAt > Date.now()) {
      nextErrors.lastCigaretteAt = t(language, 'errorFuture');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const nextSettings: UserSettings = {
      language,
      dailySpend: dailySpend as number,
      cigarettesPerDay: cigarettesPerDay as number,
      goalName,
      goalPrice: goalPrice as number,
      lastCigaretteAt: lastCigaretteAt as number,
      reminderHour,
      reminderMinute,
      notificationsEnabled: false,
      confirmedDates: [],
    };

    const notificationsEnabled = notificationsUnavailableInExpoGo
      ? false
      : await enableDailyReminder(nextSettings);
    const saved = { ...nextSettings, notificationsEnabled };
    await persistSettings(saved);
    setNow(Date.now());
  }, [form, language, lastCigaretteAt, persistSettings, reminderHour, reminderMinute]);

  const confirmDay = useCallback(
    async (dateKey: string, dayStart: number) => {
      if (!settings) return;
      if (!canConfirmDate(dayStart, Date.now())) return;
      if (settings.confirmedDates.includes(dateKey)) return;
      const confirmedDates = [...settings.confirmedDates, dateKey].sort();
      await persistSettings({ ...settings, confirmedDates });
    },
    [persistSettings, settings],
  );

  const openSettings = useCallback(() => {
    if (!settings) return;
    setSettingsErrors({});
    setSettingsNote(
      notificationsUnavailableInExpoGo
        ? t(settings.language, 'expoGoNote')
        : settings.notificationsEnabled
          ? null
          : t(settings.language, 'notificationsOff'),
    );
    setSettingsDraft({
      language: settings.language,
      dailySpend: String(settings.dailySpend),
      cigarettesPerDay: String(settings.cigarettesPerDay),
      goalName: settings.goalName,
      goalPrice: String(settings.goalPrice),
      reminderHour: settings.reminderHour,
      reminderMinute: settings.reminderMinute,
      notificationsEnabled: settings.notificationsEnabled,
    });
    setSettingsOpen(true);
  }, [settings]);

  const saveSettings = useCallback(async () => {
    if (!settings || !settingsDraft) return;
    const dailySpend = parsePositiveNumber(settingsDraft.dailySpend);
    const cigarettesPerDay = parsePositiveInt(settingsDraft.cigarettesPerDay);
    const goalPrice = parsePositiveNumber(settingsDraft.goalPrice);
    const goalName = settingsDraft.goalName.trim();
    const nextErrors: FormErrors = {};

    if (dailySpend == null) nextErrors.dailySpend = t(settingsDraft.language, 'errorAmount');
    if (cigarettesPerDay == null) {
      nextErrors.cigarettesPerDay = t(settingsDraft.language, 'errorWholeNumber');
    }
    if (!goalName) nextErrors.goalName = t(settingsDraft.language, 'errorGoal');
    if (goalPrice == null) nextErrors.goalPrice = t(settingsDraft.language, 'errorAmount');

    if (Object.keys(nextErrors).length > 0) {
      setSettingsErrors(nextErrors);
      return;
    }

    const nextSettings: UserSettings = {
      ...settings,
      language: settingsDraft.language,
      dailySpend: dailySpend as number,
      cigarettesPerDay: cigarettesPerDay as number,
      goalName,
      goalPrice: goalPrice as number,
      reminderHour: settingsDraft.reminderHour,
      reminderMinute: settingsDraft.reminderMinute,
      notificationsEnabled: settingsDraft.notificationsEnabled,
    };

    let notificationsEnabled = settingsDraft.notificationsEnabled;
    if (notificationsUnavailableInExpoGo) {
      notificationsEnabled = false;
    } else if (settingsDraft.notificationsEnabled) {
      notificationsEnabled = await enableDailyReminder(nextSettings);
      if (!notificationsEnabled) {
        setSettingsNote(
          t(settingsDraft.language, 'notificationDenied'),
        );
      }
    } else {
      await cancelDailyReminder();
    }

    await persistSettings({
      ...nextSettings,
      reminderHour: settingsDraft.reminderHour,
      reminderMinute: settingsDraft.reminderMinute,
      notificationsEnabled,
    });
    if (notificationsEnabled) setSettingsNote(null);
    setSettingsOpen(false);
  }, [persistSettings, settings, settingsDraft]);

  const resetToOnboarding = useCallback(async () => {
    await cancelDailyReminder();
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(CRAVING_END_KEY);
    setSettings(null);
    setLanguage('et');
    setPreset(null);
    setLastCigaretteAt(null);
    setReminderHour(20);
    setReminderMinute(0);
    setForm({
      dailySpend: '',
      cigarettesPerDay: '',
      goalName: '',
      goalPrice: '',
    });
    setErrors({});
    setCravingOpen(false);
    setCravingEndsAt(null);
    setSettingsOpen(false);
  }, []);

  const openCraving = useCallback(async () => {
    let endsAt: number | null = cravingEndsAt;

    // Re-use an already active timer instead of restarting it.
    if (endsAt == null) {
      try {
        const raw = await AsyncStorage.getItem(CRAVING_END_KEY);
        const restored = raw ? Number(raw) : NaN;
        if (Number.isFinite(restored) && restored > Date.now()) {
          endsAt = restored;
        }
      } catch {
        // Ignore storage errors and start a new timer below.
      }
    }

    if (endsAt == null || endsAt <= Date.now()) {
      endsAt = Date.now() + CRAVING_SECONDS * 1000;
      try {
        await AsyncStorage.setItem(CRAVING_END_KEY, String(endsAt));
      } catch {
        // Timer still works in memory if storage is unavailable.
      }
    }

    setCravingEndsAt(endsAt);
    setCravingLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    setCravingOpen(true);
  }, [cravingEndsAt]);

  const topPad = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + 8 : 54;

  if (!hydrated) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <Text style={styles.brand}>QUIT30</Text>
      </View>
    );
  }

  if (!settings || !stats) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.onboardingContent, { paddingTop: topPad }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.kicker}>{t(language, 'kicker')}</Text>
            <Text style={styles.brand}>QUIT30</Text>
            <View style={styles.chipRow}>
              <Chip label="Eesti" active={language === 'et'} onPress={() => setLanguage('et')} />
              <Chip label="English" active={language === 'en'} onPress={() => setLanguage('en')} />
            </View>
            <Text style={styles.subtitle}>{t(language, 'subtitle')}</Text>

            <View style={styles.card}>
              <FieldLabel>{t(language, 'spendQuestion')}</FieldLabel>
              <TextInput
                value={form.dailySpend}
                onChangeText={(v) => setField('dailySpend', v)}
                placeholder="e.g. 8.50"
                placeholderTextColor={COLORS.muted}
                keyboardType="decimal-pad"
                style={styles.input}
              />
              {errors.dailySpend ? <Text style={styles.error}>{errors.dailySpend}</Text> : null}

              <FieldLabel>{t(language, 'cigarettesQuestion')}</FieldLabel>
              <TextInput
                value={form.cigarettesPerDay}
                onChangeText={(v) => setField('cigarettesPerDay', v)}
                placeholder="e.g. 20"
                placeholderTextColor={COLORS.muted}
                keyboardType="number-pad"
                style={styles.input}
              />
              {errors.cigarettesPerDay ? (
                <Text style={styles.error}>{errors.cigarettesPerDay}</Text>
              ) : null}

              <FieldLabel>{t(language, 'savingsQuestion')}</FieldLabel>
              <TextInput
                value={form.goalName}
                onChangeText={(v) => setField('goalName', v)}
                placeholder="e.g. a weekend trip"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />
              {errors.goalName ? <Text style={styles.error}>{errors.goalName}</Text> : null}

              <FieldLabel>{t(language, 'targetPrice')}</FieldLabel>
              <TextInput
                value={form.goalPrice}
                onChangeText={(v) => setField('goalPrice', v)}
                placeholder="e.g. 300"
                placeholderTextColor={COLORS.muted}
                keyboardType="decimal-pad"
                style={styles.input}
              />
              {errors.goalPrice ? <Text style={styles.error}>{errors.goalPrice}</Text> : null}
            </View>

            <View style={styles.card}>
              <FieldLabel>{t(language, 'lastCigarette')}</FieldLabel>
              <View style={styles.chipRow}>
                <Chip
                  label={t(language, 'today')}
                  active={preset === 'today'}
                  onPress={() => applyPreset('today')}
                />
                <Chip
                  label={t(language, 'yesterday')}
                  active={preset === 'yesterday'}
                  onPress={() => applyPreset('yesterday')}
                />
                <Chip
                  label={t(language, 'days3')}
                  active={preset === '3days'}
                  onPress={() => applyPreset('3days')}
                />
                <Chip
                  label={t(language, 'days7')}
                  active={preset === '7days'}
                  onPress={() => applyPreset('7days')}
                />
                <Chip
                  label={t(language, 'customDate')}
                  active={preset === 'custom'}
                  onPress={() => applyPreset('custom')}
                />
              </View>
              {lastCigaretteAt != null ? (
                <Text style={styles.helper}>
                  {t(language, 'progressStarts')} {formatDateLabel(lastCigaretteAt)}
                </Text>
              ) : null}
              {errors.lastCigaretteAt ? (
                <Text style={styles.error}>{errors.lastCigaretteAt}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <FieldLabel>{t(language, 'reminderQuestion')}</FieldLabel>
              <Text style={styles.customDateValue}>{formatTime(reminderHour, reminderMinute)}</Text>
              <Stepper
                label={t(language, 'hour')}
                value={pad2(reminderHour)}
                onMinus={() => setReminderHour((h) => wrap(h - 1, 0, 23))}
                onPlus={() => setReminderHour((h) => wrap(h + 1, 0, 23))}
              />
              <Stepper
                label={t(language, 'minute')}
                value={pad2(reminderMinute)}
                onMinus={() => setReminderMinute((m) => wrap(m - 1, 0, 59))}
                onPlus={() => setReminderMinute((m) => wrap(m + 1, 0, 59))}
              />
              <Text style={styles.helper}>
                {notificationsUnavailableInExpoGo
                  ? t(language, 'expoGoNote')
                  : t(language, 'reminderDefault')}
              </Text>
            </View>

            <Pressable style={styles.primaryButton} onPress={startQuit}>
              <Text style={styles.primaryButtonText}>{t(language, 'start')}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={customPickerOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t(language, 'chooseDate')}</Text>
              <Text style={styles.customDateValue}>{formatDateLabel(customDate.getTime())}</Text>
              <Stepper
                label={t(language, 'day')}
                value={String(customDate.getDate())}
                onMinus={() => setCustomDate((d) => shiftDate(d, 'day', -1))}
                onPlus={() => setCustomDate((d) => shiftDate(d, 'day', 1))}
              />
              <Stepper
                label={t(language, 'month')}
                value={String(customDate.getMonth() + 1)}
                onMinus={() => setCustomDate((d) => shiftDate(d, 'month', -1))}
                onPlus={() => setCustomDate((d) => shiftDate(d, 'month', 1))}
              />
              <Stepper
                label={t(language, 'year')}
                value={String(customDate.getFullYear())}
                onMinus={() => setCustomDate((d) => shiftDate(d, 'year', -1))}
                onPlus={() => setCustomDate((d) => shiftDate(d, 'year', 1))}
              />
              <Pressable style={styles.primaryButton} onPress={confirmCustomDate}>
                <Text style={styles.primaryButtonText}>{t(language, 'useDate')}</Text>
              </Pressable>
              <Pressable onPress={() => setCustomPickerOpen(false)}>
                <Text style={styles.link}>{t(language, 'cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const cravingMinutes = Math.floor(cravingLeft / 60);
  const cravingSecs = cravingLeft % 60;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.dashboardContent, { paddingTop: topPad }]}>
        <View style={styles.dashHeader}>
          <View>
            <Text style={styles.kicker}>{t(settings.language, 'smokeFree')}</Text>
            <Text style={styles.brand}>QUIT30</Text>
          </View>
          <Pressable onPress={openSettings} style={styles.gearButton} hitSlop={10}>
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{t(settings.language, 'currentDay')}</Text>
          <Text style={styles.heroNumber}>{t(settings.language, 'day')} {stats.smokeFreeDay}</Text>
          <Text style={styles.heroSub}>{formatExactDuration(stats.elapsedMs, settings.language)}</Text>
          <Text style={styles.tinyMuted}>
            {t(settings.language, 'sinceLast')} · {formatDateLabel(settings.lastCigaretteAt)}
          </Text>
        </View>

        {stats.todayConfirmed ? (
          <View style={styles.confirmedBanner}>
            <Text style={styles.confirmedBannerText}>{t(settings.language, 'todayConfirmed')}</Text>
          </View>
        ) : (
          <Pressable
            style={styles.checkinButton}
            onPress={() => void confirmDay(stats.todayKey, stats.todayStart)}
          >
            <Text style={styles.checkinButtonText}>{t(settings.language, 'confirmToday')}</Text>
          </Pressable>
        )}
        {stats.canConfirmYesterday && !stats.yesterdayConfirmed ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void confirmDay(stats.yesterdayKey, stats.yesterdayStart)}
          >
            <Text style={styles.secondaryButtonText}>{t(settings.language, 'confirmYesterday')}</Text>
          </Pressable>
        ) : null}

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t(settings.language, 'moneySaved')}</Text>
            <Text style={styles.statValue}>{formatMoney(stats.moneySaved)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t(settings.language, 'cigarettesNotSmoked')}</Text>
            <Text style={styles.statValue}>{stats.cigarettesAvoided.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.statLabel}>
            {t(settings.language, 'savingFor')} {settings.goalName}
          </Text>
          <Text style={styles.goalNumbers}>
            {formatMoney(stats.moneySaved)} / {formatMoney(settings.goalPrice)}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${stats.goalProgress}%` }]} />
          </View>
          <Text style={styles.helper}>
            {stats.goalProgress.toFixed(1)}% {t(settings.language, 'ofGoal')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.statLabel}>{t(settings.language, 'challenge30')}</Text>
          <Text style={styles.helper}>{t(settings.language, 'challengeFromQuit')}</Text>
          <View style={styles.calendarGrid}>
            {stats.calendar.map((item) => (
              <View
                key={item.key}
                style={[
                  styles.calendarCell,
                  item.state === 'confirmed' ? styles.calendarConfirmed : null,
                  item.state === 'current' ? styles.calendarCurrent : null,
                ]}
              >
                <Text
                  style={[
                    styles.calendarMark,
                    item.state === 'future' ? styles.calendarFutureMark : null,
                  ]}
                >
                  {item.state === 'confirmed' ? '✓' : item.state === 'current' ? '•' : '○'}
                </Text>
                <Text style={styles.calendarDay}>{item.day}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.tinyMuted}>{t(settings.language, 'legend')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.statLabel}>{t(settings.language, 'todaysThought')}</Text>
          <Text style={styles.thought}>
            {challengeThought(
              stats.smokeFreeDay,
              settings.dailySpend,
              stats.elapsedDays,
              settings.language,
            )}
          </Text>
        </View>

        <Pressable style={styles.cravingButton} onPress={openCraving}>
          <Text style={styles.cravingButtonText}>{t(settings.language, 'cravingButton')}</Text>
          <Text style={styles.cravingHint}>{t(settings.language, 'cravingHint')}</Text>
        </Pressable>

        <Pressable onPress={resetToOnboarding} style={styles.devReset}>
          <Text style={styles.devResetText}>DEV RESET</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={cravingOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(settings.language, 'rideItOut')}</Text>
            <Text style={styles.countdown}>
              {pad2(cravingMinutes)}:{pad2(cravingSecs)}
            </Text>
            <Text style={styles.helper}>
              {cravingLeft === 0
                ? t(settings.language, 'cravingDone')
                : t(settings.language, 'cravingActive')}
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => setCravingOpen(false)}>
              <Text style={styles.primaryButtonText}>
                {cravingLeft === 0
                  ? t(settings.language, 'backDashboard')
                  : t(settings.language, 'close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.settingsModalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {t(settingsDraft?.language ?? settings.language, 'settings')}
                </Text>
                {settingsDraft ? (
                  <>
                    <FieldLabel>{t(settingsDraft.language, 'language')}</FieldLabel>
                    <View style={styles.chipRow}>
                      <Chip
                        label="Eesti"
                        active={settingsDraft.language === 'et'}
                        onPress={() =>
                          setSettingsDraft((d) => (d ? { ...d, language: 'et' } : d))
                        }
                      />
                      <Chip
                        label="English"
                        active={settingsDraft.language === 'en'}
                        onPress={() =>
                          setSettingsDraft((d) => (d ? { ...d, language: 'en' } : d))
                        }
                      />
                    </View>

                    <FieldLabel>{t(settingsDraft.language, 'dailyReminder')}</FieldLabel>
                    <Text style={styles.customDateValue}>
                      {formatTime(settingsDraft.reminderHour, settingsDraft.reminderMinute)}
                    </Text>
                    <Stepper
                      label={t(settingsDraft.language, 'hour')}
                      value={pad2(settingsDraft.reminderHour)}
                      onMinus={() =>
                        setSettingsDraft((d) =>
                          d ? { ...d, reminderHour: wrap(d.reminderHour - 1, 0, 23) } : d,
                        )
                      }
                      onPlus={() =>
                        setSettingsDraft((d) =>
                          d ? { ...d, reminderHour: wrap(d.reminderHour + 1, 0, 23) } : d,
                        )
                      }
                    />
                    <Stepper
                      label={t(settingsDraft.language, 'minute')}
                      value={pad2(settingsDraft.reminderMinute)}
                      onMinus={() =>
                        setSettingsDraft((d) =>
                          d ? { ...d, reminderMinute: wrap(d.reminderMinute - 1, 0, 59) } : d,
                        )
                      }
                      onPlus={() =>
                        setSettingsDraft((d) =>
                          d ? { ...d, reminderMinute: wrap(d.reminderMinute + 1, 0, 59) } : d,
                        )
                      }
                    />

                    <View style={styles.toggleRow}>
                      <Text style={styles.label}>{t(settingsDraft.language, 'dailyNotifications')}</Text>
                      <Switch
                        value={settingsDraft.notificationsEnabled}
                        onValueChange={(value) =>
                          setSettingsDraft((d) =>
                            d ? { ...d, notificationsEnabled: value } : d,
                          )
                        }
                        trackColor={{ false: COLORS.cardBorder, true: COLORS.green }}
                        thumbColor={COLORS.white}
                      />
                    </View>
                    {settingsNote ? <Text style={styles.helper}>{settingsNote}</Text> : null}

                    <FieldLabel>{t(settingsDraft.language, 'dailyCost')}</FieldLabel>
                    <TextInput
                      value={settingsDraft.dailySpend}
                      onChangeText={(v) =>
                        setSettingsDraft((d) => (d ? { ...d, dailySpend: v } : d))
                      }
                      keyboardType="decimal-pad"
                      style={styles.input}
                      placeholderTextColor={COLORS.muted}
                    />
                    {settingsErrors.dailySpend ? (
                      <Text style={styles.error}>{settingsErrors.dailySpend}</Text>
                    ) : null}

                    <FieldLabel>{t(settingsDraft.language, 'cigarettesPerDay')}</FieldLabel>
                    <TextInput
                      value={settingsDraft.cigarettesPerDay}
                      onChangeText={(v) =>
                        setSettingsDraft((d) => (d ? { ...d, cigarettesPerDay: v } : d))
                      }
                      keyboardType="number-pad"
                      style={styles.input}
                      placeholderTextColor={COLORS.muted}
                    />
                    {settingsErrors.cigarettesPerDay ? (
                      <Text style={styles.error}>{settingsErrors.cigarettesPerDay}</Text>
                    ) : null}

                    <FieldLabel>{t(settingsDraft.language, 'savingsGoal')}</FieldLabel>
                    <TextInput
                      value={settingsDraft.goalName}
                      onChangeText={(v) =>
                        setSettingsDraft((d) => (d ? { ...d, goalName: v } : d))
                      }
                      style={styles.input}
                      placeholderTextColor={COLORS.muted}
                    />
                    {settingsErrors.goalName ? (
                      <Text style={styles.error}>{settingsErrors.goalName}</Text>
                    ) : null}

                    <FieldLabel>{t(settingsDraft.language, 'goalPrice')}</FieldLabel>
                    <TextInput
                      value={settingsDraft.goalPrice}
                      onChangeText={(v) =>
                        setSettingsDraft((d) => (d ? { ...d, goalPrice: v } : d))
                      }
                      keyboardType="decimal-pad"
                      style={styles.input}
                      placeholderTextColor={COLORS.muted}
                    />
                    {settingsErrors.goalPrice ? (
                      <Text style={styles.error}>{settingsErrors.goalPrice}</Text>
                    ) : null}

                    <Text style={styles.tinyMuted}>{t(settingsDraft.language, 'quitDateNote')}</Text>
                    <Pressable style={styles.primaryButton} onPress={() => void saveSettings()}>
                      <Text style={styles.primaryButtonText}>{t(settingsDraft.language, 'saveSettings')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setSettingsOpen(false)}>
                      <Text style={styles.link}>{t(settingsDraft.language, 'cancel')}</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={onMinus} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable onPress={onPlus} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  dashboardContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  kicker: {
    color: COLORS.green,
    letterSpacing: 2.4,
    fontSize: 12,
    fontWeight: '700',
  },
  brand: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
    marginTop: 6,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 22,
  },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.input,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: COLORS.danger,
    marginTop: 6,
    fontSize: 13,
  },
  helper: {
    color: COLORS.muted,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.input,
  },
  chipActive: {
    backgroundColor: COLORS.greenDim,
    borderColor: COLORS.green,
  },
  chipText: {
    color: COLORS.muted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.greenText,
  },
  primaryButton: {
    backgroundColor: COLORS.green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.6,
  },
  dashHeader: {
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  gearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  gearText: {
    color: COLORS.greenText,
    fontSize: 20,
  },
  heroCard: {
    backgroundColor: COLORS.greenDim,
    borderColor: COLORS.green,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: {
    color: COLORS.greenText,
    fontWeight: '600',
  },
  heroNumber: {
    color: COLORS.white,
    fontSize: 42,
    fontWeight: '800',
    marginTop: 4,
  },
  heroSub: {
    color: COLORS.text,
    fontSize: 18,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  tinyMuted: {
    color: COLORS.muted,
    marginTop: 8,
    fontSize: 12,
  },
  checkinButton: {
    backgroundColor: COLORS.green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  checkinButtonText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  confirmedBanner: {
    backgroundColor: COLORS.greenDim,
    borderColor: COLORS.green,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmedBannerText: {
    color: COLORS.greenText,
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: COLORS.green,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: COLORS.green,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  goalNumbers: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  progressTrack: {
    height: 10,
    backgroundColor: COLORS.input,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.green,
    borderRadius: 999,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  calendarCell: {
    width: '14.5%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarConfirmed: {
    backgroundColor: COLORS.greenDim,
    borderColor: COLORS.green,
  },
  calendarCurrent: {
    borderColor: COLORS.greenText,
  },
  calendarMark: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '800',
  },
  calendarFutureMark: {
    color: COLORS.muted,
  },
  calendarDay: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 2,
  },
  thought: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 8,
  },
  cravingButton: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.green,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  cravingButtonText: {
    color: COLORS.green,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.8,
  },
  cravingHint: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 12,
  },
  devReset: {
    alignSelf: 'center',
    marginTop: 22,
    padding: 8,
  },
  devResetText: {
    color: '#3A463E',
    fontSize: 11,
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 20,
  },
  settingsModalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  countdown: {
    color: COLORS.green,
    fontSize: 56,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 16,
    fontVariant: ['tabular-nums'],
  },
  customDateValue: {
    color: COLORS.greenText,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 14,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepperLabel: {
    color: COLORS.muted,
    width: 70,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.greenDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: COLORS.greenText,
    fontSize: 22,
    fontWeight: '700',
  },
  stepperValue: {
    color: COLORS.text,
    width: 48,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  link: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 14,
  },
});
