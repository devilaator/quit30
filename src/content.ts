import { thoughtBank, practicalCards, localText, supportStage, SupportCardData } from './supportLibrary';
import { Language, DAY, earnedAchievements } from './model';
import { copy, t } from './i18n';
export const recoverySources = ['https://www.nhs.uk/better-health/quit-smoking/', 'https://www.cdc.gov/tobacco/about/benefits-of-quitting.html'];
// Thresholds indicate the beginning of a population-level range, not individual guarantees.
const recoveryData: [
    number,
    [
        string,
        string,
        string
    ],
    [
        string,
        string,
        string
    ]
][] = [
    [20 / 1440, ['20 min', '20 minutes', '20 минут'], ['Pulss võib hakata langema.', 'Heart rate may start to fall.', 'Пульс может начать снижаться.']],
    [8 / 24, ['8 tundi', '8 hours', '8 часов'], ['Hapniku kättesaadavus võib paraneda, kui vingugaasi hulk veres väheneb.', 'Oxygen availability may improve as carbon monoxide falls.', 'По мере снижения угарного газа может улучшаться поступление кислорода.']],
    [1, ['24 tundi', '24 hours', '24 часа'], ['Ilma nikotiini juurde saamata võib nikotiinitase veres olla väga madal.', 'Without further nicotine intake, blood nicotine may be very low.', 'Без нового поступления никотина его уровень в крови может стать очень низким.']],
    [2, ['48 tundi', '48 hours', '48 часов'], ['Vingugaasi tase langeb; maitse- ja lõhnataju võivad paraneda.', 'Carbon monoxide falls; taste and smell may improve.', 'Уровень угарного газа снижается; вкус и обоняние могут улучшаться.']],
    [3, ['72 tundi', '72 hours', '72 часа'], ['Bronhid võivad lõõgastuda ja hingamine tunduda kergem.', 'Airways may relax and breathing may feel easier.', 'Бронхи могут расслабляться, а дыхание — становиться легче.']],
    [14, ['2–12 nädalat', '2–12 weeks', '2–12 недель'], ['Vereringe võib paraneda ja liikumine muutuda kergemaks.', 'Circulation may improve and activity may feel easier.', 'Кровообращение может улучшаться, а движение — даваться легче.']],
    [30, ['1–12 kuud', '1–12 months', '1–12 месяцев'], ['Paljudel vähenevad aja jooksul köha ja õhupuudus.', 'Coughing and breathlessness decrease over time for many people.', 'У многих со временем уменьшаются кашель и одышка.']],
    [90, ['3–9 kuud', '3–9 months', '3–9 месяцев'], ['Kopsufunktsioon võib paraneda; köha ja vilistav hingamine võivad väheneda.', 'Lung function may improve; coughing and wheezing may ease.', 'Функция лёгких может улучшаться; кашель и хрипы — уменьшаться.']],
    [365, ['1–2 aastat', '1–2 years', '1–2 года'], ['Südameinfarkti risk väheneb võrreldes suitsetamise jätkamisega.', 'Heart attack risk falls compared with continued smoking.', 'Риск инфаркта снижается по сравнению с продолжением курения.']],
    [365 * 5, ['5–10 aastat', '5–10 years', '5–10 лет'], ['Mitme suitsetamisega seotud vähi ja insuldi risk võib väheneda.', 'Risks of several smoking-related cancers and stroke may fall.', 'Риск ряда связанных с курением видов рака и инсульта может снижаться.']],
    [365 * 10, ['10–15 aastat', '10–15 years', '10–15 лет'], ['Kopsuvähi lisarisk võib olla märgatavalt väiksem kui suitsetamist jätkates.', 'Added lung cancer risk may be substantially lower than with continued smoking.', 'Дополнительный риск рака лёгких может быть значительно ниже, чем при продолжении курения.']],
];
export function recoveryAt(elapsed: number, language: Language) {
    const index = { et: 0, en: 1, ru: 2 }[language];
    const stages = recoveryData.map(([days, label, body]) => ({ at: days * DAY, label: label[index], body: body[index] }));
    return { current: stages.filter(s => s.at <= elapsed).at(-1), next: stages.find(s => s.at > elapsed) };
}
export function supportCards(language: Language, elapsed: number, preparing: boolean, money: number, cigarettes: number, reasons: string[], recentLapse = false): SupportCardData[] {
 const stage=supportStage(elapsed,preparing);
 const cards:SupportCardData[]=thoughtBank.filter(c=>c.stage===stage || (recentLapse && c.stage==='lapse')).map(c=>({id:c.id,title:t(language,c.stage==='lapse'?'supportAfterLapse':'thought'),body:localText(c.text,language)}));
 for(const card of practicalCards.filter(c=>c.stages.includes(stage) || (recentLapse && c.stages.includes('lapse')))) cards.push({id:card.id,title:t(language,card.kind),body:localText(card.text,language)});
 cards.push({id:'lapse-guidance',title:t(language,'lapseSupport'),body:t(language,'lapseHint')});
 if(!preparing){
  cards.push({id:'recovery',title:t(language,'recovery'),body:recoveryAt(elapsed,language).current?.body??t(language,'recoveryWaiting')});
  cards.push({id:'gains',title:t(language,'gained'),body:t(language,'gains',{money:'€'+money.toFixed(2),n:Math.floor(cigarettes)}),success:true});
  earnedAchievements(elapsed).forEach(n=>cards.push({id:'achievement-'+n,title:t(language,'achievement'),body:t(language,'daysFree',{n}),success:true}));
 }
 reasons.filter(Boolean).forEach((body,i)=>cards.push({id:'reason-'+i,title:t(language,'reasons'),body}));
 return cards;
}
export function cravingContent(language: Language, seconds: number) {
    const phase = Math.min(4, Math.max(0, Math.floor((300 - seconds) / 60)));
    const actions = [
        ['💧', 'Joo aeglaselt klaas vett.', 'Drink a glass of water slowly.', 'Медленно выпейте стакан воды.'],
        ['🌬️', 'Hinga rahulikult ja lase õlad alla.', 'Breathe slowly and relax your shoulders.', 'Дышите медленно и расслабьте плечи.'],
        ['🚶', 'Muuda asukohta või tee lühike jalutuskäik.', 'Change location or take a short walk.', 'Смените место или немного прогуляйтесь.'],
        ['👐', 'Anna kätele tegevust. Joonista või voldi paberit.', 'Keep your hands busy. Draw or fold some paper.', 'Займите руки. Порисуйте или сложите бумагу.'],
        ['❤️', 'Tuleta meelde, miks loobumine sulle oluline on.', 'Remember why quitting matters to you.', 'Вспомните, почему для вас важно бросить.'],
    ];
    return { icon: seconds <= 0 ? '✓' : actions[phase][0], title: t(language, seconds <= 0 ? 'cravingDone' : 'tip'), body: seconds <= 0 ? t(language, 'cravingHowNow') : actions[phase][{ et: 1, en: 2, ru: 3 }[language]] };
}
export function russianMotivation(key: string) {
    const [kind, value] = key.split('-');
    if (kind === 'money')
        return { title: `💰 Сэкономлено €${value}`, body: 'Ваши сбережения растут. Посмотрите на свой прогресс.' };
    if (kind === 'cigs')
        return { title: `🚭 Не выкурено сигарет: ${value}`, body: 'Каждый шаг имеет значение. Продолжайте в своём темпе.' };
    return { title: '🏆 Новое достижение QUIT30', body: key === 'time-12h' ? '12 часов без сигарет. Двигайтесь дальше, шаг за шагом.' : `Вы продолжаете путь без сигарет. Откройте QUIT30 и посмотрите на свой прогресс.` };
}
