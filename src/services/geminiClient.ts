import { ChatMessage, JournalSummary, JournalEntry, WeeklyInsightReport } from '../types';

export interface PromptOption {
  id: string;
  text: string;
  context: string;
}

export async function sendGeminiChatMessage(
  messages: ChatMessage[],
  journalContext: {
    title: string;
    content: string;
    mood?: string;
    tags?: string[];
  },
  token: string
): Promise<string> {
  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      journalContext,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with status ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}

export async function generateEntrySummary(
  title: string,
  content: string,
  mood: string,
  chatHistory: ChatMessage[],
  token: string
): Promise<JournalSummary> {
  const response = await fetch('/api/gemini/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      content,
      mood,
      chatHistory,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Summary request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    keyThemes: Array.isArray(data.keyThemes) ? data.keyThemes : ['Reflection', 'Growth'],
    coreInsight: data.coreInsight || 'Writing brings structure and clarity to emotional complexity.',
    sentiment: data.sentiment || 'Thoughtful & Centered',
    reflectionQuestion: data.reflectionQuestion || 'What part of this experience do you want to carry forward?',
    actionableStep: data.actionableStep || 'Take a moment to reflect on what you learned today.',
    suggestedTitle: data.suggestedTitle,
    generatedAt: Date.now(),
  };
}

export async function fetchInspirationalPrompts(
  category: string,
  token: string
): Promise<PromptOption[]> {
  const response = await fetch('/api/gemini/prompts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ category }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch prompts: ${response.status}`);
  }

  const data = await response.json();
  return data.prompts || [];
}

export async function generateWeeklyInsights(
  entries: JournalEntry[],
  timeframeLabel: string,
  token: string
): Promise<WeeklyInsightReport> {
  const response = await fetch('/api/gemini/weekly-insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      entries: entries.map((e) => ({
        id: e.id,
        title: e.title,
        content: e.content,
        mood: e.mood,
        tags: e.tags,
        createdAt: e.createdAt,
        wordCount: e.wordCount,
        summary: e.summary,
      })),
      timeframeLabel,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Weekly insights analysis failed: ${response.status}`);
  }

  const data = await response.json();

  const now = Date.now();
  const sortedDates = entries.map((e) => e.createdAt || now).sort((a, b) => a - b);
  const startDate = sortedDates[0] || (now - 7 * 86400000);
  const endDate = sortedDates[sortedDates.length - 1] || now;

  const totalWords = entries.reduce((acc, curr) => acc + (curr.wordCount || (curr.content ? curr.content.trim().split(/\s+/).length : 0)), 0);

  const report: WeeklyInsightReport = {
    id: 'insight_' + now + '_' + Math.random().toString(36).substring(2, 7),
    userId: entries[0]?.userId || '',
    generatedAt: now,
    periodLabel: timeframeLabel,
    startDate,
    endDate,
    totalEntriesAnalyzed: entries.length,
    totalWordsAnalyzed: totalWords,
    dominantMood: data.dominantMood || 'reflective',
    emotionalTrajectory: data.emotionalTrajectory || 'Your reflections reveal a thoughtful progression through moments of vulnerability and mindful presence.',
    moodDistribution: Array.isArray(data.moodDistribution) ? data.moodDistribution : [],
    dailyMoodTrend: Array.isArray(data.dailyMoodTrend) ? data.dailyMoodTrend : [],
    keyThemes: Array.isArray(data.keyThemes) ? data.keyThemes : [],
    recurringPatterns: Array.isArray(data.recurringPatterns) ? data.recurringPatterns : [],
    mindsetHighlights: data.mindsetHighlights || {
      strengthsNoticed: ['Consistent habit of self-inquiry', 'Honesty with difficult feelings'],
      potentialBlindspots: ['Underestimating the power of micro-rests'],
      positiveShifts: 'Moving toward greater self-acceptance',
    },
    actionableTakeaways: Array.isArray(data.actionableTakeaways) ? data.actionableTakeaways : [],
    synthesisNarrative: data.synthesisNarrative || 'This week demonstrated an earnest commitment to exploring thoughts with depth and equanimity.',
  };

  return report;
}

