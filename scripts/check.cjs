const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
// Compile with the project's TypeScript; no test dependencies or generated sources needed.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const model = require('../src/model.ts');
const {normalizeSettings} = require('../src/storage.ts');
const {recoveryAt,supportCards,cravingContent} = require('../src/content.ts');
const {t} = require('../src/i18n.ts');
const DAY=model.DAY;
const start=new Date(2026,8,1,12).getTime();
const legacy={language:'et',dailySpend:6.5,cigarettesPerDay:13,goalName:'Trip',goalPrice:500,lastCigaretteAt:start,reminderHour:20,reminderMinute:15,notificationsEnabled:true,motivationNotificationsEnabled:false,confirmedDates:['2026-09-01'],customPreference:'keep me'};
const settings=()=>normalizeSettings(legacy);
test('legacy migration retains original fields and unknown preferences',()=>{const migrated=settings();for(const [key,value] of Object.entries(legacy))assert.deepEqual(migrated[key],value);assert.deepEqual(migrated.reasons,[]);assert.deepEqual(migrated.lapses,[]);assert.equal(model.calculateHabit(migrated.profile).dailySpend,legacy.dailySpend);});
test('empty first launch and malformed data are distinguished',()=>{assert.equal(normalizeSettings(null),null);assert.equal(normalizeSettings({...legacy,lastCigaretteAt:Infinity}),null);assert.equal(normalizeSettings({...legacy,dailySpend:NaN}),null);});
test('new fields survive JSON persistence and rehydration',()=>{const current={...settings(),language:'ru',reasons:['Семья'],cravingsManaged:4};assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(current))),current);});
test('pack duration derives fractional daily habit; invalid values rejected',()=>{const result=model.calculateHabit({packSize:20,packPrice:6,packDays:1.5});assert.equal(result.dailySpend,4);assert.equal(result.cigarettesPerDay,20/1.5);assert.equal(model.calculateHabit({packSize:0,packPrice:6,packDays:1}),null);assert.equal(model.calculateHabit({packSize:20,packPrice:6,packDays:0}),null);});
test('future quit has zero savings, zero cigarettes and no check-in',()=>{const future={...settings(),lastCigaretteAt:start+DAY};assert.deepEqual(model.periodTotals(future,start),{money:0,cigarettes:0});assert.equal(model.canConfirm(new Date(2026,8,1).getTime(),start,future.lastCigaretteAt,[],[]),false);assert.equal(model.periodTotals(future,start+2*DAY).money,6.5);});
test('today and yesterday confirmation accepted, duplicates and older days blocked',()=>{const now=new Date(2026,8,3,12).getTime();assert.equal(model.canConfirm(new Date(2026,8,3).getTime(),now,start,[],[]),true);assert.equal(model.canConfirm(new Date(2026,8,2).getTime(),now,start,[],[]),true);assert.equal(model.canConfirm(new Date(2026,8,1).getTime(),now,start,[],[]),false);assert.equal(model.canConfirm(new Date(2026,8,3).getTime(),now,start,['2026-09-03'],[]),false);});
test('lapse keeps history, deducts cigarettes and disallows smoking-day confirmation',()=>{const lapse={id:'l1',at:start+2*DAY,cigarettes:2,restart:false};const changed=model.recordLapse(settings(),lapse);assert.equal(changed.lastCigaretteAt,start);assert.deepEqual(changed.confirmedDates,legacy.confirmedDates);assert.equal(model.periodTotals(changed,lapse.at).cigarettes,24);assert.equal(model.periodTotals(changed,lapse.at).money,12);assert.equal(model.continuousStart(changed,lapse.at),lapse.at);assert.equal(model.canConfirm(new Date(2026,8,3).getTime(),lapse.at,start,[],changed.lapses),false);});
test('restart archives progress and deducts the restart lapse only once',()=>{const lapse={id:'l1',at:start+2*DAY,cigarettes:2,restart:true};const changed=model.recordLapse(settings(),lapse);assert.equal(changed.periods[0].money,12);assert.equal(changed.periods[0].cigarettes,24);assert.equal(changed.lastCigaretteAt,lapse.at);assert.equal(model.periodTotals(changed,lapse.at+DAY).money,6.5);assert.equal(model.periodTotals(changed,lapse.at+DAY).cigarettes,13);assert.deepEqual(changed.periods[0].confirmedDates,legacy.confirmedDates);});
test('retroactive restart keeps later confirmations in current period',()=>{const changed=model.recordLapse({...settings(),confirmedDates:['2026-09-01','2026-09-03','2026-09-04']},{id:'l',at:start+2*DAY,cigarettes:1,restart:true});assert.deepEqual(changed.confirmedDates,['2026-09-04']);assert.deepEqual(changed.periods[0].confirmedDates,['2026-09-01']);});
test('tracking and achievements continue beyond thirty days',()=>{assert.equal(model.periodTotals(settings(),start+100*DAY).cigarettes,1300);assert.equal(model.earnedAchievements(100*DAY).at(-1),100);assert.equal(model.earnedAchievements(365*DAY).at(-1),365);assert.equal(model.earnedAchievements(DAY-1).length,0);});
test('recovery advances at boundaries, supports overlapping ranges and long durations',()=>{assert.equal(recoveryAt(0,'en').current,undefined);assert.equal(recoveryAt(20*60000,'en').current.label,'20 minutes');assert.equal(recoveryAt(2*DAY,'en').next.label,'72 hours');assert.equal(recoveryAt(3*DAY,'en').next.label,'2–12 weeks');assert.equal(recoveryAt(30*DAY,'en').current.label,'1–12 months');assert.equal(recoveryAt(90*DAY,'en').current.label,'3–9 months');assert.equal(recoveryAt(20*365*DAY,'en').next,undefined);});
for(const language of ['et','en','ru']){
 test(`${language}: relevant support, own reasons and distinct cards`,()=>{const cards=supportCards(language,2*DAY,false,13,26,['My reason']);assert.equal(cards.at(-1).body,'My reason');assert.equal(new Set(cards.map(c=>c.body)).size,cards.length);assert.ok(cards.every(c=>c.title && c.body));const prep=supportCards(language,0,true,0,0,[]);assert.ok(prep.length>=10);assert.notDeepEqual(prep,cards);assert.ok(cravingContent(language,200).body);assert.ok(t(language,'reasons'));});
}
// Test scheduling against a fake native module. Never touches real OS notifications.
let notificationId=0;
let expoGo=false, imports=0, permission='granted', requests=0, scheduled=[];
const fakeNotifications={setNotificationHandler(){},setNotificationChannelAsync:async()=>{},getPermissionsAsync:async()=>({status:permission}),requestPermissionsAsync:async()=>{requests++;return {status:permission};},getAllScheduledNotificationsAsync:async()=>scheduled,cancelScheduledNotificationAsync:async id=>{scheduled=scheduled.filter(n=>n.identifier!==id);},cancelAllScheduledNotificationsAsync:async()=>{scheduled=[];},scheduleNotificationAsync:async input=>{scheduled.push({...input,identifier:String(++notificationId)});return String(scheduled.length);},AndroidImportance:{DEFAULT:3,HIGH:4},SchedulableTriggerInputTypes:{DATE:'date'}};
const originalLoad=Module._load;
Module._load=function(id,parent,isMain){if(id==='expo')return {isRunningInExpoGo:()=>expoGo};if(id==='react-native')return {Platform:{OS:'android'}};if(id==='expo-notifications'){imports++;return fakeNotifications;}return originalLoad.call(this,id,parent,isMain);};
function loadScheduler(){delete require.cache[require.resolve('../src/notifications.ts')];return require('../src/notifications.ts');}
test('Android Expo Go never imports notifications or requests permission',async()=>{expoGo=true;imports=0;requests=0;const n=loadScheduler();assert.equal(await n.configureNotifications(settings()),false);await n.cancelDailyReminder();assert.equal(imports,0);assert.equal(requests,0);});
test('native reminders retain concrete DATE triggers, chosen local time, and no extra support notifications',async()=>{expoGo=false;permission='granted';const now=Date.now();const n=loadScheduler();assert.equal(await n.configureNotifications({...settings(),lastCigaretteAt:now-DAY}),true);assert.ok(scheduled.length>=29 && scheduled.length<=31);for(const item of scheduled){assert.equal(item.trigger.type,'date');assert.equal(item.trigger.date.getHours(),20);assert.equal(item.trigger.date.getMinutes(),15);assert.equal(item.content.data.kind,'daily-reminder');}});
test('denied permissions are graceful and disabled reminders schedule nothing',async()=>{permission='denied';const n=loadScheduler();assert.equal(await n.configureNotifications(settings()),false);assert.equal(scheduled.length,0);permission='granted';await n.configureNotifications({...settings(),notificationsEnabled:false,motivationNotificationsEnabled:false});assert.equal(scheduled.length,0);});
test('Russian notifications, future start, and day 30+ use original scheduling mechanism',async()=>{permission='granted';const n=loadScheduler();const future=Date.now()+3*DAY;await n.configureNotifications({...settings(),language:'ru',lastCigaretteAt:future});assert.ok(scheduled.length>0);assert.ok(scheduled.some(item=>item.trigger.date.getTime()<future && item.content.data.day===0));assert.ok(scheduled.some(item=>item.trigger.date.getTime()>=future && item.content.title.includes('День')));await n.configureNotifications({...settings(),lastCigaretteAt:Date.now()-45*DAY});assert.ok(scheduled.length>0);assert.ok(scheduled[0].content.data.day>30);});
test('manual daily correction keeps calculated cost and rejects invalid override',()=>{const profile={packSize:20,packPrice:6,packDays:1.5};assert.deepEqual(model.calculateHabit(profile,12),{dailySpend:4,cigarettesPerDay:12});assert.equal(model.calculateHabit(profile,0),null);assert.equal(model.calculateHabit(profile,Infinity),null);});
test('avoided cigarettes are floored only for display without losing accumulated fractions',()=>{const count=model.periodTotals(settings(),start+DAY/2).cigarettes;assert.equal(count,6.5);assert.equal(Math.floor(count),6);assert.equal(model.periodTotals(settings(),start+DAY).cigarettes,13);});

const {changeQuitPlan}=require('../src/quitPlan.ts');
const {calendarMonth,journeyDay,shiftMonth,civilDay}=require('../src/calendar.ts');
const {thoughtBank,supportStage,dailyCardId,nextCardId}=require('../src/supportLibrary.ts');
test('quit plan changes preserve history/preferences through restart and recalculate immediately',()=>{
 const now=start+10*DAY;const original={...settings(),reasons:['Family'],lapses:[{id:'a',at:start+DAY,cigarettes:1,restart:false}]};
 const future=changeQuitPlan(original,now+DAY,true,now);assert.equal(model.periodTotals(future,now).money,0);
 for(const key of Object.keys(original).filter(k=>k!=='lastCigaretteAt'))assert.deepEqual(future[key],original[key]);
 const restored=normalizeSettings(JSON.parse(JSON.stringify(future)));assert.deepEqual(restored,future);
 const active=changeQuitPlan(restored,now-2*DAY,false,now);assert.equal(model.periodTotals(active,now).money,13);assert.equal(model.continuousStart(active,now),now-2*DAY);assert.equal(active.planHistory.length,2);
 assert.throws(()=>changeQuitPlan(original,now-DAY,true,now));assert.throws(()=>changeQuitPlan(original,now+DAY,false,now));assert.throws(()=>changeQuitPlan(original,NaN,false,now));
});
test('calendar uses real Monday-first months, leap days, year navigation and civil journey days',()=>{
 const leap=calendarMonth(new Date(2028,1,1).getTime(),start,settings());assert.equal(leap.filter(Boolean).length,29);assert.equal(leap.findIndex(Boolean),1);
 const sunday=calendarMonth(new Date(2026,1,1).getTime(),start,settings());assert.equal(sunday.findIndex(Boolean),6);
 assert.equal(new Date(shiftMonth(new Date(2026,0,1).getTime(),-1)).getFullYear(),2025);
 for(const day of [1,30,31,100,365]){const at=new Date(start);at.setDate(at.getDate()+day-1);assert.equal(journeyDay(at.getTime(),settings()),day);}
 assert.equal(civilDay(new Date(2026,2,30).getTime())-civilDay(new Date(2026,2,29).getTime()),1);
});
test('calendar preserves check-ins/lapses without automatically confirming earlier days',()=>{
 const now=start+4*DAY;const current={...settings(),lapses:[{id:'l',at:start+DAY,cigarettes:1,restart:false}]};const days=calendarMonth(start,now,current).filter(Boolean);
 assert.equal(days[0].state,'confirmed');assert.equal(days[1].state,'lapse');assert.equal(days[2].state,'past');assert.equal(days[4].today,true);assert.equal(days[5].state,'future');
 const changed=changeQuitPlan(current,now+DAY,true,now);assert.equal(calendarMonth(start,now,changed).filter(Boolean)[0].state,'confirmed');assert.equal(journeyDay(start,changed),1);
});
test('60 distinct thoughts have all three translations and six appropriate stages',()=>{
 assert.equal(thoughtBank.length,60);assert.equal(new Set(thoughtBank.map(x=>x.id)).size,60);
 for(let i=0;i<3;i++){assert.equal(new Set(thoughtBank.map(x=>x.text[i])).size,60);assert.ok(thoughtBank.every(x=>x.text[i].length>20));}
 for(const stage of ['preparation','early','week','month','maintenance','lapse'])assert.equal(thoughtBank.filter(x=>x.stage===stage).length,10);
 assert.deepEqual([supportStage(0,true),supportStage(2*DAY,false),supportStage(3*DAY,false),supportStage(7*DAY,false),supportStage(30*DAY,false)],['preparation','early','week','month','maintenance']);
});
test('daily support ID is stable across translations and browsing avoids recent IDs',()=>{
 const cards=supportCards('et',2*DAY,false,13,26,[]);const initial=dailyCardId(cards,'2026-09-22');assert.equal(initial,dailyCardId(supportCards('ru',2*DAY,false,13,26,[]),'2026-09-22'));
 const recent=[initial];let current=initial;for(let i=1;i<cards.length;i++){const next=nextCardId(cards,current,recent);assert.notEqual(next,current);assert.ok(!recent.includes(next));recent.push(next);current=next;}assert.notEqual(nextCardId(cards,current,recent),current);
 assert.ok(supportCards('en',DAY,false,6.5,13,[],true).some(c=>c.id.startsWith('thought-lapse')));
});
test('preparation motivation works with daily reminders off and saved local time',async()=>{
 expoGo=false;permission='granted';scheduled=[];const n=loadScheduler();const future=Date.now()+4*DAY;const saved=normalizeSettings(JSON.parse(JSON.stringify({...settings(),notificationsEnabled:false,motivationNotificationsEnabled:true,lastCigaretteAt:future})));
 assert.equal(await n.configureNotifications(saved),true);const prep=scheduled.filter(x=>x.content.data.kind==='preparation-motivation');assert.ok(prep.length>=3);assert.ok(prep.every(x=>x.trigger.date.getTime()<future&&x.trigger.date.getHours()===20&&x.trigger.date.getMinutes()===15));assert.ok(scheduled.some(x=>x.content.data.kind==='motivation'));
});
test('five-second test survives reminder refresh, reports denial and never imports in Expo Go',async()=>{
 expoGo=false;permission='granted';scheduled=[];let n=loadScheduler();const before=Date.now();assert.equal(await n.scheduleTestNotification('ru'),'scheduled');const item=scheduled[0];assert.ok(item.trigger.date.getTime()>=before+5000&&item.trigger.date.getTime()<=Date.now()+5000);
 await n.configureNotifications(settings());assert.ok(scheduled.some(x=>x.identifier===item.identifier));
 permission='denied';assert.equal(await n.scheduleTestNotification('et'),'denied');expoGo=true;imports=0;n=loadScheduler();assert.equal(await n.scheduleTestNotification('en'),'unavailable');assert.equal(imports,0);expoGo=false;permission='granted';
});
