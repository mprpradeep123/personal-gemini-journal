export type MoodType = 'reflective' | 'calm' | 'joyful' | 'anxious' | 'energized' | 'grateful' | 'tired';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface JournalSummary {
  keyThemes: string[];
  coreInsight: string;
  sentiment: string;
  reflectionQuestion: string;
  actionableStep?: string;
  generatedAt: number;
  suggestedTitle?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: MoodType;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  chatHistory: ChatMessage[];
  summary?: JournalSummary;
  pinned?: boolean;
  wordCount?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo?: boolean;
}

export interface GeminiChatRequest {
  messages: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  journalContext: {
    title: string;
    content: string;
    mood?: string;
    tags?: string[];
  };
}

export interface GeminiSummarizeRequest {
  title: string;
  content: string;
  mood?: string;
  chatHistory?: ChatMessage[];
}

export type TimeframeFilter = 'past_7_days' | 'past_14_days' | 'all_time';

export interface WeeklyDailyMoodPoint {
  date: string;
  dayName: string;
  dominantMood: MoodType | string;
  intensityScore: number; // 1 - 10
  energyLevel: 'low' | 'moderate' | 'high';
  entryTitle?: string;
  entryCount?: number;
}

export interface WeeklyMoodDistribution {
  mood: MoodType | string;
  count: number;
  percentage: number;
  color?: string;
}

export interface WeeklyTheme {
  theme: string;
  frequency: number;
  description: string;
  associatedFeelings: string[];
  quoteSnippet?: string;
}

export interface WeeklyPattern {
  contextOrTrigger: string;
  emotionalImpact: string;
  compassionateReframing: string;
}

export interface WeeklyActionableTakeaway {
  id: string;
  category: 'Mindfulness' | 'Action' | 'Boundary' | 'Self-Care';
  goal: string;
  whyItMatters: string;
  timeframe: string;
  completed?: boolean;
}

export interface WeeklyInsightReport {
  id: string;
  userId: string;
  generatedAt: number;
  periodLabel: string;
  startDate: number;
  endDate: number;
  totalEntriesAnalyzed: number;
  totalWordsAnalyzed: number;
  dominantMood: MoodType | string;
  emotionalTrajectory: string;
  moodDistribution: WeeklyMoodDistribution[];
  dailyMoodTrend: WeeklyDailyMoodPoint[];
  keyThemes: WeeklyTheme[];
  recurringPatterns: WeeklyPattern[];
  mindsetHighlights: {
    strengthsNoticed: string[];
    potentialBlindspots: string[];
    positiveShifts: string;
  };
  actionableTakeaways: WeeklyActionableTakeaway[];
  synthesisNarrative: string;
}
