import React from 'react';
import { Sparkles, Lightbulb, Compass, HeartHandshake, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { JournalSummary } from '../types';

interface SummaryCardProps {
  summary: JournalSummary;
  onApplyTitle?: (title: string) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  summary,
  onApplyTitle,
  onRegenerate,
  isRegenerating,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [titleApplied, setTitleApplied] = React.useState(false);

  const handleApplyTitle = () => {
    if (summary.suggestedTitle && onApplyTitle) {
      onApplyTitle(summary.suggestedTitle);
      setTitleApplied(true);
      setTimeout(() => setTitleApplied(false), 2000);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-200/80 bg-linear-to-b from-amber-50/50 to-amber-50/20 p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-200/70 text-amber-900 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-amber-800" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-amber-950 uppercase tracking-wider">
              Gemini 2.5 Reflection Synthesis
            </h4>
            <span className="text-[10px] text-amber-800/80">
              Generated {new Date(summary.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary.suggestedTitle && onApplyTitle && (
            <button
              onClick={handleApplyTitle}
              className="text-xs px-2.5 py-1 rounded-md bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/50 font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              {titleApplied ? <Check className="w-3 h-3 text-emerald-600" /> : null}
              <span>{titleApplied ? 'Title Applied' : 'Use Title'}</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-amber-800 hover:bg-amber-100 transition-colors"
            title={isExpanded ? 'Collapse Synthesis' : 'Expand Synthesis'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-1 text-xs text-stone-800">
          {/* Suggested Title & Sentiment Header */}
          {summary.suggestedTitle && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white/70 border border-amber-200/50">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 block">
                  Suggested Title
                </span>
                <span className="font-serif font-semibold text-stone-900 text-sm">
                  "{summary.suggestedTitle}"
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/70 text-amber-900 font-medium text-[11px]">
                <HeartHandshake className="w-3 h-3 text-amber-700" />
                <span>{summary.sentiment}</span>
              </div>
            </div>
          )}

          {/* Core Insight Quote */}
          <div className="p-3.5 rounded-xl bg-white/90 border border-stone-200/80 space-y-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-800 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Core Takeaway
            </span>
            <p className="text-sm font-serif italic text-stone-800 leading-relaxed">
              "{summary.coreInsight}"
            </p>
          </div>

          {/* Two Columns: Reflection Question & Actionable Step */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/70 border border-stone-200/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1">
                <Compass className="w-3 h-3 text-indigo-600" />
                Contemplation Question
              </span>
              <p className="text-xs text-stone-700 leading-relaxed font-medium">
                {summary.reflectionQuestion}
              </p>
            </div>

            {summary.actionableStep && (
              <div className="p-3 rounded-xl bg-white/70 border border-stone-200/60 space-y-1">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Mindful Action Step
                </span>
                <p className="text-xs text-stone-700 leading-relaxed font-medium">
                  {summary.actionableStep}
                </p>
              </div>
            )}
          </div>

          {/* Key Themes tags */}
          {summary.keyThemes && summary.keyThemes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-stone-400 mr-1 font-medium">Identified Themes:</span>
              {summary.keyThemes.map((theme, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 text-[11px] font-medium"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
