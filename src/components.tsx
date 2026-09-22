import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey } from './model';
import { dailyCardId, nextCardId } from './supportLibrary';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Language, SmokingProfile, calculateHabit } from './model';
import { t } from './i18n';
import { recoveryAt, recoverySources, supportCards } from './content';
export const palette = { bg: '#141516', card: '#202224', cardBorder: '#383A3C', green: '#84B697', greenDim: '#243B30', greenText: '#B2D9BE', text: '#F1EDE7', muted: '#B0ADA7', input: '#191B1D', danger: '#ED9F96', white: '#FAF6EF', sand: '#D8C4A7' };
export const ui = StyleSheet.create({
    card: { backgroundColor: palette.card, borderColor: palette.cardBorder, borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 }, title: { color: palette.sand, fontSize: 16, fontWeight: '700', marginBottom: 10 }, body: { color: palette.text, fontSize: 16, lineHeight: 24, marginBottom: 8 }, muted: { color: palette.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 }, input: { backgroundColor: palette.input, borderColor: palette.cardBorder, borderWidth: 1, borderRadius: 12, color: palette.text, padding: 12, marginBottom: 10, fontSize: 16 }, button: { backgroundColor: palette.sand, borderRadius: 14, padding: 14, alignItems: 'center', marginVertical: 6 }, buttonText: { color: palette.bg, fontSize: 15, fontWeight: '700' }, row: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }
});
export function Action({ label, onPress, disabled = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[ui.button, disabled && { opacity: .4 }]}><Text style={ui.buttonText}>{label}</Text></Pressable>; }
export function ReasonsEditor({ language, value, onChange }: {
    language: Language;
    value: string[];
    onChange: (v: string[]) => void;
}) {
    return <View><Text style={ui.title}>{t(language, 'reasons')}</Text><Text style={ui.muted}>{t(language, 'reasonsHint')}</Text>{[0, 1, 2].map(i => <TextInput key={i} accessibilityLabel={`${t(language, 'reasons')} ${i + 1}`} style={ui.input} value={value[i] ?? ''} maxLength={120} onChangeText={v => { const next = [...value]; next[i] = v; onChange(next); }}/>)}</View>;
}
export type HabitDraft = {
    packSize: string;
    packPrice: string;
    packDays: string;
    manual: string;
};
export function parseHabit(value: HabitDraft) {
    const number = (s: string) => /^\d+(?:[.,]\d+)?$/.test(s.trim()) ? Number(s.replace(',', '.')) : NaN;
    const profile: SmokingProfile = { packSize: number(value.packSize), packPrice: number(value.packPrice), packDays: number(value.packDays) };
    const manual = value.manual.trim() ? number(value.manual) : null;
    const result = calculateHabit(profile, manual ?? undefined);
    if (!result)
        return null;
    return { profile, ...result };
}
export function HabitEditor({ language, value, onChange }: {
    language: Language;
    value: HabitDraft;
    onChange: (v: HabitDraft) => void;
}) {
    const estimate = parseHabit({ ...value, manual: '' });
    return <View><Text style={ui.title}>{t(language, 'habit')}</Text>{(['packSize', 'packPrice', 'packDays'] as const).map(key => <View key={key}><Text style={ui.muted}>{t(language, key)}</Text><TextInput accessibilityLabel={t(language, key)} style={ui.input} keyboardType="decimal-pad" value={value[key]} onChangeText={v => onChange({ ...value, [key]: v })}/></View>)}{estimate && <Text style={ui.body}>{t(language, 'estimate', { n: Math.round(estimate.cigarettesPerDay) })} · €{estimate.dailySpend.toFixed(2)}/24h</Text>}<Text style={ui.muted}>{t(language, 'manual')}</Text><TextInput accessibilityLabel={t(language, 'manual')} style={ui.input} keyboardType="decimal-pad" value={value.manual} placeholder={estimate ? String(Math.round(estimate.cigarettesPerDay)) : ''} placeholderTextColor={palette.muted} onChangeText={v => onChange({ ...value, manual: v })}/></View>;
}
export function RecoveryCard({ language, elapsed }: {
    language: Language;
    elapsed: number;
}) {
    const recovery = recoveryAt(elapsed, language);
    return <View style={ui.card}><Text style={ui.title}>{t(language, 'recovery')}</Text>{recovery.current && <Text style={ui.muted}>{recovery.current.label}</Text>}<Text style={ui.body}>{recovery.current?.body ?? t(language, 'recoveryWaiting')}</Text><Text style={ui.title}>{t(language, 'nextChange')}</Text><Text style={ui.body}>{recovery.next?.label ?? t(language, 'recoveryLong')}</Text><Text style={ui.muted}>{t(language, 'recoveryNote')}</Text><View style={ui.row}>{recoverySources.map((url, i) => <Pressable key={url} accessibilityRole="link" onPress={() => void Linking.openURL(url).catch(() => { })}><Text style={ui.muted}>{i === 0 ? 'NHS ↗' : 'CDC ↗'}</Text></Pressable>)}</View></View>;
}
export function GentleFade({ children, change }: {
    children: React.ReactNode;
    change: string | number;
}) {
    const opacity = useRef(new Animated.Value(1)).current;
    const [reduce, setReduce] = useState(true);
    useEffect(() => { let active = true; void AccessibilityInfo.isReduceMotionEnabled().then(v => { if (active)
        setReduce(v); }); const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce); return () => { active = false; listener.remove(); }; }, []);
    useEffect(() => { if (reduce) {
        opacity.setValue(1);
        return;
    } opacity.setValue(.4); const animation = Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [change, reduce, opacity]);
    return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
export const SUPPORT_HISTORY_KEY = 'quit30.supportHistory.v1';
type SupportHistory = {day:string;initialId:string;recent:string[]};
let supportWrites:Promise<unknown>=Promise.resolve();
function saveSupportHistory(value:SupportHistory){supportWrites=supportWrites.then(()=>AsyncStorage.setItem(SUPPORT_HISTORY_KEY,JSON.stringify(value))).catch(()=>undefined);}
export function SupportCard({language,elapsed,preparing,money,cigarettes,reasons,now=Date.now(),recentLapse=false}:{language:Language;elapsed:number;preparing:boolean;money:number;cigarettes:number;reasons:string[];now?:number;recentLapse?:boolean}) {
 const cards=supportCards(language,elapsed,preparing,money,cigarettes,reasons,recentLapse);
 const today=dateKey(now);
 const [history,setHistory]=useState<SupportHistory|null>(null);
 const [browse,setBrowse]=useState<{day:string;id:string}|null>(null);
 const historyRef=useRef<SupportHistory|null>(null);
 useEffect(()=>{let active=true;void AsyncStorage.getItem(SUPPORT_HISTORY_KEY).then(raw=>{
  let saved:SupportHistory={day:'',initialId:'',recent:[]};
  try{const p=raw?JSON.parse(raw):null;if(p&&typeof p.day==='string'&&typeof p.initialId==='string'&&Array.isArray(p.recent))saved={day:p.day,initialId:p.initialId,recent:p.recent.filter((id:unknown)=>typeof id==='string').slice(-24)};}catch{}
  if(active){historyRef.current=saved;setHistory(saved);}
 }).catch(()=>{if(active){const empty={day:'',initialId:'',recent:[]};historyRef.current=empty;setHistory(empty);}});return()=>{active=false;};},[]);
 const initial=history?.day===today&&cards.some(c=>c.id===history.initialId)?history.initialId:dailyCardId(cards,today);
 const activeId=browse?.day===today&&cards.some(c=>c.id===browse.id)?browse.id:initial;
 const card=cards.find(c=>c.id===activeId)!;
 useEffect(()=>{
  if(!history || (history.day===today&&history.initialId===initial))return;
  const next={day:today,initialId:initial,recent:[...history.recent.filter(id=>id!==initial),initial].slice(-24)};
  historyRef.current=next;setHistory(next);saveSupportHistory(next);
 },[today,initial,history]);
 function another(){const current=historyRef.current;if(!current)return;const id=nextCardId(cards,activeId,current.recent);const next={...current,recent:[...current.recent.filter(x=>x!==id),id].slice(-24)};historyRef.current=next;setHistory(next);setBrowse({day:today,id});saveSupportHistory(next);}
 return <View style={ui.card}><Text style={ui.title}>{t(language,'supportToday')}</Text>{history && <GentleFade change={activeId}><Text style={[ui.muted,card.success&&{color:palette.greenText}]}>{card.title}</Text><Text style={ui.body}>{card.body}</Text></GentleFade>}<Action label={t(language,'another')} disabled={!history} onPress={another}/></View>;
}

export function LanguageSelector({value,onChange}:{value:Language;onChange:(language:Language)=>void}) {
 return <View style={{flexDirection:'row',gap:6,width:'100%',marginVertical:8}}>{(['et','en','ru'] as const).map(language=><Pressable key={language} accessibilityRole="button" accessibilityState={{selected:value===language}} onPress={()=>onChange(language)} style={{flex:1,minWidth:0,minHeight:44,justifyContent:'center',paddingHorizontal:3,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:value===language?palette.sand:palette.cardBorder,backgroundColor:value===language?'#38352F':palette.input}}><Text numberOfLines={1} adjustsFontSizeToFit style={{textAlign:'center',color:value===language?palette.sand:palette.muted,fontSize:13,fontWeight:'600'}}>{{et:'Eesti',en:'English',ru:'Русский'}[language]}</Text></Pressable>)}</View>;
}

export function DateTimeEditor({ language, value, onChange }: {
    language: Language;
    value: number;
    onChange: (v: number) => void;
}) {
    const date = new Date(value);
    const items = [['day', date.getDate()], ['month', date.getMonth() + 1], ['year', date.getFullYear()], ['hour', date.getHours()], ['minute', date.getMinutes()]] as const;
    function shift(key: string, delta: number) { const d = new Date(value); if (key === 'day')
        d.setDate(d.getDate() + delta); if (key === 'month') {
        const day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + delta);
        d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    } if (key === 'year') {
        const month = d.getMonth();
        d.setFullYear(d.getFullYear() + delta);
        if (d.getMonth() !== month)
            d.setDate(0);
    } if (key === 'hour')
        d.setHours(d.getHours() + delta); if (key === 'minute')
        d.setMinutes(d.getMinutes() + delta); onChange(d.getTime()); }
    return <View><Text style={ui.body}>{date.toLocaleString({ et: 'et-EE', en: 'en-GB', ru: 'ru-RU' }[language], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>{items.map(([key, n]) => <View style={[ui.row, { justifyContent: 'space-between' }]} key={key}><Text style={ui.muted}>{t(language, key)}</Text><View style={ui.row}><Pressable accessibilityLabel={`${t(language, key)} −`} onPress={() => shift(key, -1)} style={ui.button}><Text style={ui.buttonText}>−</Text></Pressable><Text style={ui.body}>{String(n).padStart(2, '0')}</Text><Pressable accessibilityLabel={`${t(language, key)} +`} onPress={() => shift(key, 1)} style={ui.button}><Text style={ui.buttonText}>+</Text></Pressable></View></View>)}</View>;
}
