// Static data: exercise library and workout program definitions.
import { loadPlans } from './store.js';

// Bike intensity levels. MET values are rough estimates for stationary cycling
// (Compendium of Physical Activities) and are only used for calorie estimates.
export const LEVELS = {
  easy: {
    label: 'Boşta',
    color: 'var(--lvl-easy)',
    met: 3.5,
    rpm: '70–80',
    hint: 'Direnç en hafif. Rahat pedal, bacakları aç. Rahatça konuşabilmelisin.',
  },
  moderate: {
    label: 'Orta',
    color: 'var(--lvl-moderate)',
    met: 6.8,
    rpm: '80–90',
    hint: 'Direnci orta seviyeye getir. Zorlanıyorsun ama cümle kurabiliyorsun (efor 5-6/10).',
  },
  hard: {
    label: 'Ağır',
    color: 'var(--lvl-hard)',
    met: 8.8,
    rpm: '85–95',
    hint: 'Direnci artır, güçlü bas! Ancak kısa kelimelerle konuşabilirsin (efor 7-8/10).',
  },
  work: { label: 'Çalış', color: 'var(--lvl-hard)', met: 8.0, hint: '' },
  rest: { label: 'Dinlen', color: 'var(--lvl-easy)', met: 3.0, hint: 'Nefesini topla, sıradaki harekete hazırlan.' },
  prep: { label: 'Hazırlan', color: 'var(--muted)', met: 2.0, hint: '' },
};

export const EXERCISES = {
  // --- Bodyweight ---
  squat: {
    name: 'Squat',
    equip: 'bodyweight',
    target: 'Bacak, kalça',
    how: 'Ayaklar omuz genişliğinde. Kalçayı geriye iterek otur, dizler parmak uçlarıyla aynı yönde. Topuklardan iterek kalk.',
    easier: 'Arkana bir sandalye koy, ona dokunup kalk.',
    harder: 'Kalkarken küçük bir zıplama ekle (jump squat).',
  },
  pushup: {
    name: 'Şınav',
    equip: 'bodyweight',
    target: 'Göğüs, omuz, arka kol',
    how: 'Eller omuz hizasında, vücut baştan topuğa düz. Göğsü yere yaklaştır, dirsekler gövdeye 45° açıyla.',
    easier: 'Dizler yerde ya da eller koltuk/masa üzerinde.',
    harder: 'Aşağı inişi 3 saniyede yap.',
  },
  reverse_lunge: {
    name: 'Geri Lunge',
    equip: 'bodyweight',
    target: 'Bacak, kalça, denge',
    how: 'Bir ayakla geriye adım at, iki diz de ~90° olana kadar in. Öndeki topuktan iterek başa dön. Bacak değiştir.',
    easier: 'Hareket aralığını kısalt, bir yere tutun.',
    harder: 'Dumbbell’ı göğüste tut (goblet).',
  },
  mountain_climber: {
    name: 'Mountain Climber',
    equip: 'bodyweight',
    target: 'Karın, kardiyo',
    how: 'Şınav pozisyonunda dizleri sırayla göğse çek. Kalça yukarı fırlamasın.',
    easier: 'Yavaş tempoda, adım adım yap.',
    harder: 'Tempoyu artır.',
  },
  burpee: {
    name: 'Burpee',
    equip: 'bodyweight',
    target: 'Tüm vücut, kardiyo',
    how: 'Çömel, elleri yere koy, ayakları geri at, (isteğe bağlı şınav), ayakları geri getir ve zıpla.',
    easier: 'Zıplamadan ve şınavsız; ayakları tek tek geri at.',
    harder: 'Şınav ve yüksek zıplama ekle.',
  },
  jumping_jack: {
    name: 'Jumping Jack',
    equip: 'bodyweight',
    target: 'Kardiyo',
    how: 'Zıplayarak ayakları aç, kolları baş üstünde birleştir; tekrar kapat.',
    easier: 'Zıplamadan yana adım at (step jack). Alt kat komşusu için de iyi!',
    harder: 'Tempoyu artır.',
  },
  high_knees: {
    name: 'Yüksek Diz',
    equip: 'bodyweight',
    target: 'Kardiyo, karın',
    how: 'Yerinde koşar gibi dizleri kalça hizasına kaldır, kolları çalıştır.',
    easier: 'Zıplamadan yürüyerek diz çek.',
    harder: 'Mümkün olduğunca hızlı.',
  },
  skater: {
    name: 'Skater',
    equip: 'bodyweight',
    target: 'Bacak, kalça, kardiyo',
    how: 'Yana doğru tek ayağın üzerine sıçra, diğer ayak çaprazda arkada. Taraf değiştir.',
    easier: 'Zıplamadan yana adım + dokunuş.',
    harder: 'Daha geniş ve alçak sıçra.',
  },
  plank: {
    name: 'Plank',
    equip: 'bodyweight',
    target: 'Karın, core',
    how: 'Dirsekler omuz altında, vücut düz, karnı ve kalçayı sık. Belini çukurlaştırma.',
    easier: 'Dizler yerde.',
    harder: 'Sırayla bir ayağı havaya kaldır.',
  },
  side_plank: {
    sides: true, // announce 'switch sides' at half time
    name: 'Yan Plank',
    equip: 'bodyweight',
    target: 'Yan karın',
    how: 'Tek dirsek üzerinde yan dön, kalçayı kaldır. Sürenin yarısında taraf değiştir.',
    easier: 'Alttaki diz yerde.',
    harder: 'Üstteki bacağı kaldır.',
  },
  glute_bridge: {
    name: 'Kalça Köprüsü',
    equip: 'bodyweight',
    target: 'Kalça, arka bacak',
    how: 'Sırtüstü yat, dizler bükülü. Topuklardan iterek kalçayı kaldır, tepede 1 sn sık.',
    easier: 'Hareket aralığını kısalt.',
    harder: 'Dumbbell’ı kalça kemiği üzerine koy.',
  },
  dead_bug: {
    name: 'Dead Bug',
    equip: 'bodyweight',
    target: 'Derin karın',
    how: 'Sırtüstü, kollar tavana, dizler 90°. Karşı kol ve bacağı yavaşça uzat, bel yere yapışık kalsın.',
    easier: 'Sadece bacakları hareket ettir.',
    harder: 'Dumbbell’ı iki elle tut.',
  },
  crunch: {
    name: 'Mekik (Crunch)',
    equip: 'bodyweight',
    target: 'Karın',
    how: 'Sırtüstü, dizler bükülü, eller şakakta. Belini yere bastırarak omuzları yerden kaldır, 1 sn sık, kontrollü in. Boynundan çekme.',
    easier: 'Kolları göğüste çaprazla, hareketi kısalt.',
    harder: 'Dumbbell’ı göğsünde tut.',
  },
  bicycle_crunch: {
    name: 'Bisiklet Mekik',
    equip: 'bodyweight',
    target: 'Karın, yan karın',
    how: 'Sırtüstü, eller baş yanında. Dirseği karşı dize doğru çevir, bacaklar pedal çevirir gibi.',
    easier: 'Yavaş yap, ayaklar daha yüksekte.',
    harder: 'Her dönüşte 1 sn bekle.',
  },
  leg_raise: {
    name: 'Bacak Kaldırma',
    equip: 'bodyweight',
    target: 'Alt karın',
    how: 'Sırtüstü, eller kalça altında. Düz bacakları yavaşça kaldır ve indir, yere değdirme.',
    easier: 'Dizleri bükerek yap.',
    harder: 'İnişi 3 saniyede yap.',
  },

  situp: {
    name: 'Mekik (Sit-up)',
    equip: 'bodyweight',
    target: 'Karın, kalça fleksörleri',
    how: 'Sırtüstü, dizler bükülü, ayaklar yerde. Gövdeyi tamamen dikleşene kadar kaldır, kontrollü geri in.',
    easier: 'Ayaklarını bir koltuğun altına sabitle ya da yarım kalk (crunch).',
    harder: 'Dumbbell’ı göğsünde tut.',
  },
  superman: {
    name: 'Superman',
    equip: 'bodyweight',
    target: 'Bel, kalça, sırt',
    how: 'Yüzüstü uzan, kollar önde. Kolları, göğsü ve bacakları aynı anda yerden kaldır, 1-2 sn tut, indir.',
    easier: 'Önce sadece kolları, sonra sadece bacakları kaldır.',
    harder: 'Tepede 3 sn bekle.',
  },

  // --- Dumbbell (all of these work with a single 7.5 kg dumbbell) ---
  goblet_squat: {
    name: 'Goblet Squat',
    equip: 'dumbbell',
    target: 'Bacak, kalça, core',
    how: 'Dumbbell’ı dikey olarak göğsünde tut. Dirsekler dizlerin içinden geçecek kadar derin otur, dik kalk.',
    easier: 'Dumbbell’sız squat.',
    harder: 'Altta 2 sn bekle.',
  },
  db_rdl: {
    name: 'Romanya Deadlift',
    equip: 'dumbbell',
    target: 'Arka bacak, kalça, bel',
    how: 'Dumbbell’ı iki elle önünde tut. Dizler hafif bükük, sırt düz; kalçayı geriye iterek öne eğil, kalçayı sıkarak dikel.',
    easier: 'Hareket aralığını diz hizasında bitir.',
    harder: 'Tek bacak üzerinde yap.',
  },
  db_row: {
    sides: true, // announce 'switch sides' at half time
    name: 'Tek Kol Row',
    equip: 'dumbbell',
    target: 'Sırt, arka omuz',
    how: 'Bir el ve diz koltuk/sandalyede, sırt düz. Dumbbell’ı kalçaya doğru çek. Sürenin yarısında kol değiştir.',
    easier: 'Daha yavaş ve kısa aralıkta.',
    harder: 'Tepede 1 sn bekle.',
  },
  db_press: {
    sides: true, // announce 'switch sides' at half time
    name: 'Omuz Press',
    equip: 'dumbbell',
    target: 'Omuz, arka kol',
    how: 'Ayakta, dumbbell omuz hizasında. Karnı sıkıp yukarı it, kontrollü indir. Sürenin yarısında kol değiştir.',
    easier: 'Oturarak yap.',
    harder: 'Tek ayak üzerinde yap.',
  },
  db_swing: {
    name: 'Dumbbell Swing',
    equip: 'dumbbell',
    target: 'Kalça, arka bacak, kardiyo',
    how: 'Dumbbell’ı iki elle tut. Kalçayı geriye it, bacak arasına sallan; kalçayı patlayıcı şekilde öne iterek göğüs hizasına savur. Güç kollardan değil kalçadan.',
    easier: 'Daha alçak savur.',
    harder: 'Tempoyu artır.',
  },
  db_thruster: {
    name: 'Thruster',
    equip: 'dumbbell',
    target: 'Tüm vücut',
    how: 'Goblet pozisyonunda squat yap, kalkarken dumbbell’ı iki elle baş üstüne it.',
    easier: 'Squat ve press’i ayrı ayrı yap.',
    harder: 'Tempoyu artır.',
  },
  goblet_lunge: {
    name: 'Goblet Geri Lunge',
    equip: 'dumbbell',
    target: 'Bacak, kalça',
    how: 'Dumbbell göğüste, sırayla geriye lunge. Gövde dik.',
    easier: 'Dumbbell’sız yap.',
    harder: 'Her tekrarda 1 sn altta bekle.',
  },
  russian_twist: {
    name: 'Rus Twist',
    equip: 'dumbbell',
    target: 'Yan karın',
    how: 'Otur, gövdeyi hafif geriye yatır. Dumbbell’ı iki elle tutarak sağa-sola döndür.',
    easier: 'Dumbbell’sız ve ayaklar yerde.',
    harder: 'Ayakları yerden kes.',
  },
  woodchop: {
    sides: true, // announce 'switch sides' at half time
    name: 'Oduncu (Woodchop)',
    equip: 'dumbbell',
    target: 'Core, omuz',
    how: 'Dumbbell’ı iki elle tut, bir omuzun üstünden karşı dizine doğru çapraz indir. Sürenin yarısında yön değiştir.',
    easier: 'Daha yavaş ve kısa aralık.',
    harder: 'Alt noktada squat ekle.',
  },
  floor_press: {
    name: 'Yerde Göğüs Press',
    equip: 'dumbbell',
    target: 'Göğüs, arka kol',
    how: 'Sırtüstü, dizler bükülü. Dumbbell’ı iki elle göğüs üstünden yukarı it, dirsekler yere değene kadar indir.',
    easier: 'Tempoyu yavaşlat.',
    harder: 'Tek kolla yap, sürenin yarısında değiştir.',
  },
  db_curl: {
    name: 'Biceps Curl',
    equip: 'dumbbell',
    target: 'Ön kol (biceps)',
    how: 'Ayakta, dirsek gövdeye yapışık. Dumbbell’ı avuç yukarı bakacak şekilde omza doğru kaldır, yavaş indir. Sürenin yarısında kol değiştir.',
    easier: 'Hareketi yavaşlat, sallanmadan yap.',
    harder: 'İnişi 3 saniyede yap.',
    sides: true,
  },
  db_hammer: {
    name: 'Hammer Curl',
    equip: 'dumbbell',
    target: 'Biceps, ön kol',
    how: 'Dumbbell’ı çekiç tutar gibi (avuç içe bakar) tut, dirseği sabit tutarak omza doğru kaldır. Sürenin yarısında kol değiştir.',
    easier: 'Hareketi kısalt.',
    harder: 'Tepede 1 sn bekle.',
    sides: true,
  },
  db_triceps: {
    name: 'Baş Üstü Triceps',
    equip: 'dumbbell',
    target: 'Arka kol (triceps)',
    how: 'Dumbbell’ı iki elle baş üstünde tut. Dirsekler kulak yanında sabit; dumbbell’ı başın arkasına indir, tekrar yukarı uzat.',
    easier: 'Oturarak yap.',
    harder: 'İnişi 3 saniyede yap.',
  },
  db_kickback: {
    name: 'Triceps Kickback',
    equip: 'dumbbell',
    target: 'Arka kol (triceps)',
    how: 'Bir el ve diz sandalyede, sırt düz. Üst kol gövdeye paralel; dirseği açarak dumbbell’ı geriye it. Sürenin yarısında kol değiştir.',
    easier: 'Hareketi yavaşlat.',
    harder: 'Tepede 1 sn bekle.',
    sides: true,
  },
  db_lateral: {
    name: 'Lateral Raise',
    equip: 'dumbbell',
    target: 'Omuz (yan)',
    how: 'Ayakta, dirsek hafif bükük. Dumbbell’ı yana doğru omuz hizasına kaldır, kontrollü indir. Sürenin yarısında kol değiştir.',
    easier: 'Omuz hizasına kadar değil, biraz altına kaldır.',
    harder: 'Tepede 1 sn bekle.',
    sides: true,
  },
  db_front: {
    name: 'Ön Kaldırış',
    equip: 'dumbbell',
    target: 'Omuz (ön)',
    how: 'Dumbbell’ı iki elle uyluklarının önünde tut. Kollar düz, göz hizasına kadar öne kaldır, yavaş indir.',
    easier: 'Göğüs hizasına kadar kaldır.',
    harder: 'İnişi 3 saniyede yap.',
  },
  db_sumo: {
    name: 'Sumo Squat',
    equip: 'dumbbell',
    target: 'İç bacak, kalça',
    how: 'Ayaklar geniş, parmak uçları dışa dönük. Dumbbell’ı iki elle aşağıda tut, kalçayı dik tutarak çömel ve kalk.',
    easier: 'Dumbbell’sız yap.',
    harder: 'Altta 2 sn bekle.',
  },
  db_calf: {
    name: 'Baldır Kaldırma',
    equip: 'dumbbell',
    target: 'Baldır',
    how: 'Dumbbell bir elde, diğer elle duvara tutun. Topukları kaldırıp parmak uçlarında yüksel, yavaş in.',
    easier: 'Dumbbell’sız yap.',
    harder: 'Tek ayak üzerinde yap.',
  },
  db_reverse_fly: {
    name: 'Ters Fly',
    equip: 'dumbbell',
    target: 'Arka omuz, üst sırt',
    how: 'Kalçadan öne eğil, sırt düz. Dumbbell’ı dirsek hafif bükük şekilde yana doğru kaldır, kürek kemiklerini sık. Sürenin yarısında kol değiştir.',
    easier: 'Daha az eğil.',
    harder: 'Tepede 1 sn bekle.',
    sides: true,
  },
  db_shrug: {
    name: 'Shrug',
    equip: 'dumbbell',
    target: 'Trapez (omuz üstü)',
    how: 'Ayakta, dumbbell yanında. Omuzları kulaklara doğru kaldır, 1 sn tut, indir. Sürenin yarısında taraf değiştir.',
    easier: 'Hareketi yavaşlat.',
    harder: 'Tepede 2 sn bekle.',
    sides: true,
  },
};

// Exercises with start/end photos in img/ex/<id>-0.webp and -1.webp.
// Photos: free-exercise-db (github.com/yuhonas/free-exercise-db), public domain (Unlicense).
const PHOTO_IDS = new Set([
  'squat', 'pushup', 'reverse_lunge', 'mountain_climber', 'jumping_jack', 'skater', 'plank', 'side_plank',
  'glute_bridge', 'dead_bug', 'bicycle_crunch', 'leg_raise', 'crunch', 'situp', 'superman',
  'goblet_squat', 'db_rdl', 'db_row', 'db_press', 'db_swing', 'db_thruster', 'goblet_lunge', 'russian_twist',
  'floor_press', 'db_curl', 'db_hammer', 'db_triceps', 'db_kickback', 'db_lateral', 'db_front', 'db_sumo',
  'db_calf', 'db_reverse_fly', 'db_shrug', 'bike',
]);

export function exercisePhotos(id) {
  return PHOTO_IDS.has(id) ? [`img/ex/${id}-0.webp`, `img/ex/${id}-1.webp`] : null;
}

export const PHOTO_FILES = [...PHOTO_IDS].flatMap((id) => [`img/ex/${id}-0.webp`, `img/ex/${id}-1.webp`]);

// Bike flows. Each spec is a list of steady blocks ({ level, min, label })
// and interval sets ({ intervals: n } = n x (1 min moderate + 1 min hard)).
const warmUp = { level: 'easy', min: 5, label: 'Isınma' };
const coolDown = { level: 'easy', min: 5, label: 'Soğuma' };
const steady = (min) => ({ level: 'moderate', min, label: 'Orta tempo' });

const BIKE_SPECS = {
  30: [warmUp, steady(5), { intervals: 5 }, steady(5), coolDown],
  40: [warmUp, steady(5), { intervals: 10 }, steady(5), coolDown],
  45: [warmUp, steady(5), { intervals: 12 }, steady(6), coolDown],
  50: [warmUp, steady(5), { intervals: 15 }, steady(5), coolDown],
  // Two interval sets with an easy recovery block so the hour stays sustainable.
  60: [
    warmUp, steady(5), { intervals: 10 },
    { level: 'easy', min: 4, label: 'Aktif dinlenme' },
    { intervals: 8 }, steady(5), coolDown,
  ],
};

export const BIKE_MINUTES = Object.keys(BIKE_SPECS).map(Number);

function bikeBlocks(spec) {
  const sets = spec.filter((s) => s.intervals).length;
  let setNo = 0;
  const blocks = [];
  for (const s of spec) {
    if (!s.intervals) {
      blocks.push({ level: s.level, dur: s.min * 60, label: s.label });
      continue;
    }
    setNo++;
    const prefix = sets > 1 ? `Set ${setNo} · ` : '';
    for (let i = 1; i <= s.intervals; i++) {
      blocks.push({ level: 'moderate', dur: 60, label: `${prefix}Aralık ${i}/${s.intervals} · Orta` });
      blocks.push({ level: 'hard', dur: 60, label: `${prefix}Aralık ${i}/${s.intervals} · Ağır` });
    }
  }
  return blocks;
}

function bikeDesc(spec) {
  return spec.map((s) => (s.intervals
    ? `${s.intervals * 2} dk 1’er dk orta/ağır`
    : `${s.min} dk ${LEVELS[s.level].label.toLocaleLowerCase('tr')}`)).join(' · ');
}

const BIKE_PROGRAMS = BIKE_MINUTES.map((min) => ({
  id: `bike${min}`,
  kind: 'bike',
  minutes: min,
  name: `${min} dk Bisiklet Akışı`,
  desc: bikeDesc(BIKE_SPECS[min]),
  blocks: bikeBlocks(BIKE_SPECS[min]),
}));

export const PROGRAMS = [
  ...BIKE_PROGRAMS,
  {
    id: 'db_burn',
    kind: 'circuit',
    name: 'Dumbbell Yağ Yakıcı',
    desc: 'Tek 7.5 kg dumbbell ile tüm vücut devresi.',
    work: 40,
    rest: 20,
    rounds: 3,
    roundRest: 60,
    exercises: ['goblet_squat', 'db_row', 'db_swing', 'goblet_lunge', 'db_press', 'mountain_climber', 'russian_twist', 'db_thruster'],
  },
  {
    id: 'bw_hiit',
    kind: 'circuit',
    name: 'Vücut Ağırlığı HIIT',
    desc: 'Ekipmansız, nabzı yükselten kardiyo devresi.',
    work: 30,
    rest: 15,
    rounds: 3,
    roundRest: 45,
    exercises: ['jumping_jack', 'squat', 'pushup', 'high_knees', 'reverse_lunge', 'mountain_climber', 'skater', 'burpee'],
  },
  {
    id: 'strength_mix',
    kind: 'circuit',
    name: 'Kısa Kuvvet',
    desc: 'Bisiklet olmayan günler için kas koruyucu kuvvet devresi.',
    work: 45,
    rest: 15,
    rounds: 2,
    roundRest: 60,
    exercises: ['goblet_squat', 'pushup', 'db_rdl', 'db_row', 'glute_bridge', 'floor_press'],
  },
  {
    id: 'core',
    kind: 'circuit',
    name: 'Core Bitirici',
    desc: 'Bisikletin ardından 8 dakikalık karın bitirici.',
    work: 40,
    rest: 20,
    rounds: 1,
    roundRest: 0,
    exercises: ['plank', 'dead_bug', 'russian_twist', 'glute_bridge', 'bicycle_crunch', 'side_plank', 'woodchop', 'leg_raise'],
  },
  {
    id: 'combo',
    kind: 'combo',
    name: 'Bisiklet + Core',
    desc: 'Seçtiğin bisiklet akışı, ardından 8 dk core bitirici.',
    // 'bike' is resolved to the selected duration (opts.bikeId) at build time.
    parts: ['bike', 'core'],
  },
];

// Short summary of a user plan, e.g. "Isınma · 10× Aralıklar · Soğuma".
function describePlan(plan) {
  return plan.sections
    .filter((s) => s.items.length)
    .map((s) => `${s.repeat > 1 ? `${s.repeat}× ` : ''}${s.name || `${s.items.length} adım`}`)
    .join(' · ');
}

export function getProgram(id) {
  const builtIn = PROGRAMS.find((p) => p.id === id);
  if (builtIn) return builtIn;
  const plan = loadPlans().find((p) => p.id === id);
  return plan && { ...plan, kind: 'custom', desc: describePlan(plan) };
}
