// The web app's plain JavaScript, shared as it is (see metro.config.js). Importing this file also installs
// the storage adapter, so every shared module reads and writes the phone's storage.
import './storage';

import * as data from '@shared/data.js';
import * as stepsJs from '@shared/steps.js';
import { SequenceTimer as SequenceTimerJs } from '@shared/timer.js';
import * as videoCore from '@shared/video-core.js';
import * as storeJs from '@shared/store.js';
import * as aiCore from '@shared/ai-core.js';
import * as nutrition from '@shared/nutrition-core.js';

/** One step of a workout, as built by buildSteps(). */
export interface Step {
  label: string;
  level: 'easy' | 'moderate' | 'hard' | 'work' | 'rest' | 'prep';
  tag: string;
  hint: string;
  dur: number;
  exercise?: string;
  reps?: number;
  open?: boolean;
}

export interface Settings {
  weightKg: number;
  bikeId: string;
  warnSeconds: number;
  resEasy: number;
  resModerate: number;
  resHard: number;
  beeps: boolean;
  voice: boolean;
  vibrate: boolean;
  [key: string]: unknown;
}

export interface Program {
  id: string;
  kind: 'bike' | 'circuit' | 'combo' | 'custom';
  name: string;
  desc: string;
  minutes?: number;
}

export interface Exercise {
  name: string;
  equip: string;
  target: string;
  how: string;
  easier: string;
  harder: string;
  group: string;
  sides?: boolean;
}

export interface TimerHandlers {
  onStep?(step: Step, index: number, info: { fresh?: boolean; manual?: boolean }): void;
  onCue?(secLeft: number, step: Step, next?: Step): void;
  onTick?(timer: TimerLike): void;
  onFinish?(timer: TimerLike): void;
}

/** The shared SequenceTimer (js/timer.js). */
export interface TimerLike {
  steps: Step[];
  index: number;
  running: boolean;
  finished: boolean;
  current: Step;
  stepElapsed(): number;
  stepRemaining(): number;
  totalElapsed(): number;
  start(): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  stop(): void;
}

export const SequenceTimer = SequenceTimerJs as unknown as new (steps: Step[], handlers: TimerHandlers) => TimerLike;

export const BIKE_MINUTES = data.BIKE_MINUTES as number[];
export const PROGRAMS = data.PROGRAMS as unknown as Program[];
export const EXERCISES = data.EXERCISES as unknown as Record<string, Exercise>;
export const GROUPS = data.GROUPS as { id: string; label: string }[];
export const LEVELS = data.LEVELS as unknown as Record<Step['level'], { label: string; met: number; rpm?: string; hint: string }>;
export const getProgram = data.getProgram as (id: string) => Program | undefined;

export const buildSteps = stepsJs.buildSteps as (programId: string, opts?: { bikeId?: string }) => Step[];
export const totalSeconds = stepsJs.totalSeconds as (steps: Step[]) => number;
export const estimateKcal = stepsJs.estimateKcal as (steps: Step[], weightKg: number, doneSeconds?: number) => number;
export const formatTime = stepsJs.formatTime as (totalSec: number) => string;
export const programInfo = stepsJs.programInfo as (programId: string, opts?: { bikeId?: string }) => { name: string; desc: string };
export const historyEntry = stepsJs.historyEntry as (
  programId: string, name: string, startedAt: string, steps: Step[], elapsed: number, completed: boolean, weightKg: number,
) => Record<string, unknown>;
export const DEFAULT_BIKE = stepsJs.DEFAULT_BIKE as string;

export interface YouTubeLink {
  kind: 'video' | 'playlist';
  id: string;
}
export const parseYouTube = videoCore.parseYouTube as (text: string) => YouTubeLink | null;
export const watchUrl = videoCore.watchUrl as (v: YouTubeLink) => string;
export const playerErrorText = videoCore.playerErrorText as (code: number) => string;
export const embedVerdict = videoCore.embedVerdict as (status: number) => 'ok' | 'blocked' | 'missing' | 'unknown';

export const DEFAULT_SETTINGS = storeJs.DEFAULT_SETTINGS as unknown as Settings;
export const loadSettings = storeJs.loadSettings as () => Settings;
export const saveSettings = storeJs.saveSettings as (settings: Settings) => void;
export const addHistory = storeJs.addHistory as (entry: Record<string, unknown>) => void;
export const loadHistory = storeJs.loadHistory as () => Record<string, unknown>[];

// ---- AI (prompts, context and validators: js/ai-core.js) and the calorie balance (js/nutrition-core.js) ----
export interface MealItem { name: string; kcal: number }
export interface Meal extends MealItem { id: string; date: string }
export interface PlanItem {
  type: 'exercise';
  exercise: string;
  sets: number;
  reps?: number;
  dur: number;
  kg?: number;
  rest: number;
}
export interface ValidPlan { name: string; note: string; items: PlanItem[]; dropped: number }
export interface UserPlan {
  id: string;
  name: string;
  sections: { name: string; repeat: number; items: PlanItem[] }[];
}

export const mealPrompt = aiCore.mealPrompt as (text: string) => string;
export const cleanItems = aiCore.cleanItems as (raw: unknown) => MealItem[];
export const COACH_SYSTEM = aiCore.COACH_SYSTEM as string;
export const coachContext = aiCore.coachContext as unknown as (a: { settings: Settings; history: Record<string, unknown>[]; now?: number }) => string;
export const planSystem = aiCore.planSystem as (exercises?: Record<string, Exercise>) => string;
export const validatePlan = aiCore.validatePlan as (raw: unknown, exercises?: Record<string, Exercise>) => ValidPlan | null;
export const planFromAi = aiCore.planFromAi as (valid: ValidPlan, now?: number) => UserPlan;

export const dayOf = nutrition.dayOf as (iso: string) => string;
export const dayBalance = nutrition.dayBalance as (a: {
  meals: Meal[]; history: Record<string, unknown>[]; day: string; settings: Settings;
}) => { eaten: number; burned: number; target: number; balance: number };

export const loadMeals = storeJs.loadMeals as () => Meal[];
export const saveMeals = storeJs.saveMeals as (meals: Meal[]) => void;
export const loadPlans = storeJs.loadPlans as () => UserPlan[];
export const savePlans = storeJs.savePlans as (plans: UserPlan[]) => void;
