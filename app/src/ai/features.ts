// The three AI features, on top of the providers: what is asked (the prompts live in the shared js/ai-core.js),
// how the reply is checked, and what is saved. Nothing the model says is saved without the user's say-so.
import {
  COACH_SYSTEM, EXERCISES, cleanItems, coachContext, dayOf, loadHistory, loadMeals, loadPlans, loadSettings, mealPrompt,
  planFromAi, planSystem, saveMeals, savePlans, validatePlan, type MealItem, type UserPlan, type ValidPlan,
} from '@/shared';
import { ask, extractJson, type Msg, type Provider } from './providers';

export interface AiConfig {
  provider: Provider;
  model: string;
  key: string;
  /** Send the short summary of the user (weight, goal, recent workouts) with coach questions and plan requests. */
  sendContext: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

const base = (c: AiConfig) => ({ provider: c.provider, model: c.model, key: c.key, signal: c.signal, fetchImpl: c.fetchImpl });

const context = (c: AiConfig) =>
  c.sendContext ? coachContext({ settings: loadSettings(), history: loadHistory() }) : '';

/** "2 simit, 1 çay" -> [{ name, kcal }]. Estimates; the user edits them before they are added. */
export async function analyzeMeal(text: string, c: AiConfig): Promise<MealItem[]> {
  const reply = await ask({
    ...base(c),
    system: 'Sen bir beslenme asistanısın. Yalnızca istenen JSON biçiminde yanıt ver.',
    messages: [{ role: 'user', content: mealPrompt(text) }],
    json: true,
    maxTokens: 600,
  });
  return cleanItems(extractJson(reply));
}

/** One coach answer. `history` is the earlier chat (already shown), `question` the new message. */
export async function askCoach(history: Msg[], question: string, c: AiConfig): Promise<string> {
  const ctx = context(c);
  return ask({
    ...base(c),
    system: ctx ? `${COACH_SYSTEM}\n\n${ctx}` : COACH_SYSTEM,
    messages: [...history.slice(-12), { role: 'user', content: question.slice(0, 1000) }],
    maxTokens: 700,
  });
}

/** "haftada 3 gün 30 dk, dumbbell var" -> a checked plan proposal (not saved). Null when nothing usable came back. */
export async function proposePlan(request: string, c: AiConfig): Promise<ValidPlan | null> {
  const ctx = context(c);
  const reply = await ask({
    ...base(c),
    system: ctx ? `${planSystem()}\n\n${ctx}` : planSystem(),
    messages: [{ role: 'user', content: request.slice(0, 500) }],
    json: true,
    maxTokens: 1200,
  });
  return validatePlan(extractJson(reply), EXERCISES);
}

/* ---------- Saving (shared store: the same data the web app and the cloud backup use) ---------- */

export function addMeals(items: MealItem[], now = Date.now()): void {
  const added = items
    .filter((it) => it.name.trim() && it.kcal > 0)
    .map((it, i) => ({
      id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}${i}`,
      date: new Date(now + i).toISOString(),
      name: it.name.trim().slice(0, 60),
      kcal: Math.round(it.kcal),
    }));
  if (added.length) saveMeals([...added, ...loadMeals()]);
}

export function deleteMeal(id: string): void {
  saveMeals(loadMeals().filter((m) => m.id !== id));
}

export function todayMeals() {
  const today = dayOf(new Date().toISOString());
  return loadMeals().filter((m) => dayOf(m.date) === today).sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/** Saves a proposal as a user plan; it then appears in "Planlarım" on the home screen. */
export function savePlan(valid: ValidPlan): UserPlan {
  const plan = planFromAi(valid);
  savePlans([plan, ...loadPlans()]);
  return plan;
}
