import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calendarMonth, monthStart, shiftMonth } from './calendar';
import { canConfirm } from './model';
import type { UserSettings } from './storage';
import { t } from './i18n';
import { Action, palette, ui } from './components';
export function MonthCalendar({settings,now,onConfirm}:{settings:UserSettings;now:number;onConfirm:(key:string,at:number)=>void}) {
 const [month,setMonth]=useState(()=>monthStart(now));
 const [selected,setSelected]=useState(()=>new Date(now).setHours(0,0,0,0));
 const locale={et:'et-EE',en:'en-GB',ru:'ru-RU'}[settings.language];
 const cells=useMemo(()=>calendarMonth(month,now,settings),[month,now,settings]);
 const item=cells.find(c=>c?.at===selected);
 const stateText=(state:string)=>t(settings.language,state==='confirmed'?'calendarConfirmedDay':state==='lapse'?'calendarLapseDay':state==='future'?'calendarFutureDay':'calendarOrdinaryDay');
 return <View style={ui.card}>
  <Text style={ui.title}>{t(settings.language,'calendarTitle')}</Text>
  <View style={styles.header}>
   <Pressable accessibilityRole="button" accessibilityLabel={t(settings.language,'previousMonth')} style={styles.nav} onPress={()=>setMonth(m=>shiftMonth(m,-1))}><Text style={ui.body}>‹</Text></Pressable>
   <Text style={styles.month} numberOfLines={1} adjustsFontSizeToFit>{new Date(month).toLocaleDateString(locale,{month:'long',year:'numeric'})}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel={t(settings.language,'nextMonth')} style={styles.nav} onPress={()=>setMonth(m=>shiftMonth(m,1))}><Text style={ui.body}>›</Text></Pressable>
  </View>
  <View style={styles.grid}>{Array.from({length:7},(_,i)=><View key={i} style={styles.column}><Text style={styles.weekday}>{new Date(2026,0,5+i).toLocaleDateString(locale,{weekday:'narrow'})}</Text></View>)}</View>
  <View style={styles.grid}>{cells.map((cell,i)=><View key={cell?.key??'blank-'+i} style={styles.column}>{cell && <Pressable accessibilityRole="button" accessibilityLabel={cell.key+', '+stateText(cell.state)+(cell.today?', '+t(settings.language,'today'):'')} accessibilityState={{selected:cell.at===selected}} onPress={()=>setSelected(cell.at)} style={[styles.cell,cell.state==='confirmed'&&styles.confirmed,cell.state==='lapse'&&styles.lapse,cell.today&&styles.today,cell.at===selected&&styles.selected]}>
    <Text style={[styles.day,cell.state==='future'&&styles.future]}>{cell.day}</Text>
    <Text style={[styles.mark,cell.state==='lapse'&&{color:palette.danger}]}>{cell.state==='confirmed'?'✓':cell.state==='lapse'?'×':' '}</Text>
   </Pressable>}</View>)}</View>
  <Text style={ui.muted}>{t(settings.language,'calendarLegend')}</Text>
  {item && <View style={styles.detail}><Text style={ui.body}>{new Date(item.at).toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'})}</Text>
   {item.journeyDay!==null && <Text style={ui.muted}>{t(settings.language,'day')} {item.journeyDay}</Text>}
   <Text style={[ui.body,item.state==='confirmed'&&{color:palette.greenText},item.state==='lapse'&&{color:palette.danger}]}>{stateText(item.state)}</Text>
   {canConfirm(item.at,now,settings.lastCigaretteAt,settings.confirmedDates,settings.lapses) && item.state!=='confirmed' && <Action label={t(settings.language,'confirmSelected')} onPress={()=>onConfirm(item.key,item.at)}/>}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 header:{flexDirection:'row',alignItems:'center',marginBottom:8},nav:{width:40,height:44,alignItems:'center',justifyContent:'center'},month:{flex:1,minWidth:0,textAlign:'center',fontWeight:'700',fontSize:16,color:palette.text},
 grid:{flexDirection:'row',flexWrap:'wrap'},column:{width:'14.285714%',padding:2},weekday:{textAlign:'center',color:palette.muted,fontSize:12,paddingVertical:4},
 cell:{minHeight:48,borderRadius:10,borderWidth:1,borderColor:palette.cardBorder,alignItems:'center',justifyContent:'center',backgroundColor:palette.input},day:{color:palette.text,fontSize:14},mark:{color:palette.greenText,fontSize:11,lineHeight:13},future:{color:palette.muted,opacity:.6},confirmed:{backgroundColor:palette.greenDim},lapse:{backgroundColor:'#402B2B'},today:{borderColor:palette.sand,borderWidth:2},selected:{borderColor:palette.text},detail:{borderTopWidth:1,borderColor:palette.cardBorder,paddingTop:12},
});
