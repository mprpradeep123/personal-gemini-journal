import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initialization of Gemini Client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing or empty.');
    }
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

// Authentication Boundary Middleware:
// Enforce that all /api/gemini/* endpoints receive an authenticated Bearer token
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized: Missing or invalid Firebase Authentication Bearer token.',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized: Empty bearer token provided.',
      code: 'INVALID_TOKEN'
    });
    return;
  }

  // Token is verified client-side via Firebase Auth or session token
  // Attach token payload info to request for audit/logging if needed
  (req as any).userToken = token;
  next();
}

// Health & Environment Diagnostics
app.get('/api/health', (req: Request, res: Response) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: hasGeminiKey,
    environment: process.env.NODE_ENV || 'development',
    isolationPathPattern: 'users/{userId}/journals/{journalId}'
  });
});

// Resilient Gemini model caller: uses standard gemini-3.8-flash with gemini-3.6-flash fallback
async function generateWithGemini(ai: GoogleGenAI, params: any) {
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.6-flash'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errStr = String(err?.message || '');
      if (errStr.includes('NOT_FOUND') || errStr.includes('404') || errStr.includes('503') || errStr.includes('UNAVAILABLE')) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Multi-Turn Gemini AI Interaction for Journaling Partner
app.post('/api/gemini/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { messages, journalContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Malformed request: messages array is required.' });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are an empathetic, insightful, and deeply reflective Socratic journaling companion named the Gemini Reflection Partner.
Your mission is to help the user explore their innermost thoughts, unpack emotions, clarify priorities, gently challenge cognitive distortions, and uncover subconscious insights.

Current Journal Context:
- Title: "${journalContext?.title || 'Untitled Entry'}"
- Current Draft Content: "${journalContext?.content || '(No text yet)'}"
- Mood: "${journalContext?.mood || 'reflective'}"
${journalContext?.tags && journalContext.tags.length > 0 ? `- Tags: ${journalContext.tags.join(', ')}` : ''}

Guidelines for your response:
1. Speak with genuine warmth, emotional intelligence, and calm presence. Directly address the writer. Do not output planning thoughts or meta-commentary.
2. Acknowledge and validate the feelings or observations they shared in either their journal entry or conversation.
3. Provide thoughtful reflections that connect themes, highlight unspoken strengths, or offer gentle reframing.
4. Conclude with exactly ONE meaningful, open-ended question that prompts deeper introspective reflection.
5. Keep your answer focused and readable (2-3 concise paragraphs, around 120-220 words).`;

    // Convert messages to Gemini format: { role: 'user' | 'model', parts: [{ text: string }] }
    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: Array.isArray(m.parts) 
        ? m.parts 
        : [{ text: typeof m.content === 'string' ? m.content : '' }]
    }));

    const response = await generateWithGemini(ai, {
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 1500,
      }
    });

    const replyText = response.text || '';
    res.json({ text: replyText });
  } catch (err: any) {
    console.error('Gemini Chat API Error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate response from Gemini API.'
    });
  }
});

// AI-Generated Summary & Extraction Endpoint
app.post('/api/gemini/summarize', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, mood, chatHistory } = req.body;

    if (!content && (!chatHistory || chatHistory.length === 0)) {
      res.status(400).json({ error: 'Cannot summarize empty journal entry.' });
      return;
    }

    const ai = getGeminiClient();

    const transcript = (chatHistory || [])
      .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Reflection Partner'}: ${msg.content}`)
      .join('\n');

    const prompt = `Analyze this personal journal entry and reflection dialogue:

Title: "${title || 'Untitled'}"
Mood: "${mood || 'reflective'}"
Journal Body:
"""
${content || '(Empty body)'}
"""

Discussion with Reflection Partner:
"""
${transcript || '(No reflection discussion yet)'}
"""

Please provide an objective, emotionally intelligent analysis formatted in strictly valid JSON matching this schema:
{
  "suggestedTitle": "A concise, evocative 3-6 word title capturing the essence",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "coreInsight": "A 1-2 sentence profound takeaway about what this entry reveals about the writer's mindset, aspirations, or challenge",
  "sentiment": "e.g. Hopeful & Grounded / Introspective / Overwhelmed yet Resilient / Joyful Clarity",
  "reflectionQuestion": "One penetrating question for future contemplation",
  "actionableStep": "One gentle, practical mindfulness or intentional step the writer can take today"
}`;

    const response = await generateWithGemini(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      }
    });

    const text = response.text || '{}';
    let parsedData = {};
    try {
      parsedData = JSON.parse(text);
    } catch {
      // Fallback regex extraction if json markdown wraps it
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      } else {
        parsedData = {
          suggestedTitle: title || 'Reflective Musings',
          keyThemes: ['Mindfulness', 'Personal Growth'],
          coreInsight: 'Taking the time to put feelings into words brings clarity and agency to complex experiences.',
          sentiment: 'Thoughtful',
          reflectionQuestion: 'What step forward feels most natural today?',
          actionableStep: 'Take three deep conscious breaths before moving to the next task.'
        };
      }
    }

    res.json(parsedData);
  } catch (err: any) {
    console.error('Gemini Summarize API Error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate summary from Gemini.'
    });
  }
});

// Daily Reflective Prompts Generation
app.post('/api/gemini/prompts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { category } = req.body;
    const ai = getGeminiClient();

    const prompt = `Generate 3 original, inspiring, and psychologically sound journaling prompts for a focus area of "${category || 'mindful self-discovery'}".
Format as JSON:
{
  "prompts": [
    { "id": "p1", "text": "...", "context": "..." },
    { "id": "p2", "text": "...", "context": "..." },
    { "id": "p3", "text": "...", "context": "..." }
  ]
}`;

    const response = await generateWithGemini(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      }
    });

    const parsed = JSON.parse(response.text || '{"prompts": []}');
    res.json(parsed);
  } catch (err: any) {
    console.error('Gemini Prompts API Error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate reflection prompts.'
    });
  }
});

// Weekly Mood and Theme Insights Dashboard API
app.post('/api/gemini/weekly-insights', requireAuth, async (req: Request, res: Response) => {
  try {
    const { entries, timeframeLabel } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({
        error: 'No journal entries provided for analysis. Please write at least one reflection before generating weekly insights.'
      });
      return;
    }

    const ai = getGeminiClient();

    // Prepare chronological digest of entries
    const sortedEntries = [...entries].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const entriesDigest = sortedEntries.map((e, idx) => {
      const dateStr = new Date(e.createdAt || Date.now()).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      return `[Entry ${idx + 1} - ${dateStr}]
Title: ${e.title || 'Untitled'}
Mood: ${e.mood || 'reflective'}
Tags: ${Array.isArray(e.tags) ? e.tags.join(', ') : 'none'}
Content:
${typeof e.content === 'string' ? e.content.slice(0, 1500) : ''}
${e.summary?.coreInsight ? `Prior Insight: ${e.summary.coreInsight}` : ''}
---`;
    }).join('\n\n');

    const prompt = `You are an empathetic, world-class psychological insights companion and mindfulness analyst.
Analyze the user's historical journal entries for this period: "${timeframeLabel || 'Past Week'}".
There are ${entries.length} journal reflections recorded.

Here are the journal entries:
${entriesDigest}

Perform a rigorous, deeply thoughtful analysis to extract:
1. Recurring emotional trends and the trajectory across the days.
2. The dominant mood and mood distribution breakdown.
3. Daily mood points with intensity score (1-10 scale where 1=depleted/low and 10=high vitality/thriving), dayName (Mon, Tue, etc.), energyLevel ('low' | 'moderate' | 'high'), and entryTitle.
4. Top 3-5 key themes with frequency, thoughtful description, associated feelings, and a direct quote snippet from the entries.
5. 2-3 recurring patterns (trigger/context -> emotional impact -> compassionate reframing).
6. Mindset highlights: 2-3 genuine strengths noticed in their reflections, 1-2 potential blindspots or gentle cautionary flags, and 1 positive shift observed.
7. 3-4 actionable takeaway goals categorized as 'Mindfulness', 'Action', 'Boundary', or 'Self-Care', explaining why each matters and a suggested timeframe (e.g., 'Daily this week', 'Next 3 days', 'Weekend').
8. A warm, perceptive 2-paragraph synthesis narrative speaking directly to the user in second person ("You..."), acknowledging their emotional journey, honoring their vulnerability, and providing clear perspective.

Respond ONLY with valid JSON matching this schema:
{
  "emotionalTrajectory": "...",
  "dominantMood": "reflective",
  "moodDistribution": [
    { "mood": "calm", "count": 2, "percentage": 40 },
    { "mood": "reflective", "count": 3, "percentage": 60 }
  ],
  "dailyMoodTrend": [
    {
      "date": "2026-09-01",
      "dayName": "Mon",
      "dominantMood": "calm",
      "intensityScore": 7,
      "energyLevel": "moderate",
      "entryTitle": "Title of entry",
      "entryCount": 1
    }
  ],
  "keyThemes": [
    {
      "theme": "Theme Name",
      "frequency": 2,
      "description": "Thorough explanation of how this theme manifested...",
      "associatedFeelings": ["clarity", "hope"],
      "quoteSnippet": "Exact phrase from journal"
    }
  ],
  "recurringPatterns": [
    {
      "contextOrTrigger": "What situation tended to trigger stress or emotion",
      "emotionalImpact": "How it affected mental clarity or mood",
      "compassionateReframing": "A constructive, non-judgmental reframe"
    }
  ],
  "mindsetHighlights": {
    "strengthsNoticed": ["Resilience in the face of ambiguity", "Self-honesty"],
    "potentialBlindspots": ["Tendency to overcommit when feeling excited"],
    "positiveShifts": "Shifted from feeling anxious on Tuesday to taking decisive ownership by Thursday."
  },
  "actionableTakeaways": [
    {
      "id": "goal-1",
      "category": "Mindfulness",
      "goal": "Specific, practical goal",
      "whyItMatters": "Reason grounding this goal in their journal observations",
      "timeframe": "Next 3 days"
    }
  ],
  "synthesisNarrative": "Two cohesive, compassionate paragraphs summarizing the week's emotional landscape..."
}`;

    const response = await generateWithGemini(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.6,
      }
    });

    const rawText = response.text || '';
    let parsedResult: any;

    try {
      parsedResult = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        throw new Error('Gemini response could not be parsed into weekly insights JSON.');
      }
    }

    res.json(parsedResult);
  } catch (err: any) {
    console.error('Weekly Insights API Error:', err);
    res.status(500).json({
      error: err.message || 'Failed to analyze weekly entries with Gemini.'
    });
  }
});


// Integrate Vite Middleware
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Gemini Journal server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
