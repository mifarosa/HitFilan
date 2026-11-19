import { describe, expect, it, vi } from 'vitest';
import { addMeals, analyzeMeal, askCoach, commentDay, deleteMeal, proposePlan, savePlan, todayMeals } from '@/ai/features';
import { loadMeals, loadPlans, saveSettings, loadSettings } from '@/shared';

const reply = (text: string) => vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 }));
const cfg = (f: any, sendContext = true) => ({ provider: 'openai' as const, model: 'm', key: 'k', sendContext, fetchImpl: f });
const bodyOf = (f: any) => JSON.parse(f.mock.calls[0][1].body);

describe('meal analysis', () => {
  it('returns cleaned items, even from a reply wrapped in text', async () => {
    const f = reply('Tamam: [{"name":"Simit","kcal":280},{"name":"Çay","kcal":2}] hepsi bu');
    expect(await analyzeMeal('1 simit 1 çay', cfg(f))).toEqual([{ name: 'Simit', kcal: 280 }, { name: 'Çay', kcal: 2 }]);
    expect(bodyOf(f).messages[1].content).toContain('"""1 simit 1 çay"""');
  });

  it('saves meals only through addMeals, newest first, and can delete them', () => {
    addMeals([{ name: ' Simit ', kcal: 280.4 }, { name: '', kcal: 5 }, { name: 'Çay', kcal: 0 }], 'morning');
    expect(todayMeals().map((m) => `${m.name}:${m.kcal}:${m.slot}`)).toEqual(['Simit:280:morning']);
    deleteMeal(loadMeals()[0].id);
    expect(todayMeals()).toEqual([]);
  });
});

describe('coach', () => {
  it('sends one question with only the energy numbers; no chat, no profile, no key', async () => {
    saveSettings({ ...loadSettings(), weightKg: 81, heightCm: 180, age: 30, sex: 1 });
    const f = reply('Su iç.');
    expect(await askCoach('Bugün ne yapayım?', cfg(f))).toBe('Su iç.');
    const b = bodyOf(f);
    expect(b.messages).toHaveLength(2); // system + the question
    expect(b.messages[1]).toEqual({ role: 'user', content: 'Bugün ne yapayım?' });
    expect(b.messages[0].content).toContain('Günlük kalori ihtiyacı:');
    expect(b.messages[0].content).toContain('harcanan:');
    expect(b.messages[0].content).not.toContain('81 kg');
    expect(b.messages[0].content).not.toContain('180 cm');
    expect(JSON.stringify(b)).not.toContain('"k"');
  });

  it('leaves the numbers out when the user turned the context off', async () => {
    const f = reply('ok');
    await askCoach('merhaba', cfg(f, false));
    expect(bodyOf(f).messages[0].content).not.toContain('<baglam>\n');
  });

  it('comments the day with meal times', async () => {
    addMeals([{ name: 'Pilav', kcal: 500 }], 'evening');
    const f = reply('Akşam biraz ağır.');
    expect(await commentDay(cfg(f))).toBe('Akşam biraz ağır.');
    const b = bodyOf(f);
    expect(b.messages[0].content).toContain('Bugün spor yaptın mı?');
    expect(b.messages[1].content).toContain('(akşam) Pilav ~500 kcal');
    expect(b.messages[1].content).toMatch(/\d\d:\d\d/);
  });
});

describe('plan proposals', () => {
  it('checks the reply and saves only on request', async () => {
    const f = reply('{"name":"Hızlı bacak","items":[{"exercise":"squat","sets":3,"reps":15},{"exercise":"ucuk_hareket"}]}');
    const v = await proposePlan('15 dk bacak', cfg(f));
    expect(v?.items).toHaveLength(1);
    expect(v?.dropped).toBe(1);
    expect(loadPlans().some((p) => p.name === 'Hızlı bacak')).toBe(false); // a proposal is not a plan yet
    const plan = savePlan(v!);
    expect(loadPlans()[0].id).toBe(plan.id);
    expect(loadPlans()[0].sections[0].items[0]).toMatchObject({ exercise: 'squat', sets: 3, reps: 15 });
  });

  it('returns null for a useless reply', async () => {
    expect(await proposePlan('x', cfg(reply('{"items":[]}')))).toBeNull();
    expect(await proposePlan('x', cfg(reply('düz metin')))).toBeNull();
  });
});
