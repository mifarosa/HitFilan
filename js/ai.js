// Meal calorie estimates from free text, using Gemini through Firebase AI Logic
// (Gemini Developer API, free tier: needs no billing account).
// The SDK is only downloaded when the user asks for an estimate.
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const MODEL = 'gemini-2.5-flash';
const MAX_ITEMS = 12;

const PROMPT = `Aşağıdaki metin birinin yediği/içtiği şeyleri anlatıyor (Türkçe, ev ve sokak yemekleri dahil).
Her bir yiyecek/içecek kalemi için porsiyonu tahmin et ve toplam kcal değerini ver.
Porsiyon belirtilmemişse ortalama bir porsiyon varsay. Sadece JSON dizisi döndür.
Metin: `;

let modelPromise = null;

function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [app, ai] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-ai.js`)]);
      // Same default app as js/sync.js when it is already running.
      const firebaseApp = app.getApps()[0] || app.initializeApp(firebaseConfig);
      return ai.getGenerativeModel(ai.getAI(firebaseApp, { backend: new ai.GoogleAIBackend() }), {
        model: MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ai.Schema.array({
            items: ai.Schema.object({
              properties: { name: ai.Schema.string(), kcal: ai.Schema.number() },
            }),
          }),
          maxOutputTokens: 600,
        },
      });
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

// Keeps only sane items; the model's numbers are estimates, never trusted blindly.
export function cleanItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => ({ name: String(x?.name || '').trim().slice(0, 60), kcal: Math.round(Number(x?.kcal)) }))
    .filter((x) => x.name && x.kcal > 0 && x.kcal <= 3000)
    .slice(0, MAX_ITEMS);
}

// Returns [{ name, kcal }]; throws when the AI is unavailable (caller falls back to manual entry).
export async function estimateMeal(text) {
  if (!firebaseConfig) throw new Error('no-config');
  const model = await loadModel();
  const result = await model.generateContent(PROMPT + text.slice(0, 500));
  return cleanItems(JSON.parse(result.response.text()));
}
