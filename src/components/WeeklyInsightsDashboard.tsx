import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Circle,
  HelpCircle,
  Clock,
  Compass,
  Tag,
  Quote,
  Lightbulb,
  Shield,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  BookOpen,
  ArrowRight,
  Flame
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  JournalEntry,
  UserProfile,
  WeeklyInsightReport,
  TimeframeFilter,
  MoodType,
  WeeklyActionableTakeaway
} from '../types';
import {
  saveWeeklyInsight,
  subscribeToWeeklyInsights,
  toggleTakeawayCompletion,
  deleteWeeklyInsight
} from '../services/insightService';
import { generateWeeklyInsights } from '../services/geminiClient';
import { getCurrentUserToken } from '../services/firebase';

interface WeeklyInsightsDashboardProps {
  user: UserProfile;
  entries: JournalEntry[];
  onNavigateToEditor: (entryId?: string) => void;
  onNewEntry: () => void;
}

const MOOD_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  reflective: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200' },
  calm: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', border: 'border-teal-200' },
  joyful: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  anxious: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', border: 'border-rose-200' },
  energized: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  grateful: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  tired: { bg: 'bg-stone-100', text: 'text-stone-700', dot: 'bg-stone-500', border: 'border-stone-300' },
};

const CATEGORY_STYLES: Record<string, { badge: string; border: string }> = {
  Mindfulness: { badge: 'bg-teal-100 text-teal-800', border: 'border-teal-200' },
  Action: { badge: 'bg-blue-100 text-blue-800', border: 'border-blue-200' },
  Boundary: { badge: 'bg-purple-100 text-purple-800', border: 'border-purple-200' },
  'Self-Care': { badge: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-200' },
};

export const WeeklyInsightsDashboard: React.FC<WeeklyInsightsDashboardProps> = ({
  user,
  entries,
  onNavigateToEditor,
  onNewEntry,
}) => {
  const [reports, setReports] = useState<WeeklyInsightReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('past_7_days');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // 1. Subscribe to real-time weekly reports from isolated Firestore path: users/{userId}/insights
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToWeeklyInsights(
      user.uid,
      (fetchedReports) => {
        setReports(fetchedReports);
        if (!selectedReportId && fetchedReports.length > 0) {
          setSelectedReportId(fetchedReports[0].id);
        }
      },
      (err) => {
        console.error('Error loading weekly insights from user partition:', err);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Filter entries based on the selected timeframe
  const now = Date.now();
  const filteredEntries = React.useMemo(() => {
    if (timeframe === 'past_7_days') {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      return entries.filter((e) => (e.createdAt || 0) >= sevenDaysAgo);
    }
    if (timeframe === 'past_14_days') {
      const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
      return entries.filter((e) => (e.createdAt || 0) >= fourteenDaysAgo);
    }
    return entries;
  }, [entries, timeframe, now]);

  // Current active report
  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  // Compute label for timeframe
  const timeframeLabel = React.useMemo(() => {
    const endStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (timeframe === 'past_7_days') {
      const startStr = new Date(now - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} – ${endStr} (Past 7 Days)`;
    }
    if (timeframe === 'past_14_days') {
      const startStr = new Date(now - 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} – ${endStr} (Past 14 Days)`;
    }
    return 'All Historical Reflections';
  }, [timeframe, now]);

  // Trigger on-demand analysis with Gemini
  const handleAnalyzeWithGemini = async () => {
    if (!user) return;
    if (filteredEntries.length === 0) {
      setAnalysisError('No journal reflections found in this timeframe. Write a reflection or select All Reflections.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);

      const token = await getCurrentUserToken(user);
      const generatedReport = await generateWeeklyInsights(filteredEntries, timeframeLabel, token);

      // Enforce strict user isolation before saving
      generatedReport.userId = user.uid;

      await saveWeeklyInsight(user.uid, generatedReport);
      setSelectedReportId(generatedReport.id);
    } catch (err: any) {
      console.error('Failed to run weekly analysis:', err);
      setAnalysisError(err.message || 'Analysis failed. Please check Gemini API key configuration.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle goal completion directly in Firestore partition
  const handleToggleTakeaway = async (takeaway: WeeklyActionableTakeaway) => {
    if (!user || !activeReport) return;
    try {
      const updated = await toggleTakeawayCompletion(user.uid, activeReport, takeaway.id);
      // Local state update
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      console.error('Failed to toggle takeaway goal in Firestore:', err);
    }
  };

  // Delete report
  const handleDeleteReport = async (reportId: string) => {
    if (!user) return;
    if (!window.confirm('Delete this weekly insight report?')) return;
    try {
      await deleteWeeklyInsight(user.uid, reportId);
      if (selectedReportId === reportId) {
        const remaining = reports.filter((r) => r.id !== reportId);
        setSelectedReportId(remaining[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  // Copy text summary to clipboard
  const handleCopySummary = () => {
    if (!activeReport) return;
    const text = `Weekly Mood & Theme Insights (${activeReport.periodLabel})
Dominant Mood: ${activeReport.dominantMood}
Entries Analyzed: ${activeReport.totalEntriesAnalyzed} (${activeReport.totalWordsAnalyzed} words)

Emotional Trajectory:
${activeReport.emotionalTrajectory}

Key Themes:
${activeReport.keyThemes.map((t) => `• ${t.theme} (${t.frequency}x): ${t.description}`).join('\n')}

Synthesis:
${activeReport.synthesisNarrative}

Actionable Goals:
${activeReport.actionableTakeaways.map((g) => `[${g.completed ? 'X' : ' '}] ${g.goal} (${g.category}) - ${g.timeframe}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pre-calculate stats
  const totalWordsInRange = filteredEntries.reduce(
    (acc, curr) => acc + (curr.wordCount || (curr.content ? curr.content.trim().split(/\s+/).length : 0)),
    0
  );

  const completedGoalsCount = activeReport?.actionableTakeaways.filter((t) => t.completed).length || 0;
  const totalGoalsCount = activeReport?.actionableTakeaways.length || 0;

  // Format daily trend data for Recharts
  const chartData = React.useMemo(() => {
    if (!activeReport || !activeReport.dailyMoodTrend || activeReport.dailyMoodTrend.length === 0) {
      return [];
    }
    return activeReport.dailyMoodTrend.map((point) => ({
      name: point.dayName || point.date,
      date: point.date,
      intensity: point.intensityScore || 5,
      mood: point.dominantMood || 'reflective',
      energy: point.energyLevel || 'moderate',
      title: point.entryTitle || 'Reflection',
    }));
  }, [activeReport]);

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/70 p-4 sm:p-6 lg:p-10 selection:bg-amber-100">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header & Range Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                AI-Powered Analytics
              </span>
              <span className="text-[11px] font-mono text-stone-500 flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-600" />
                users/{user.uid.slice(0, 8)}.../insights
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Weekly Mood & Theme Insights
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-xl">
              Synthesize recurring emotional trends, cognitive themes, and actionable takeaway goals from your journal entries.
            </p>
          </div>

          {/* Action & Generation Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="analyze-week-gemini-btn"
              onClick={handleAnalyzeWithGemini}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Gemini Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{activeReport ? 'Re-Analyze Past Week' : 'Analyze Past Week'}</span>
                </>
              )}
            </button>

            {activeReport && (
              <button
                id="copy-summary-btn"
                onClick={handleCopySummary}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
                title="Copy complete insight report to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                <span>{copied ? 'Copied!' : 'Export Summary'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Timeframe Selector & Quick Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Timeframe Pills */}
          <div className="md:col-span-4 bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
              Analysis Window
            </span>
            <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setTimeframe('past_7_days')}
                className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  timeframe === 'past_7_days'
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeframe('past_14_days')}
                className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  timeframe === 'past_14_days'
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                14 Days
              </button>
              <button
                onClick={() => setTimeframe('all_time')}
                className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  timeframe === 'all_time'
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All
              </button>
            </div>
            <div className="mt-2 text-[11px] text-stone-500 flex items-center justify-between">
              <span className="truncate">{timeframeLabel}</span>
              <span className="font-semibold text-stone-700">{filteredEntries.length} entries</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Reflections</span>
                <BookOpen className="w-3.5 h-3.5 text-stone-400" />
              </div>
              <p className="text-xl font-bold text-stone-900">
                {activeReport ? activeReport.totalEntriesAnalyzed : filteredEntries.length}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {activeReport ? `${activeReport.totalWordsAnalyzed} total words` : `${totalWordsInRange} words ready`}
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Dominant Mood</span>
                <Flame className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-stone-900 capitalize truncate">
                {activeReport ? activeReport.dominantMood : 'Pending'}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {activeReport ? `${activeReport.moodDistribution?.[0]?.percentage || 0}% prevalent` : 'Requires analysis'}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Weekly Goals</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-stone-900">
                {completedGoalsCount} / {totalGoalsCount}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {totalGoalsCount > 0 ? `${Math.round((completedGoalsCount / totalGoalsCount) * 100)}% achieved` : 'Extracted by AI'}
              </p>
            </div>
          </div>
        </div>

        {/* Error notification if any */}
        {analysisError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{analysisError}</span>
            </div>
            <button
              onClick={() => setAnalysisError(null)}
              className="text-xs font-semibold text-rose-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Saved Reports Dropdown History (if multiple exist) */}
        {reports.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-stone-500 shrink-0 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Report History:
            </span>
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReportId(r.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedReportId === r.id
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {new Date(r.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({r.periodLabel.slice(0, 14)}...)
              </button>
            ))}
          </div>
        )}

        {/* Main Dashboard Content */}
        {activeReport ? (
          <div className="space-y-6">
            {/* 1. Synthesis Narrative Banner */}
            <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/70 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900">
                    Weekly Emotional Trajectory
                  </h2>
                  <p className="text-xs text-stone-500 font-mono">
                    Generated {new Date(activeReport.generatedAt).toLocaleString()} • Isolated in Cloud Partition
                  </p>
                </div>
              </div>

              <div className="mt-3 text-xs sm:text-sm text-stone-700 leading-relaxed space-y-3 font-serif italic border-l-2 border-amber-300 pl-4">
                {activeReport.synthesisNarrative.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>

              {activeReport.emotionalTrajectory && (
                <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2 text-xs text-stone-600">
                  <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium text-stone-800">Arc:</span>
                  <span>{activeReport.emotionalTrajectory}</span>
                </div>
              )}
            </div>

            {/* 2. Visual Analytics Row: Daily Trend Chart + Mood Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Daily Trend Chart */}
              <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-stone-600" />
                      Daily Emotional Vitality & Mood Arc
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Day-by-day intensity trajectory (1 = Depleted, 10 = Thriving)
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-stone-400">Scale 1-10</span>
                </div>

                {chartData.length > 0 ? (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="vitalityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#78716c' }}
                          tickLine={false}
                          axisLine={{ stroke: '#e7e5e4' }}
                        />
                        <YAxis
                          domain={[1, 10]}
                          ticks={[2, 4, 6, 8, 10]}
                          tick={{ fontSize: 11, fill: '#78716c' }}
                          tickLine={false}
                          axisLine={{ stroke: '#e7e5e4' }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const moodStyle = MOOD_COLORS[data.mood] || MOOD_COLORS.reflective;
                              return (
                                <div className="bg-stone-900 text-stone-100 p-2.5 rounded-xl shadow-lg text-xs space-y-1 max-w-[200px]">
                                  <p className="font-semibold">{data.name} ({data.date})</p>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${moodStyle.dot}`} />
                                    <span className="capitalize">{data.mood}</span>
                                    <span className="text-stone-400">({data.energy} energy)</span>
                                  </div>
                                  <p className="text-[11px] text-amber-300 font-mono">Intensity: {data.intensity} / 10</p>
                                  {data.title && <p className="text-[10px] text-stone-300 italic truncate">"{data.title}"</p>}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="intensity"
                          stroke="#d97706"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#vitalityGradient)"
                          activeDot={{ r: 5, fill: '#b45309', stroke: '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-xs text-stone-400 bg-stone-50 rounded-2xl">
                    Trend data will chart once daily points are processed.
                  </div>
                )}
              </div>

              {/* Mood Distribution */}
              <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2 mb-1">
                    <Compass className="w-4 h-4 text-stone-600" />
                    Mood Breakdown & Frequency
                  </h3>
                  <p className="text-[11px] text-stone-500 mb-4">
                    Proportional emotional balance recorded across entries
                  </p>

                  {/* Multi-segmented distribution bar */}
                  <div className="h-3.5 w-full bg-stone-100 rounded-full overflow-hidden flex mb-4">
                    {activeReport.moodDistribution.map((item, idx) => {
                      const color = MOOD_COLORS[item.mood.toLowerCase()] || MOOD_COLORS.reflective;
                      return (
                        <div
                          key={idx}
                          title={`${item.mood}: ${item.percentage}%`}
                          style={{ width: `${item.percentage}%` }}
                          className={`${color.dot} h-full transition-all duration-500`}
                        />
                      );
                    })}
                  </div>

                  {/* Categorized badges */}
                  <div className="space-y-2.5">
                    {activeReport.moodDistribution.map((item, idx) => {
                      const style = MOOD_COLORS[item.mood.toLowerCase()] || MOOD_COLORS.reflective;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-stone-50/70 border border-stone-100 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                            <span className="font-medium capitalize text-stone-800">{item.mood}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px] text-stone-600">
                            <span>{item.count} {item.count === 1 ? 'reflection' : 'reflections'}</span>
                            <span className="font-semibold text-stone-900 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                              {item.percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
                  <span>Dominant: <strong className="capitalize text-stone-800">{activeReport.dominantMood}</strong></span>
                  <button
                    onClick={() => onNewEntry()}
                    className="text-stone-800 hover:text-stone-950 font-medium hover:underline cursor-pointer"
                  >
                    + Log New Mood
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Key Recurring Themes Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600" />
                    Key Recurring Themes
                  </h3>
                  <p className="text-xs text-stone-500">
                    Central topics and cognitive patterns extracted by Gemini from your writings
                  </p>
                </div>
                <span className="text-xs text-stone-500 font-mono">
                  {activeReport.keyThemes?.length || 0} Themes Extracted
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeReport.keyThemes.map((themeItem, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between hover:border-stone-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-serif text-base font-bold text-stone-900 truncate">
                          {themeItem.theme}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-100 text-stone-700 font-semibold shrink-0">
                          {themeItem.frequency}x noted
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed mb-3">
                        {themeItem.description}
                      </p>

                      {themeItem.quoteSnippet && (
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-[11px] text-stone-600 italic font-serif flex items-start gap-2 mb-3">
                          <Quote className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                          <span>"{themeItem.quoteSnippet}"</span>
                        </div>
                      )}
                    </div>

                    {themeItem.associatedFeelings && themeItem.associatedFeelings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-100">
                        {themeItem.associatedFeelings.map((feeling, fIdx) => (
                          <span
                            key={fIdx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 text-stone-600"
                          >
                            #{feeling}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Recurring Patterns & Cognitive Reframing */}
            {activeReport.recurringPatterns && activeReport.recurringPatterns.length > 0 && (
              <div className="space-y-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-teal-600" />
                    Observed Contexts & Compassionate Reframings
                  </h3>
                  <p className="text-xs text-stone-500">
                    Recognizing recurring emotional triggers and reframing them with non-judgmental presence
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeReport.recurringPatterns.map((pat, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3"
                    >
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                          Context / Situation
                        </span>
                        <p className="text-xs font-semibold text-stone-800 mt-0.5">
                          {pat.contextOrTrigger}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                        <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider">
                          Emotional Impact Noted
                        </span>
                        <p className="text-xs text-rose-900 mt-0.5">
                          {pat.emotionalImpact}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Compassionate Reframe
                        </span>
                        <p className="text-xs text-emerald-950 font-serif italic mt-0.5">
                          {pat.compassionateReframing}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Mindset Highlights: Strengths, Blindspots, & Evolution */}
            {activeReport.mindsetHighlights && (
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  Mindset Evolution & Growth Vectors
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Strengths */}
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                      Strengths Demonstrated
                    </span>
                    <ul className="space-y-1.5 text-xs text-emerald-950">
                      {activeReport.mindsetHighlights.strengthsNoticed.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Potential Blindspots */}
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                      Gentle Gentle Watchpoints
                    </span>
                    <ul className="space-y-1.5 text-xs text-amber-950">
                      {activeReport.mindsetHighlights.potentialBlindspots.map((b, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Positive Shift */}
                  <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                      Weekly Shift Observed
                    </span>
                    <p className="text-xs text-indigo-950 leading-relaxed font-serif italic">
                      "{activeReport.mindsetHighlights.positiveShifts}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Actionable Takeaway Goals (Interactive Checklist) */}
            <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Actionable Takeaway Goals
                  </h3>
                  <p className="text-xs text-stone-500">
                    Concrete, intentional practices suggested by Gemini based on your reflections. Click to complete.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-stone-100 text-stone-700">
                  {completedGoalsCount} of {totalGoalsCount} completed
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeReport.actionableTakeaways.map((goal) => {
                  const style = CATEGORY_STYLES[goal.category] || CATEGORY_STYLES.Mindfulness;
                  return (
                    <div
                      key={goal.id}
                      onClick={() => handleToggleTakeaway(goal)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                        goal.completed
                          ? 'bg-stone-50/80 border-stone-200 opacity-75'
                          : 'bg-white hover:bg-stone-50/60 border-stone-200 shadow-xs'
                      }`}
                    >
                      <button
                        className="mt-0.5 text-stone-400 hover:text-emerald-600 transition-colors"
                        aria-label="Toggle goal completion"
                      >
                        {goal.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-stone-300" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.badge}`}>
                            {goal.category}
                          </span>
                          <span className="text-[11px] font-mono text-stone-400">
                            {goal.timeframe}
                          </span>
                        </div>

                        <p
                          className={`text-xs font-semibold text-stone-800 ${
                            goal.completed ? 'line-through text-stone-500' : ''
                          }`}
                        >
                          {goal.goal}
                        </p>

                        <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                          {goal.whyItMatters}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-200 text-xs text-stone-500">
              <div className="flex items-center gap-2">
                <span>Secure Firestore Document:</span>
                <code className="bg-stone-100 px-2 py-0.5 rounded text-[11px] font-mono text-stone-700">
                  users/{user.uid}/insights/{activeReport.id}
                </code>
              </div>

              <button
                onClick={() => handleDeleteReport(activeReport.id)}
                className="flex items-center gap-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Delete this saved report"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Report</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty state when no report is generated yet for the timeframe */
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-stone-200 text-center space-y-6 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center shadow-xs">
              <TrendingUp className="w-7 h-7" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Ready to Analyze Your Weekly Insights
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                {filteredEntries.length > 0 ? (
                  <>
                    Found <strong>{filteredEntries.length} reflection{filteredEntries.length === 1 ? '' : 's'}</strong> in {timeframeLabel}.
                    Instruct Gemini to parse recurring emotional trends, key themes, and actionable takeaway goals.
                  </>
                ) : (
                  <>
                    No reflections found in the selected timeframe ({timeframeLabel}).
                    Write a reflection now or switch to "All" to analyze previous entries.
                  </>
                )}
              </p>
            </div>

            {filteredEntries.length > 0 ? (
              <div className="space-y-4">
                <button
                  id="generate-insights-empty-btn"
                  onClick={handleAnalyzeWithGemini}
                  disabled={isAnalyzing}
                  className="px-6 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white text-sm font-medium shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Gemini Analyzing {filteredEntries.length} Entries...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Generate Weekly Insights Dashboard</span>
                    </>
                  )}
                </button>

                {/* Preview of entries that will be analyzed */}
                <div className="max-w-md mx-auto pt-4 text-left border-t border-stone-100">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                    Included in this Analysis:
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {filteredEntries.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-stone-50 text-xs text-stone-700"
                      >
                        <span className="font-medium truncate max-w-[240px]">{e.title || 'Untitled Reflection'}</span>
                        <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-stone-500">
                          <span className="capitalize">{e.mood}</span>
                          <span>•</span>
                          <span>{new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => onNewEntry()}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-all cursor-pointer"
                >
                  + Write a Reflection
                </button>
                <button
                  onClick={() => setTimeframe('all_time')}
                  className="px-5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition-all cursor-pointer"
                >
                  View All Reflections
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
