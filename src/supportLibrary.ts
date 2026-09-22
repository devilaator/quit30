import type { Language } from './model';
export type SupportStage = 'preparation' | 'early' | 'week' | 'month' | 'maintenance' | 'lapse';
type Translated = readonly [string, string, string];
// Ten distinct thoughts per stage; stable IDs do not depend on language or ordering in the UI.
const groups: Record<SupportStage, readonly Translated[]> = {
 preparation: [
 ['Pane kirja, millal suits tundub automaatne. Märkamine on juba osa muutusest.','Write down when smoking feels automatic. Noticing is already part of changing.','Запишите, когда курение происходит автоматически. Замечать — уже часть перемен.'],
 ['Sinu põhjus loobumiseks ei pea teistele muljet avaldama. Piisab, et see on sulle oluline.','Your reason for quitting need not impress anyone. It only needs to matter to you.','Ваша причина бросить не обязана впечатлять других. Главное, что она важна вам.'],
 ['Ettevalmistus ei nõua ideaalset nädalat. Vali üks asi, mida saad juba täna lihtsamaks teha.','Preparation does not need a perfect week. Choose one thing you can make easier today.','Для подготовки не нужна идеальная неделя. Выберите одно дело, которое можно облегчить сегодня.'],
 ['Mõtle läbi oma esimene suitsuvaba hommik, mitte kogu ülejäänud elu.','Picture your first smoke-free morning, rather than your entire future.','Представьте первое утро без сигарет, а не всю оставшуюся жизнь.'],
 ['Ütle ühele inimesele, millist tuge sa soovid. Konkreetset palvet on lihtsam täita.','Tell one person what support you want. A specific request is easier to act on.','Скажите одному человеку, какая поддержка вам нужна. Конкретную просьбу легче выполнить.'],
 ['Suitsupaus võib olla ka päris puhkepaus. Seda osa oma päevast ei pea kaotama.','A cigarette break can become a real rest break. You need not lose that pause in your day.','Перекур можно превратить в настоящий отдых. От пауз в течение дня отказываться не нужно.'],
 ['Vali ette vastus pakkumisele: ei, aitäh. Sa ei pea oma otsust pikalt põhjendama.','Prepare a reply to an offer: no, thank you. Your decision needs no long explanation.','Подготовьте ответ на предложение сигареты: нет, спасибо. Длинное объяснение не требуется.'],
 ['Vähenda sigarettide nähtavust seal, kus kõige sagedamini viibid. Keskkond saab sind toetada.','Make cigarettes less visible where you spend time. Your surroundings can support you.','Уберите сигареты из поля зрения там, где часто бываете. Окружение может помогать вам.'],
 ['Tee vahet suitsuisul ja vajadusel korraks töölt eemalduda. Mõlemale saab erinevalt vastata.','Separate the urge to smoke from the need to step away from work. They can have different answers.','Отличайте желание курить от потребности отвлечься от работы. На них можно отвечать по-разному.'],
 ['Plaan võib olla paindlik, ilma et sinu põhjus loobuda muutuks vähem tähtsaks.','Your plan can be flexible without making your reason to quit less important.','План может быть гибким, а ваша причина бросить — оставаться важной.'],
 ],
 early: [
 ['Võta üks olukord korraga. Järgmist tundi ei pea ette ära taluma.','Take one situation at a time. You do not have to endure the next hour in advance.','Разбирайтесь с одной ситуацией за раз. Не нужно заранее выдерживать следующий час.'],
 ['Kui tähelepanu jääb suitsu külge kinni, anna talle konkreetne väike ülesanne.','When your attention gets stuck on smoking, give it a small, concrete task.','Если мысли застряли на сигарете, займите внимание небольшой конкретной задачей.'],
 ['Ebamugav tunne ei tähenda, et sinu otsus oleks vale.','Feeling uncomfortable does not mean your decision is wrong.','Неприятные ощущения не означают, что решение было неправильным.'],
 ['Täna võib tavalisest rohkem puhkust vaja minna. See ei ole läbikukkumine.','You may need more rest than usual today. That is not a failure.','Сегодня вам может понадобиться больше отдыха. Это не неудача.'],
 ['Enne tegutsemist nimeta tunne: olen pinges, väsinud või igavlen. Nii tekib rohkem valikuid.','Before acting, name the feeling: tense, tired, or bored. Naming it opens more options.','Назовите чувство перед действием: напряжение, усталость или скука. Это расширяет выбор.'],
 ['Sa võid suitsule mõelda ja ikkagi mitte suitsetada. Mõte ei määra sinu järgmist sammu.','You can think about smoking and still not smoke. A thought does not choose your next action.','Можно думать о сигарете и не курить. Мысль не определяет следующее действие.'],
 ['Raske hetk ei vaja suurt lahendust. Vahel aitab toast väljumine või klaas vett.','A difficult moment may need only a small response: another room or a glass of water.','Трудному моменту иногда нужен простой ответ: другая комната или стакан воды.'],
 ['Luba endal täna mõni mittevajalik kohustus edasi lükata. Hoia ruumi olulise jaoks.','Let yourself postpone an unnecessary task today. Leave room for what matters.','Разрешите себе отложить необязательное дело. Оставьте силы на важное.'],
 ['Ära hinda tervet päeva ühe tugeva suitsuisu järgi. Päevas on ka teisi hetki.','Do not judge the whole day by one strong craving. There are other moments in it.','Не оценивайте весь день по одному сильному желанию курить. В нём есть и другие моменты.'],
 ['Abi küsimine on osa plaanist, mitte märk sellest, et sa ei saa hakkama.','Asking for help can be part of your plan, not evidence that you cannot cope.','Просьба о помощи — часть плана, а не доказательство, что вы не справляетесь.'],
 ],
 week: [
 ['Jälgi, milline paus töötab sinu jaoks kõige paremini. Oma kogemus on kasulikum kui täiuslik soovitus.','Notice which kind of break helps you most. Your experience matters more than a perfect tip.','Замечайте, какая пауза помогает именно вам. Ваш опыт полезнее идеального совета.'],
 ['Vana kellaaeg võib meenutada vana harjumust. See ei tähenda, et peaksid sellele järgnema.','A familiar time can cue an old habit. You do not have to follow it.','Привычное время может напомнить о старом ритуале. Следовать ему необязательно.'],
 ['Loo üks uus seos: pärast sööki jalutan, mitte ei suitseta.','Create one new association: after eating, I walk instead of smoking.','Создайте одну новую связь: после еды я гуляю, а не курю.'],
 ['Kõik päevad ei pea tunduma ühtviisi kerged, et edasiminek oleks päris.','Days need not feel equally easy for progress to be real.','Дни не обязаны быть одинаково лёгкими, чтобы прогресс был настоящим.'],
 ['Sa õpid tegema tuttavaid asju ilma sigaretita. Harjutamine võib olla kohmakas.','You are learning familiar activities without a cigarette. Practice can feel awkward.','Вы учитесь делать привычные дела без сигареты. Поначалу это может быть неловко.'],
 ['Kui üks nipp ei sobi, vaheta nippi, mitte eesmärki.','If one coping idea does not suit you, change the idea rather than the goal.','Если приём не подходит, смените приём, а не цель.'],
 ['Esimene suitsuvaba nädal sisaldab palju väikseid otsuseid, mida teised ei näe.','A first smoke-free week contains many small decisions that others never see.','Первая неделя без сигарет состоит из множества маленьких решений, незаметных другим.'],
 ['Pane tähele suitsuvaba hetke, mis tundus juba tavaline. Ka see on muutus.','Notice a smoke-free moment that already felt ordinary. That is change too.','Заметьте момент без сигареты, который уже показался обычным. Это тоже перемена.'],
 ['Keerulist olukorda võib ajutiselt vältida. Sa ei pea kõiki päästikuid korraga harjutama.','You can avoid a difficult situation for now. You need not practise every trigger at once.','Сложную ситуацию пока можно обойти. Не нужно сразу проверять себя во всех обстоятельствах.'],
 ['Võrdle tänast oma algusega, mitte kellegi teise teekonnaga.','Compare today with your own starting point, not someone else’s journey.','Сравнивайте сегодняшний день со своим началом, а не с чужим путём.'],
 ],
 month: [
 ['Sääst ei pea olema suur, et olla sinu jaoks kasulik. See on raha, millele saad ise suuna anda.','Savings need not be large to be useful. It is money you can give a purpose.','Сбережения могут быть небольшими и всё равно полезными. Вы сами решаете, на что их направить.'],
 ['Kindlustunne kasvab kogemusest, mitte vajadusest ennast sigaretiga proovile panna.','Confidence grows through experience, not by testing yourself with a cigarette.','Уверенность растёт из опыта, а не из проверки себя сигаретой.'],
 ['Uus rutiin vajab kohta sinu päris elus, ka kiiretel ja tüütutel päevadel.','A new routine needs a place in your real life, including busy and boring days.','Новой привычке нужно место в обычной жизни, включая занятые и скучные дни.'],
 ['Sa ei pea suitsupausist puudust tundmise pärast oma otsust kahtluse alla seadma.','Missing a cigarette break does not mean you need to question your decision.','Если вам не хватает перекура, это не повод сомневаться в решении.'],
 ['Märka, mille jaoks on tekkinud rohkem aega või tähelepanu. Kõik võidud ei mahu numbritesse.','Notice what now gets more time or attention. Not every gain fits into a number.','Заметьте, на что стало больше времени или внимания. Не все изменения измеряются числами.'],
 ['Planeeri keeruliseks õhtuks lihtne väljapääs: jalutuskäik, kõne või varasem kojuminek.','Plan an easy exit for a difficult evening: a walk, a call, or heading home earlier.','Подготовьте простой выход из трудного вечера: прогулку, звонок или раннее возвращение домой.'],
 ['Kui keegi sinu loobumist ei mõista, jääb sinu põhjus ikkagi kehtima.','Your reason remains valid even if someone does not understand your decision.','Ваша причина остаётся значимой, даже если кто-то не понимает вашего решения.'],
 ['Üks meeldiv suitsuvaba tegevus võib saada uueks puhkuse märgiks.','One enjoyable smoke-free activity can become your new signal for a break.','Приятное занятие без сигарет может стать новым знаком отдыха.'],
 ['Sa võid olla oma edasiminekuga rahul ja samal ajal ettevaatlik vana harjumusega.','You can be pleased with your progress and still be careful around an old habit.','Можно радоваться прогрессу и сохранять осторожность со старой привычкой.'],
 ['Päevade lugemine on abivahend. Oluline on elu, mida nende päevade sees elad.','Counting days is a tool. What matters is the life you live within them.','Счёт дней — лишь инструмент. Важна жизнь, которой вы наполняете эти дни.'],
 ],
 maintenance: [
 ['Ootamatu suitsuisu ei tühista kuude pikkust muutust. Kasuta uuesti seda, mis varem aitas.','A surprise craving does not undo months of change. Return to what helped before.','Неожиданная тяга не отменяет месяцы перемен. Вернитесь к тому, что уже помогало.'],
 ['Suitsuvaba elu võib muutuda tavaliseks. Edasiminek ei pea iga päev eriline tunduma.','Smoke-free life can become ordinary. Progress need not feel special every day.','Жизнь без сигарет может стать обычной. Прогресс не обязан ежедневно ощущаться особенным.'],
 ['Hoia alles oma lihtne plaan pingelisteks päevadeks, ka siis, kui sa seda harva vajad.','Keep your simple plan for stressful days, even when you rarely need it.','Сохраните простой план на напряжённые дни, даже если редко им пользуетесь.'],
 ['Vana tuttav koht võib tuua vana mõtte. Sa saad sellest kohast läbi ka teistmoodi.','An old familiar place may bring an old thought. You can move through it differently now.','Знакомое место может вызвать старую мысль. Теперь вы можете пройти через это иначе.'],
 ['Hea enesetunne ei kohusta sind kontrollima, kas üks sigaret oleks ohutu.','Feeling good does not require testing whether one cigarette would be safe.','Хорошее самочувствие не требует проверять, безопасна ли одна сигарета.'],
 ['Vaata aeg-ajalt oma põhjustele otsa. Mõni neist võib olla vahepeal muutunud selgemaks.','Revisit your reasons occasionally. Some may have become clearer with time.','Иногда возвращайтесь к своим причинам. Некоторые со временем становятся яснее.'],
 ['Pika teekonna hoidmine tähendab ka igapäevast hoolt puhkuse ja oma piiride eest.','Maintaining a long journey also means caring for rest and your boundaries.','Продолжать долгий путь — значит также заботиться об отдыхе и личных границах.'],
 ['Suitsust keeldumine võib olla lühike ja rahulik. Sa ei pea tegema sellest vaidlust.','Declining a cigarette can be brief and calm. It need not become a debate.','Отказать в сигарете можно коротко и спокойно. Спорить необязательно.'],
 ['Uued olukorrad vajavad vahel uut plaani. Kohanemine on osa jätkamisest.','New situations sometimes need a new plan. Adapting is part of continuing.','Новые обстоятельства иногда требуют нового плана. Адаптация — часть продолжения пути.'],
 ['Kui sa enam iga päev päevi ei loe, jääb tehtud töö ikkagi alles.','Even if you stop counting days every day, the work you have done remains.','Даже если вы больше не считаете дни ежедневно, проделанная работа остаётся.'],
 ],
 lapse: [
 ['Kirjelda juhtunut faktina, mitte hinnanguna enda väärtusele.','Describe what happened as a fact, not a judgement of your worth.','Опишите случившееся как факт, а не как оценку своей ценности.'],
 ['Üks sigaret ei nõua järgmist. Järgmine otsus on endiselt sinu teha.','One cigarette does not require another. The next decision is still yours.','Одна сигарета не требует следующей. Следующее решение по-прежнему за вами.'],
 ['Uuri olukorda: mis eelnes suitsule ja mida sa tol hetkel vajasid?','Look at the situation: what came before the cigarette, and what did you need then?','Посмотрите на ситуацию: что предшествовало сигарете и что вам тогда было нужно?'],
 ['Sa ei pea ootama esmaspäeva, et oma plaani juurde tagasi tulla.','You do not need to wait for Monday to return to your plan.','Чтобы вернуться к плану, не обязательно ждать понедельника.'],
 ['Hoia alles see, mis juba töötas. Üks keeruline olukord ei muuda kõiki sinu võtteid kasutuks.','Keep what was working. One difficult situation does not make every strategy useless.','Сохраните то, что работало. Одна трудная ситуация не делает все ваши приёмы бесполезными.'],
 ['Kahetsuse asemel võib aidata üks praktiline muudatus järgmise sarnase hetke jaoks.','One practical change for the next similar moment may help more than dwelling on regret.','Одно практическое изменение на похожий случай может помочь больше, чем сожаления.'],
 ['Räägi juhtunust inimesele, kes oskab kuulata ilma süüdistamata.','Tell someone who can listen without blame what happened.','Расскажите о случившемся человеку, который умеет слушать без обвинений.'],
 ['Aus kirje aitab sul mustrit näha. See ei ole karistus.','An honest record helps you see a pattern. It is not a punishment.','Честная запись помогает заметить закономерность. Это не наказание.'],
 ['Sa võid oma loobumisplaani parandada, ilma et peaksid varasema pingutuse tühiseks kuulutama.','You can improve your quit plan without declaring your earlier effort wasted.','Можно улучшить план отказа, не объявляя прошлые усилия напрасными.'],
 ['Kui üksi jätkamine tundub raske, lisa plaani tuge. Kõike ei pea tahtejõuga lahendama.','If continuing alone feels difficult, add support to your plan. Willpower need not do everything.','Если одному продолжать трудно, добавьте поддержку. Не всё нужно решать силой воли.'],
 ],
};
export const thoughtBank = Object.entries(groups).flatMap(([stage, rows]) => rows.map((text, i) => ({ id: `thought-${stage}-${i+1}`, stage: stage as SupportStage, text })));
export function localText(text: Translated, language: Language) { return text[{et:0,en:1,ru:2}[language]]; }
export function supportStage(elapsed: number, preparing: boolean): SupportStage { const days=elapsed/86400000; return preparing?'preparation':days<3?'early':days<7?'week':days<30?'month':'maintenance'; }
export const practicalCards: {id:string; kind:'task'|'tip'; stages:SupportStage[]; text:Translated}[] = [
 {id:'task-triggers',kind:'task',stages:['preparation','week'],text:['Kirjuta üles kolm olukorda, kus tavaliselt suitsetad.','Write down three situations where you usually smoke.','Запишите три ситуации, в которых обычно курите.']},
 {id:'task-break',kind:'task',stages:['preparation','week','month'],text:['Vali järgmiseks pausiks suitsuvaba koht.','Choose a smoke-free place for your next break.','Выберите для следующего перерыва место без дыма.']},
 {id:'task-person',kind:'task',stages:['preparation','early','lapse'],text:['Saada toetavale inimesele lühike sõnum, mida praegu vajad.','Send a supportive person a short message about what you need.','Напишите человеку, который вас поддерживает, что вам сейчас нужно.']},
 {id:'task-water',kind:'task',stages:['early','week'],text:['Pane klaas vett sinna, kus varem hoidsid sigarette.','Put a glass of water where you used to keep cigarettes.','Поставьте стакан воды туда, где раньше лежали сигареты.']},
 {id:'task-walk',kind:'task',stages:['early','week','month','maintenance'],text:['Tee võimalusel lühike jalutuskäik ilma suitsupausita.','If you can, take a short walk without a cigarette break.','Если можете, немного прогуляйтесь без перекура.']},
 {id:'task-goal',kind:'task',stages:['month','maintenance'],text:['Vaata oma säästueesmärki ja kirjuta, mida see sulle võimaldab.','Look at your savings goal and write what it would let you do.','Посмотрите на цель накоплений и запишите, что она вам даст.']},
 {id:'task-plan',kind:'task',stages:['maintenance','lapse'],text:['Valmista ette üks lause järgmiseks sigaretipakkumiseks.','Prepare one sentence for the next offer of a cigarette.','Подготовьте одну фразу на случай предложения сигареты.']},
 {id:'tip-delay',kind:'tip',stages:['early','week','month','maintenance','lapse'],text:['Lükka otsus mõneks minutiks edasi ja vali selleks ajaks üks tegevus.','Delay the decision a few minutes and choose something to do meanwhile.','Отложите решение на несколько минут и займите себя на это время.']},
 {id:'tip-hands',kind:'tip',stages:['preparation','early','week'],text:['Hoia käepärast pliiatsit või väikest eset, millega käsi tegevuses hoida.','Keep a pencil or small object nearby to occupy your hands.','Держите рядом карандаш или небольшой предмет, чтобы занять руки.']},
 {id:'tip-room',kind:'tip',stages:['early','week','month'],text:['Vaheta korraks ruumi, kui vana koht suitsu meelde tuletab.','Change rooms briefly when a familiar place reminds you of smoking.','Ненадолго смените комнату, если знакомое место напоминает о курении.']},
 {id:'tip-breath',kind:'tip',stages:['early','week','month','maintenance','lapse'],text:['Hinga endale mugavas tempos ja lõdvesta õlad. Ära sunni hingamist.','Breathe at a comfortable pace and relax your shoulders. Do not force your breathing.','Дышите в удобном темпе и расслабьте плечи. Не заставляйте себя дышать через силу.']},
 {id:'tip-exit',kind:'tip',stages:['preparation','month','maintenance'],text:['Mõtle ette, kuidas keerulisest olukorrast rahulikult eemalduda.','Plan how to step away calmly from a difficult situation.','Заранее продумайте, как спокойно выйти из сложной ситуации.']},
];

export type SupportCardData = { id:string; title:string; body:string; success?:boolean };
export function dailyCardId(cards: SupportCardData[], day: string): string {
 let hash=0; for(const c of day)hash=(hash*31+c.charCodeAt(0))>>>0;
 const thoughts=cards.filter(c=>c.id.startsWith('thought-'));const pool=thoughts.length?thoughts:cards;
 return pool[hash%pool.length].id;
}
export function nextCardId(cards:SupportCardData[], current:string, recent:string[]):string {
 const candidates=cards.filter(c=>c.id!==current);
 if(!candidates.length)return current;
 return (candidates.find(c=>!recent.includes(c.id)) ?? [...candidates].sort((a,b)=>recent.lastIndexOf(a.id)-recent.lastIndexOf(b.id))[0]).id;
}
