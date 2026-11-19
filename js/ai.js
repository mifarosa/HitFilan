// Meal calorie estimates from free text, using Gemini through Firebase AI Logic
// (Gemini Developer API, free tier: needs no billing account).
// The SDK is only downloaded when the user asks for an estimate.
import { firebaseConfig } from './firebase-config.js';
import { cleanItems, mealPrompt } from './ai-core.js';

export { cleanItems };

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';
const MODEL = 'gemini-2.5-flash';
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

// Returns [{ name, kcal }]; throws when the AI is unavailable (caller falls back to manual entry).
export async function estimateMeal(text) {
  if (!firebaseConfig) throw new Error('no-config');
  const model = await loadModel();
  const result = await model.generateContent(mealPrompt(text));
  return cleanItems(JSON.parse(result.response.text()));
}
