import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthCalendar } from './src/MonthCalendar';
import { changeQuitPlan } from './src/quitPlan';
import { StartupIntro } from './src/StartupIntro';
import { DevReset } from './src/DevReset';
import { BrandInfo } from './src/BrandInfo';
import { normalizeSettings, UserSettings } from './src/storage';
import { Action, LanguageSelector, SUPPORT_HISTORY_KEY, DateTimeEditor, GentleFade, HabitDraft, HabitEditor, parseHabit, ReasonsEditor, RecoveryCard, SupportCard, palette, ui } from './src/components';
import { cravingContent } from './src/content';
import { t, copy } from './src/i18n';
import { Language, migrateJourney, periodTotals, continuousStart, earnedAchievements, canConfirm, recordLapse as addLapse } from './src/model';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelDailyReminder, configureNotifications, scheduleTestNotification, notificationsUnavailableInExpoGo } from './src/notifications';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, } from 'react-native';
const STORAGE_KEY = 'quit30.userSettings.v1';
// QUIT30 v6: concrete daily notification dates + 2-minute test notification
const CRAVING_END_KEY = 'quit30.cravingEndsAt.v1';
const CRAVING_SECONDS = 5 * 60;
const TICK_MS = 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const CHALLENGE_DAYS = 30;
const COLORS = palette;
type FormState = {
    dailySpend: string;
    cigarettesPerDay: string;
    goalName: string;
    goalPrice: string;
};
type FormErrors = Partial<Record<keyof FormState | 'lastCigaretteAt', string>>;
type SettingsDraft = FormState & {
    language: Language;
    reminderHour: number;
    reminderMinute: number;
    notificationsEnabled: boolean;
    motivationNotificationsEnabled: boolean;
};
function pad2(n: number): string {
    return String(n).padStart(2, '0');
}
function formatExactDuration(ms: number, language: Language): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return copy(language, `${days}p ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`, `${days}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`, `${days}д ${pad2(hours)}ч ${pad2(minutes)}м ${pad2(seconds)}с`);
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
    if (!trimmed)
        return null;
    if (!/^\d+(\.\d+)?$/.test(trimmed))
        return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return n;
}
function parsePositiveInt(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (!/^\d+$/.test(trimmed))
        return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n <= 0)
        return null;
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
function canConfirmDate(dayStart: number, now: number): boolean {
    if (dayStart > startOfLocalDay(now))
        return false;
    return now - dayStart < FORTY_EIGHT_HOURS_MS;
}
export default function App() {
    return <SafeAreaProvider initialMetrics={initialWindowMetrics}><StartupIntro><Quit30App /></StartupIntro></SafeAreaProvider>;
}
function Quit30App() {
    const insets=useSafeAreaInsets();
    const modalInsets={paddingTop:insets.top+16,paddingBottom:insets.bottom+16,paddingLeft:insets.left+20,paddingRight:insets.right+20};
    const [planOpen,setPlanOpen]=useState(false);
    const [planAt,setPlanAt]=useState(Date.now());
    const [planPreparing,setPlanPreparing]=useState(false);
    const [planError,setPlanError]=useState('');
    const [planSaved,setPlanSaved]=useState(false);
    const [testBusy,setTestBusy]=useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [step, setStep] = useState(0);
    const [preparing, setPreparing] = useState(false);
    const [habit, setHabit] = useState<HabitDraft>({ packSize: '20', packPrice: '', packDays: '1', manual: '' });
    const [reasons, setReasons] = useState<string[]>([]);
    const [draftReasons, setDraftReasons] = useState<string[]>([]);
    const [draftHabit, setDraftHabit] = useState<HabitDraft>({ packSize: '20', packPrice: '', packDays: '1', manual: '' });
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [lapseOpen, setLapseOpen] = useState(false);
    const [lapseCount, setLapseCount] = useState('1');
    const [lapseAt, setLapseAt] = useState(Date.now());
    const [lapseError, setLapseError] = useState('');
    const [storageError, setStorageError] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const saving = useRef(false);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [language, setLanguage] = useState<Language>('et');
    const [now, setNow] = useState(() => Date.now());
    const [cravingOpen, setCravingOpen] = useState(false);
    const [cravingLeft, setCravingLeft] = useState(CRAVING_SECONDS);
    const [cravingEndsAt, setCravingEndsAt] = useState<number | null>(null);
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
            }
            catch {
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
            }
            catch {
                // Ignore storage cleanup errors.
            }
        }
    }, [cravingEndsAt]);
    const persistSettings = useCallback(async (next: UserSettings) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            setSettings(next);
            setStorageError(false);
            return true;
        }
        catch {
            setStorageError(true);
            return false;
        }
    }, []);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (!cancelled && raw) {
                    const normalized = normalizeSettings(JSON.parse(raw));
                    if (normalized)
                        setSettings(normalized);
                    else
                        setLoadError(true);
                }
            }
            catch {
                setLoadError(true);
            }
            finally {
                if (!cancelled)
                    setHydrated(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loadAttempt]);
    useEffect(() => {
        if (!settings)
            return;
        const id = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(id);
    }, [settings]);
    useEffect(() => {
        if (!cravingOpen)
            return;
        void refreshCravingFromClock();
        const id = setInterval(() => {
            void refreshCravingFromClock();
        }, TICK_MS);
        return () => clearInterval(id);
    }, [cravingOpen, refreshCravingFromClock]);
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                setNow(Date.now());
                void refreshCravingFromClock();
            }
        });
        return () => subscription.remove();
    }, [refreshCravingFromClock]);
    useEffect(() => {
        if (notificationsUnavailableInExpoGo || !settings)
            return;
        let active=true;
        void configureNotifications(settings).then(ok=>{
            if(active && !ok)setSettingsNote(t(settings.language,'notificationDenied'));
        });
        return()=>{active=false;};
    }, [
        settings?.notificationsEnabled,
        settings?.motivationNotificationsEnabled,
        settings?.reminderHour,
        settings?.reminderMinute,
        settings?.lastCigaretteAt,
        settings?.dailySpend,
        settings?.cigarettesPerDay,
        settings?.language,
    ]);
    const stats = useMemo(() => {
        if (!settings)
            return null;
        const elapsedMs = Math.max(0, now - settings.lastCigaretteAt);
        const elapsedDays = elapsedMs / 86400000;
        const totals = periodTotals(settings, now);
        const moneySaved = totals.money + settings.periods.reduce((sum, p) => sum + p.money, 0);
        const cigarettesAvoided = Math.floor(totals.cigarettes + settings.periods.reduce((sum, p) => sum + p.cigarettes, 0));
        const continuousMs = Math.max(0, now - continuousStart(settings, now));
        const smokeFreeDay = now < settings.lastCigaretteAt ? 0 : Math.floor(continuousMs / 86400000) + 1;
        const goalProgress = Math.min(100, (moneySaved / settings.goalPrice) * 100);
        const challengeStart = startOfLocalDay(settings.lastCigaretteAt);
        const todayStart = startOfLocalDay(now);
        const todayKey = formatDateLabel(todayStart);
        const confirmed = new Set(settings.confirmedDates);
        return {
            elapsedMs: continuousMs,
            elapsedDays,
            preparing: now < settings.lastCigaretteAt,
            moneySaved,
            cigarettesAvoided,
            smokeFreeDay,
            goalProgress,
            challengeStart,
            todayStart,
            todayKey,
            todayConfirmed: confirmed.has(todayKey),
        };
    }, [now, settings]);
    const setField = useCallback((key: keyof FormState, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: undefined }));
    }, []);
    const startQuit = useCallback(async () => {
        if (saving.current)
            return;
        const dailySpend = parseHabit(habit)?.dailySpend ?? null;
        const profile = parseHabit(habit);
        const cigarettesPerDay = profile?.cigarettesPerDay ?? null;
        const goalPrice = parsePositiveNumber(form.goalPrice);
        const goalName = form.goalName.trim();
        const nextErrors: FormErrors = {};
        if (dailySpend == null)
            nextErrors.dailySpend = t(language, 'errorAmount');
        if (cigarettesPerDay == null) {
            nextErrors.cigarettesPerDay = t(language, 'errorWholeNumber');
        }
        if (!goalName)
            nextErrors.goalName = t(language, 'errorGoal');
        if (goalPrice == null)
            nextErrors.goalPrice = t(language, 'errorAmount');
        if (lastCigaretteAt == null) {
            nextErrors.lastCigaretteAt = t(language, 'errorLastCigarette');
        }
        else if (!preparing && lastCigaretteAt > Date.now()) {
            nextErrors.lastCigaretteAt = t(language, 'errorFuture');
        }
        else if (preparing && lastCigaretteAt <= Date.now()) {
            nextErrors.lastCigaretteAt = t(language, 'futureError');
        }
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            if (nextErrors.lastCigaretteAt)
                setStep(0);
            return;
        }
        const nextSettings: UserSettings = {
            ...migrateJourney({}),
            profile: profile!.profile,
            reasons: reasons.map(r => r.trim()).filter(Boolean),
            language,
            dailySpend: dailySpend as number,
            cigarettesPerDay: cigarettesPerDay as number,
            goalName,
            goalPrice: goalPrice as number,
            lastCigaretteAt: lastCigaretteAt as number,
            reminderHour,
            reminderMinute,
            notificationsEnabled: true,
            motivationNotificationsEnabled: true,
            confirmedDates: [],
        };
        saving.current = true;
        try {
            await persistSettings(nextSettings);
            setNow(Date.now());
        }
        finally {
            saving.current = false;
        }
    }, [form, habit, reasons, preparing, language, lastCigaretteAt, persistSettings, reminderHour, reminderMinute]);
    const confirmDay = useCallback(async (dateKey: string, dayStart: number) => {
        if (!settings || saving.current || Date.now() < settings.lastCigaretteAt)
            return;
        if (!canConfirm(dayStart, Date.now(), settings.lastCigaretteAt, settings.confirmedDates, settings.lapses))
            return;
        saving.current = true;
        try {
            if (await persistSettings({ ...settings, confirmedDates: [...settings.confirmedDates, dateKey].sort() }))
                setConfirmationOpen(true);
        }
        finally {
            saving.current = false;
        }
    }, [persistSettings, settings]);
    const recordLapse = async (restart: boolean) => {
        if (!settings || saving.current)
            return;
        const cigarettes = parsePositiveInt(lapseCount);
        if (!cigarettes) {
            setLapseError(t(settings.language, 'errorWholeNumber'));
            return;
        }
        if (lapseAt > Date.now() || lapseAt < settings.lastCigaretteAt) {
            setLapseError(t(settings.language, 'lapseDateError'));
            return;
        }
        const lapse = { id: String(Date.now()), at: lapseAt, cigarettes, restart };
        const updated = addLapse(settings, lapse);
        saving.current = true;
        try {
            if (await persistSettings(updated)) {
                setLapseOpen(false);
                setNow(Date.now());
            }
        }
        finally {
            saving.current = false;
        }
    };
    const openSettings = useCallback(() => {
        if (!settings)
            return;
        setSettingsErrors({});
        setPlanOpen(false);setPlanSaved(false);
        setDraftReasons(settings.reasons);
        setDraftHabit({ packSize: String(settings.profile.packSize), packPrice: String(settings.profile.packPrice), packDays: String(settings.profile.packDays), manual: String(settings.cigarettesPerDay) });
        setSettingsNote(notificationsUnavailableInExpoGo
            ? t(settings.language, 'expoGoNote')
            : settings.notificationsEnabled
                ? null
                : t(settings.language, 'notificationsOff'));
        setSettingsDraft({
            language: settings.language,
            dailySpend: String(settings.dailySpend),
            cigarettesPerDay: String(settings.cigarettesPerDay),
            goalName: settings.goalName,
            goalPrice: String(settings.goalPrice),
            reminderHour: settings.reminderHour,
            reminderMinute: settings.reminderMinute,
            notificationsEnabled: settings.notificationsEnabled,
            motivationNotificationsEnabled: settings.motivationNotificationsEnabled,
        });
        setSettingsOpen(true);
    }, [settings]);
    const saveSettings = useCallback(async () => {
        if (!settings || !settingsDraft || saving.current)
            return;
        const dailySpend = parsePositiveNumber(settingsDraft.dailySpend);
        const cigarettesPerDay = parsePositiveNumber(settingsDraft.cigarettesPerDay);
        const goalPrice = parsePositiveNumber(settingsDraft.goalPrice);
        const goalName = settingsDraft.goalName.trim();
        const nextErrors: FormErrors = {};
        if (dailySpend == null)
            nextErrors.dailySpend = t(settingsDraft.language, 'errorAmount');
        if (cigarettesPerDay == null) {
            nextErrors.cigarettesPerDay = t(settingsDraft.language, 'errorWholeNumber');
        }
        if (!goalName)
            nextErrors.goalName = t(settingsDraft.language, 'errorGoal');
        if (goalPrice == null)
            nextErrors.goalPrice = t(settingsDraft.language, 'errorAmount');
        if (Object.keys(nextErrors).length > 0) {
            setSettingsErrors(nextErrors);
            return;
        }
        if (!parseHabit(draftHabit)) {
            setSettingsErrors({ dailySpend: t(settingsDraft.language, 'errorAmount') });
            return;
        }
        const nextSettings: UserSettings = {
            ...settings,
            profile: parseHabit(draftHabit)!.profile,
            reasons: draftReasons.map(r => r.trim()).filter(Boolean),
            language: settingsDraft.language,
            dailySpend: dailySpend as number,
            cigarettesPerDay: cigarettesPerDay as number,
            goalName,
            goalPrice: goalPrice as number,
            reminderHour: settingsDraft.reminderHour,
            reminderMinute: settingsDraft.reminderMinute,
            notificationsEnabled: settingsDraft.notificationsEnabled,
            motivationNotificationsEnabled: settingsDraft.motivationNotificationsEnabled,
        };
        saving.current = true;
        try {
            if (await persistSettings(nextSettings)) setSettingsOpen(false);
        }
        finally {
            saving.current = false;
        }
    }, [persistSettings, settings, settingsDraft, draftReasons, draftHabit]);
    const sendTestNotification = useCallback(async () => {
        if(testBusy)return;
        setTestBusy(true);
        const activeLanguage=settingsDraft?.language??settings?.language??'et';
        try {
            const result=await scheduleTestNotification(activeLanguage);
            setSettingsNote(t(activeLanguage,result==='scheduled'?'quickTestScheduled':result==='denied'?'quickTestDenied':result==='unavailable'?'quickTestUnavailable':'testNotificationFailed'));
        } finally {setTestBusy(false);}
    },[settingsDraft?.language,settings?.language,testBusy]);
    const savePlan=async()=>{
        if(!settings || saving.current)return;
        let updated:UserSettings;
        try {updated=changeQuitPlan(settings,planAt,planPreparing,Date.now());}
        catch {setPlanError(t(settingsDraft?.language??settings.language,planPreparing?'futureError':'errorFuture'));return;}
        saving.current=true;
        try {if(await persistSettings(updated)){setNow(Date.now());setPlanOpen(false);setPlanSaved(true);}}
        finally {saving.current=false;}
    };
    const resetToOnboarding = useCallback(async (confirmation: string) => {
        if (!__DEV__ || confirmation !== 'RESET') return;
        if (saving.current) throw new Error('A settings write is already in progress');
        saving.current = true;
        try {
        await cancelDailyReminder();
        await AsyncStorage.multiRemove([STORAGE_KEY, CRAVING_END_KEY, SUPPORT_HISTORY_KEY]);
        setSettings(null);
        setStep(0);
        setReasons([]);
        setPreparing(false);
        setHabit({ packSize: "20", packPrice: "", packDays: "1", manual: "" });
        setLanguage('et');
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
        setConfirmationOpen(false);
        setLapseOpen(false);
        setStorageError(false);
        setCravingLeft(CRAVING_SECONDS);
        } finally { saving.current = false; }
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
            }
            catch {
                // Ignore storage errors and start a new timer below.
            }
        }
        if (endsAt == null || endsAt <= Date.now()) {
            endsAt = Date.now() + CRAVING_SECONDS * 1000;
            try {
                await AsyncStorage.setItem(CRAVING_END_KEY, String(endsAt));
            }
            catch {
                // Timer still works in memory if storage is unavailable.
            }
        }
        setCravingEndsAt(endsAt);
        setCravingLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        setCravingOpen(true);
    }, [cravingEndsAt]);
    const topPad = insets.top + 12;
    if (loadError)
        return <View style={[styles.screen, styles.centered]}><Text style={ui.body}>{t(language, 'loadError')}</Text><Action label={t(language, 'retry')} onPress={() => { setLoadError(false); setHydrated(false); setLoadAttempt(n => n + 1); }}/></View>;
    if (!hydrated) {
        return (<View style={[styles.screen, styles.centered]}>
        <StatusBar style="light"/>
        <Text style={styles.brand}>QUIT30</Text>
      </View>);
    }
    if (!settings || !stats) {
        return (<View style={styles.screen}>
        <StatusBar style="light"/>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.onboardingContent, { paddingTop: topPad, paddingBottom: insets.bottom+24, paddingLeft:insets.left+20,paddingRight:insets.right+20 }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.kicker}>{t(language, 'kicker')}</Text>
            <Text style={styles.brand}>QUIT30</Text>
            <LanguageSelector value={language} onChange={setLanguage}/>
            <Text style={styles.subtitle}>{t(language, 'subtitle')}</Text>

            <Text style={ui.muted}>{step + 1} / 3</Text>
            {storageError && <Text style={styles.error}>{t(language, 'saveError')}</Text>}
            {step === 0 && <View style={styles.card}>
              <Text style={ui.title}>{t(language, 'quitQuestion')}</Text>
              <View style={styles.chipRow}>
                <Chip label={t(language, 'alreadyQuit')} active={!preparing} onPress={() => { setPreparing(false); setLastCigaretteAt(Date.now()); }}/>
                <Chip label={t(language, 'preparing')} active={preparing} onPress={() => { setPreparing(true); setLastCigaretteAt(Date.now() + 86400000); }}/>
              </View>
              <Text style={ui.muted}>{t(language, preparing ? 'preparationNote' : 'progressStarts')}</Text>
              <Text style={ui.title}>{t(language, 'quitTime')}</Text>
              {!preparing && <View style={styles.chipRow}>{([0, 1, 3, 7] as const).map((days, i) => <Chip key={days} label={t(language, (['today', 'yesterday', 'days3', 'days7'] as const)[i])} active={false} onPress={() => setLastCigaretteAt(Date.now() - days * 86400000)}/>)}</View>}
              <DateTimeEditor language={language} value={lastCigaretteAt ?? now} onChange={setLastCigaretteAt}/>
              {errors.lastCigaretteAt && <Text style={styles.error}>{errors.lastCigaretteAt}</Text>}
            </View>}
            {step === 1 && <View style={styles.card}>
              <HabitEditor language={language} value={habit} onChange={setHabit}/>
              {errors.dailySpend && <Text style={styles.error}>{errors.dailySpend}</Text>}
              <ReasonsEditor language={language} value={reasons} onChange={setReasons}/>
            </View>}
            {step === 2 && <><View style={styles.card}>
              <FieldLabel>{t(language, 'savingsQuestion')}</FieldLabel>
              <TextInput value={form.goalName} onChangeText={(v) => setField('goalName', v)} placeholder={t(language, 'savingsGoal')} placeholderTextColor={COLORS.muted} style={styles.input}/>
              {errors.goalName ? <Text style={styles.error}>{errors.goalName}</Text> : null}

              <FieldLabel>{t(language, 'targetPrice')}</FieldLabel>
              <TextInput value={form.goalPrice} onChangeText={(v) => setField('goalPrice', v)} placeholder="300" placeholderTextColor={COLORS.muted} keyboardType="decimal-pad" style={styles.input}/>
              {errors.goalPrice ? <Text style={styles.error}>{errors.goalPrice}</Text> : null}
            </View>

            <View style={styles.card}>
              <FieldLabel>{t(language, 'reminderQuestion')}</FieldLabel>
              <Text style={styles.customDateValue}>{formatTime(reminderHour, reminderMinute)}</Text>
              <Stepper label={t(language, 'hour')} value={pad2(reminderHour)} onMinus={() => setReminderHour((h) => wrap(h - 1, 0, 23))} onPlus={() => setReminderHour((h) => wrap(h + 1, 0, 23))}/>
              <Stepper label={t(language, 'minute')} value={pad2(reminderMinute)} onMinus={() => setReminderMinute((m) => wrap(m - 1, 0, 59))} onPlus={() => setReminderMinute((m) => wrap(m + 1, 0, 59))}/>
              <Text style={styles.helper}>
                {notificationsUnavailableInExpoGo
                    ? t(language, 'expoGoNote')
                    : t(language, 'reminderDefault')}
              </Text>
            </View>

            <Pressable style={styles.primaryButton} onPress={startQuit}>
              <Text style={styles.primaryButtonText}>{t(language, 'start')}</Text>
            </Pressable></>}
            {step < 2 && <Action label={t(language, 'next')} onPress={() => {
                    if (step === 0) {
                        const at = lastCigaretteAt ?? Date.now();
                        if ((preparing && at <= Date.now()) || (!preparing && at > Date.now())) {
                            setErrors({ lastCigaretteAt: t(language, preparing ? 'futureError' : 'errorFuture') });
                            return;
                        }
                        setLastCigaretteAt(at);
                    }
                    if (step === 1 && !parseHabit(habit)) {
                        setErrors({ dailySpend: t(language, 'errorAmount') });
                        return;
                    }
                    setErrors({});
                    setStep(n => n + 1);
                }}/>}
            {step > 0 && <Action label={t(language, 'back')} onPress={() => setStep(n => n - 1)}/>}
          </ScrollView>
        </KeyboardAvoidingView>

      </View>);
    }
    const cravingMinutes = Math.floor(cravingLeft / 60);
    const cravingSecs = cravingLeft % 60;
    const cravingStep = cravingContent(settings.language, cravingLeft);
    const achievements = earnedAchievements(stats.elapsedMs);
    const latestAchievement = achievements.at(-1);
    return (<View style={styles.screen}>
      <StatusBar style="light"/>
      <ScrollView contentContainerStyle={[styles.dashboardContent, { paddingTop: topPad, paddingBottom: insets.bottom+24, paddingLeft:insets.left+20,paddingRight:insets.right+20 }]}>
        {storageError && <Text style={styles.error}>{t(settings.language, 'saveError')}</Text>}
        <View style={styles.dashHeader}>
          <View>
            <Text style={styles.kicker}>{t(settings.language, stats.preparing ? 'preparation' : 'smokeFree')}</Text>
            <Text style={styles.brand}>QUIT30</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(settings.language, 'settings')} onPress={openSettings} style={styles.gearButton} hitSlop={10}>
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        </View>

        <Pressable style={styles.cravingButton} onPress={openCraving}>
          <Text style={styles.cravingButtonText}>{t(settings.language, 'cravingButton')}</Text>
          <Text style={styles.cravingHint}>{t(settings.language, 'cravingHint')}</Text>
        </Pressable>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{t(settings.language, stats.preparing ? 'preparation' : 'currentDay')}</Text>
          <Text style={styles.heroNumber}>{stats.preparing ? formatDateLabel(settings.lastCigaretteAt) : `${t(settings.language, 'day')} ${stats.smokeFreeDay}`}</Text>
          <Text style={styles.heroSub}>{formatExactDuration(stats.preparing ? settings.lastCigaretteAt - now : stats.elapsedMs, settings.language)}</Text>
          <Text style={styles.tinyMuted}>
            {t(settings.language, stats.preparing ? 'quitTime' : 'sinceLast')} · {formatDateLabel(continuousStart(settings, now))}
          </Text>
        </View>

        {stats.preparing ? <Text style={ui.body}>{t(settings.language, 'preparationNote')}</Text> : stats.todayConfirmed ? (<View style={styles.confirmedBanner}>
            <Text style={styles.confirmedBannerText}>{t(settings.language, 'todayConfirmed')}</Text>
          </View>) : (<Pressable style={[styles.checkinButton, settings.lapses.some(l => formatDateLabel(l.at) === stats.todayKey) && { opacity: .4 }]} disabled={settings.lapses.some(l => formatDateLabel(l.at) === stats.todayKey)} onPress={() => void confirmDay(stats.todayKey, stats.todayStart)}>
            <Text style={styles.checkinButtonText}>{t(settings.language, 'confirmToday')}</Text>
          </Pressable>)}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t(settings.language, 'moneySaved')}</Text>
            <Text style={styles.statValue}>{formatMoney(stats.moneySaved)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t(settings.language, 'cigarettesNotSmoked')}</Text>
            <Text style={styles.statValue}>{Math.floor(stats.cigarettesAvoided)}</Text>
          </View>
        </View>

        <SupportCard language={settings.language} elapsed={stats.elapsedMs} preparing={stats.preparing} money={stats.moneySaved} cigarettes={stats.cigarettesAvoided} reasons={settings.reasons} now={now} recentLapse={settings.lapses.some(l=>now>=l.at&&now-l.at<7*86400000)}/>
        {!stats.preparing && <RecoveryCard language={settings.language} elapsed={stats.elapsedMs}/>}
        <View style={ui.card}>
          <Text style={ui.title}>{t(settings.language, 'stats')}</Text>
          <Text style={ui.body}>{t(settings.language, 'confirmedDays')}: {new Set([...settings.confirmedDates, ...settings.periods.flatMap(p => p.confirmedDates)]).size}</Text>
          <Text style={ui.body}>{t(settings.language, 'cravings')}: {settings.cravingsManaged}</Text>
          <Text style={ui.body}>{t(settings.language, 'lapses')}: {settings.lapses.length}</Text>
          <Text style={[ui.title,{color:COLORS.greenText}]}>{t(settings.language, 'achievement')}</Text>
          <Text style={ui.body}>{achievements.length ? achievements.map(n => t(settings.language, 'daysFree', { n })).join(' · ') : t(settings.language, 'emptyHistory')}</Text>
          {stats.preparing ? <Text style={ui.muted}>{t(settings.language,'lapseNotStarted')}</Text> : <Action label={t(settings.language, 'lapse')} onPress={() => { setLapseAt(Date.now()); setLapseCount('1'); setLapseError(''); setLapseOpen(true); }}/>}
          {settings.lapses.slice(-5).reverse().map(l => <Text key={l.id} style={ui.muted}>{formatDateLabel(l.at)} · {l.cigarettes} · {t(settings.language, l.restart ? 'restart' : 'keepLapse')}</Text>)}
          {settings.periods.length > 0 && <><Text style={ui.title}>{t(settings.language, 'history')}</Text>{settings.periods.map((p, i) => <Text key={i} style={ui.muted}>{formatDateLabel(p.start)} – {formatDateLabel(p.end)} · €{p.money.toFixed(2)} · {Math.floor(p.cigarettes)}</Text>)}</>}
        </View>
        <View style={styles.card}>
          <Text style={styles.statLabel}>
            {t(settings.language, 'savingFor')} {settings.goalName}
          </Text>
          <Text style={styles.goalNumbers}>
            {formatMoney(stats.moneySaved)} / {formatMoney(settings.goalPrice)}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${stats.goalProgress}%` }]}/>
          </View>
          <Text style={styles.helper}>
            {stats.goalProgress.toFixed(1)}% {t(settings.language, 'ofGoal')}
          </Text>
        </View>

        <MonthCalendar settings={settings} now={now} onConfirm={(key,at)=>void confirmDay(key,at)}/>
        {__DEV__ && <DevReset language={settings.language} onReset={resetToOnboarding} />}
      </ScrollView>

      <Modal visible={cravingOpen} transparent animationType="fade" onRequestClose={() => setCravingOpen(false)}>
        <View style={[styles.modalBackdrop,modalInsets]}>
          <ScrollView contentContainerStyle={[styles.settingsModalContent,{paddingVertical:8}]}><View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(settings.language, 'rideItOut')}</Text>
            <Text style={styles.countdown}>
              {pad2(cravingMinutes)}:{pad2(cravingSecs)}
            </Text>

            <View style={styles.cravingActivityCard}>
              <Text style={styles.cravingActivityIcon}>{cravingStep.icon}</Text>
              <Text style={[styles.cravingActivityTitle,cravingLeft===0&&{color:COLORS.greenText}]}>{cravingStep.title}</Text>
              <Text style={styles.cravingActivityBody}>{cravingStep.body}</Text>
            </View>

            {settings.reasons.filter(Boolean)[0] && <Text style={ui.body}>{t(settings.language, 'reasons')} — {settings.reasons.filter(Boolean)[0]}</Text>}
            {cravingLeft === 0 ? (<>
                <Text style={styles.cravingHowNow}>{t(settings.language, 'cravingHowNow')}</Text>
                <View style={styles.cravingActionRow}>
                  <Pressable style={[styles.primaryButton, styles.cravingActionButton]} onPress={async () => {
                if (saving.current)
                    return;
                saving.current = true;
                try {
                    if (settings.lastManagedCraving !== cravingEndsAt && cravingEndsAt !== null) {
                        if (!await persistSettings({ ...settings, cravingsManaged: settings.cravingsManaged + 1, lastManagedCraving: cravingEndsAt }))
                            return;
                    }
                    setCravingOpen(false);
                }
                finally {
                    saving.current = false;
                }
            }}>
                    <Text style={styles.primaryButtonText}>
                      {t(settings.language, 'cravingPassed')}
                    </Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, styles.cravingActionButton]} onPress={() => void openCraving()}>
                    <Text style={styles.secondaryButtonText}>
                      {t(settings.language, 'cravingAgain')}
                    </Text>
                  </Pressable>
                </View>
              </>) : (<>
                <Text style={styles.helper}>{t(settings.language, 'cravingActive')}</Text>
                <Pressable style={styles.primaryButton} onPress={() => setCravingOpen(false)}>
                  <Text style={styles.primaryButtonText}>{t(settings.language, 'close')}</Text>
                </Pressable>
              </>)}
          </View></ScrollView>
        </View>
      </Modal>

      <Modal visible={confirmationOpen} transparent animationType="fade" onRequestClose={() => setConfirmationOpen(false)}>
        <View style={[styles.modalBackdrop,modalInsets]}><ScrollView contentContainerStyle={[styles.settingsModalContent,{paddingVertical:8}]}><GentleFade change={confirmationOpen ? 1 : 0}><View style={styles.modalCard}><Text style={[ui.title,{color:COLORS.greenText}]}>{t(settings.language, 'confirmed')}</Text><RecoveryCard language={settings.language} elapsed={stats.elapsedMs}/>{latestAchievement && <Text style={ui.body}>{t(settings.language, 'achievement')} · {t(settings.language, 'daysFree', { n: latestAchievement })}</Text>}<Action label={t(settings.language, 'close')} onPress={() => setConfirmationOpen(false)}/></View></GentleFade></ScrollView></View>
      </Modal>
      <Modal visible={lapseOpen} transparent animationType="fade" onRequestClose={() => setLapseOpen(false)}>
        <View style={[styles.modalBackdrop,modalInsets]}><ScrollView contentContainerStyle={[styles.settingsModalContent,{paddingVertical:8}]} keyboardShouldPersistTaps="handled"><View style={styles.modalCard}>
          <Text style={ui.title}>{t(settings.language, 'lapse')}</Text><Text style={ui.body}>{t(settings.language, 'lapseHint')}</Text>
          <Text style={ui.muted}>{t(settings.language, 'lapseCount')}</Text><TextInput accessibilityLabel={t(settings.language, 'lapseCount')} style={ui.input} keyboardType="number-pad" value={lapseCount} onChangeText={setLapseCount}/>
          <Text style={ui.title}>{t(settings.language, 'when')}</Text><DateTimeEditor language={settings.language} value={lapseAt} onChange={setLapseAt}/>
          <Text style={ui.muted}>{t(settings.language, 'lapseExplain')}</Text>{lapseError && <Text style={styles.error}>{lapseError}</Text>}{storageError && <Text style={styles.error}>{t(settings.language, 'saveError')}</Text>}
          <Action label={t(settings.language, 'keepLapse')} onPress={() => void recordLapse(false)}/><Action label={t(settings.language, 'restart')} onPress={() => void recordLapse(true)}/><Action label={t(settings.language, 'cancel')} onPress={() => setLapseOpen(false)}/>
        </View></ScrollView></View>
      </Modal>
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={[styles.modalBackdrop,modalInsets]}>
          <KeyboardAvoidingView style={{maxHeight:'100%',width:'100%'}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={[styles.settingsModalContent,{paddingVertical:8}]} keyboardShouldPersistTaps="handled">
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {t(settingsDraft?.language ?? settings.language, 'settings')}
                </Text>
                {settingsDraft ? (<>
                    <FieldLabel>{t(settingsDraft.language, 'language')}</FieldLabel>
                    <LanguageSelector value={settingsDraft.language} onChange={language=>setSettingsDraft(d=>d?{...d,language}:d)}/>
                    <Action label={t(settingsDraft.language,'editPlan')} onPress={()=>{setPlanAt(settings.lastCigaretteAt);setPlanPreparing(settings.lastCigaretteAt>Date.now());setPlanError('');setPlanSaved(false);setPlanOpen(v=>!v);}}/>
                    {planOpen && <View style={ui.card}>
                        <Text style={ui.muted}>{t(settingsDraft.language,'planHistoryNote')}</Text>
                        <Action label={t(settingsDraft.language,'alreadyQuit')} onPress={()=>{setPlanPreparing(false);if(planAt>Date.now())setPlanAt(Date.now());}}/>
                        <Action label={t(settingsDraft.language,'preparing')} onPress={()=>{setPlanPreparing(true);if(planAt<=Date.now())setPlanAt(Date.now()+86400000);}}/>
                        <Text style={ui.title}>{t(settingsDraft.language,planPreparing?'preparation':'smokeFree')}</Text>
                        <DateTimeEditor language={settingsDraft.language} value={planAt} onChange={setPlanAt}/>
                        {planError && <Text style={styles.error}>{planError}</Text>}
                        <Action label={t(settingsDraft.language,'savePlan')} onPress={()=>void savePlan()}/>
                        <Action label={t(settingsDraft.language,'cancel')} onPress={()=>setPlanOpen(false)}/>
                    </View>}
                    {planSaved && <Text style={{color:COLORS.greenText}}>{t(settingsDraft.language,'planSaved')}</Text>}
                    <ReasonsEditor language={settingsDraft.language} value={draftReasons} onChange={setDraftReasons}/>
                    <FieldLabel>{t(settingsDraft.language, 'dailyReminder')}</FieldLabel>
                    <Text style={styles.customDateValue}>
                      {formatTime(settingsDraft.reminderHour, settingsDraft.reminderMinute)}
                    </Text>
                    <Stepper label={t(settingsDraft.language, 'hour')} value={pad2(settingsDraft.reminderHour)} onMinus={() => setSettingsDraft((d) => d ? { ...d, reminderHour: wrap(d.reminderHour - 1, 0, 23) } : d)} onPlus={() => setSettingsDraft((d) => d ? { ...d, reminderHour: wrap(d.reminderHour + 1, 0, 23) } : d)}/>
                    <Stepper label={t(settingsDraft.language, 'minute')} value={pad2(settingsDraft.reminderMinute)} onMinus={() => setSettingsDraft((d) => d ? { ...d, reminderMinute: wrap(d.reminderMinute - 1, 0, 59) } : d)} onPlus={() => setSettingsDraft((d) => d ? { ...d, reminderMinute: wrap(d.reminderMinute + 1, 0, 59) } : d)}/>

                    <View style={styles.toggleRow}>
                      <Text style={styles.label}>{t(settingsDraft.language, 'dailyNotifications')}</Text>
                      <Switch value={settingsDraft.notificationsEnabled} onValueChange={(value) => setSettingsDraft((d) => d ? { ...d, notificationsEnabled: value } : d)} trackColor={{ false: COLORS.cardBorder, true: COLORS.green }} thumbColor={COLORS.white}/>
                    </View>
                    <View style={styles.toggleRow}>
                      <View style={styles.toggleTextWrap}>
                        <Text style={styles.label}>
                          {t(settingsDraft.language, 'motivationNotifications')}
                        </Text>
                        <Text style={styles.tinyMuted}>
                          {t(settingsDraft.language, 'motivationNotificationsHint')}
                        </Text>
                      </View>
                      <Switch value={settingsDraft.motivationNotificationsEnabled} onValueChange={(value) => setSettingsDraft((d) => d ? { ...d, motivationNotificationsEnabled: value } : d)} trackColor={{ false: COLORS.cardBorder, true: COLORS.green }} thumbColor={COLORS.white}/>
                    </View>
                    {settingsNote ? <Text style={styles.helper}>{settingsNote}</Text> : null}

                    {(<Pressable style={styles.secondaryButton} disabled={testBusy} onPress={() => void sendTestNotification()}>
                        <Text style={styles.secondaryButtonText}>
                          {t(settingsDraft.language, 'quickTest')}
                        </Text>
                      </Pressable>)}

                    <HabitEditor language={settingsDraft.language} value={draftHabit} onChange={v => { setDraftHabit(v); const result = parseHabit(v); if (result)
            setSettingsDraft(d => d ? { ...d, dailySpend: String(result.dailySpend), cigarettesPerDay: String(result.cigarettesPerDay) } : d); }}/>
                    {settingsErrors.dailySpend && <Text style={styles.error}>{settingsErrors.dailySpend}</Text>}
                    {storageError && <Text style={styles.error}>{t(settingsDraft.language, 'saveError')}</Text>}
                    <FieldLabel>{t(settingsDraft.language, 'savingsGoal')}</FieldLabel>
                    <TextInput value={settingsDraft.goalName} onChangeText={(v) => setSettingsDraft((d) => (d ? { ...d, goalName: v } : d))} style={styles.input} placeholderTextColor={COLORS.muted}/>
                    {settingsErrors.goalName ? (<Text style={styles.error}>{settingsErrors.goalName}</Text>) : null}

                    <FieldLabel>{t(settingsDraft.language, 'goalPrice')}</FieldLabel>
                    <TextInput value={settingsDraft.goalPrice} onChangeText={(v) => setSettingsDraft((d) => (d ? { ...d, goalPrice: v } : d))} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={COLORS.muted}/>
                    {settingsErrors.goalPrice ? (<Text style={styles.error}>{settingsErrors.goalPrice}</Text>) : null}

                    <BrandInfo language={settingsDraft.language} />

                    <Pressable style={styles.primaryButton} onPress={() => void saveSettings()}>
                      <Text style={styles.primaryButtonText}>{t(settingsDraft.language, 'saveSettings')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setSettingsOpen(false)}>
                      <Text style={styles.link}>{t(settingsDraft.language, 'cancel')}</Text>
                    </Pressable>
                  </>) : null}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>);
}
function FieldLabel({ children }: {
    children: string;
}) {
    return <Text style={styles.label}>{children}</Text>;
}
function Chip({ label, active, onPress, }: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    return (<Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : null]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>);
}
function Stepper({ label, value, onMinus, onPlus, }: {
    label: string;
    value: string;
    onMinus: () => void;
    onPlus: () => void;
}) {
    return (<View style={styles.stepper}>
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
    </View>);
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
        color: COLORS.sand,
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
        backgroundColor: COLORS.card,
        borderColor: COLORS.sand,
    },
    chipText: {
        color: COLORS.muted,
        fontWeight: '600',
    },
    chipTextActive: {
        color: COLORS.sand,
    },
    primaryButton: {
        backgroundColor: COLORS.sand,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    primaryButtonText: {
        color: '#142219',
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
        color: COLORS.sand,
        fontSize: 20,
    },
    heroCard: {
        backgroundColor: COLORS.card,
        borderColor: COLORS.sand,
        borderWidth: 1,
        borderRadius: 22,
        padding: 20,
        marginBottom: 16,
    },
    heroLabel: {
        color: COLORS.sand,
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
        color: '#142219',
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
        borderColor: COLORS.sand,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    secondaryButtonText: {
        color: COLORS.sand,
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
    stayStrongCard: {
        backgroundColor: COLORS.greenDim,
        borderColor: COLORS.green,
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
    },
    stayStrongTitle: {
        color: COLORS.greenText,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.4,
    },
    stayStrongText: {
        color: COLORS.text,
        fontSize: 17,
        lineHeight: 24,
        fontWeight: '700',
        marginTop: 8,
    },
    milestoneCard: {
        backgroundColor: COLORS.card,
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    milestoneTextWrap: {
        flex: 1,
    },
    milestoneValue: {
        color: COLORS.text,
        fontSize: 17,
        fontWeight: '800',
        marginTop: 6,
    },
    milestoneCountdown: {
        color: COLORS.green,
        fontSize: 18,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    supportCard: {
        backgroundColor: COLORS.card,
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
    },
    supportTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '800',
    },
    supportBody: {
        color: COLORS.muted,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 6,
    },
    supportSoon: {
        color: COLORS.greenText,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 8,
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
        borderColor: COLORS.sand,
        borderWidth: 1,
        borderRadius: 18,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    cravingButtonText: {
        color: COLORS.sand,
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
        color: COLORS.sand,
        fontSize: 56,
        fontWeight: '800',
        textAlign: 'center',
        marginVertical: 16,
        fontVariant: ['tabular-nums'],
    },
    cravingActivityCard: {
        backgroundColor: COLORS.input,
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
    },
    cravingActivityIcon: {
        fontSize: 34,
    },
    cravingActivityTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: '800',
        marginTop: 8,
        textAlign: 'center',
    },
    cravingActivityBody: {
        color: COLORS.muted,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
        textAlign: 'center',
    },
    cravingHowNow: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 16,
    },
    cravingActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    cravingActionButton: {
        flex: 1,
        marginBottom: 0,
    },
    customDateValue: {
        color: COLORS.sand,
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
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBtnText: {
        color: COLORS.sand,
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
    toggleTextWrap: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    link: {
        color: COLORS.muted,
        textAlign: 'center',
        marginTop: 14,
    },
});
