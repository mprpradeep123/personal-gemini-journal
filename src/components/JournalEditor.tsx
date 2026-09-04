import React from 'react';
import {
  Sparkles,
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Menu,
  MessageSquare,
  X,
  Lightbulb,
} from 'lucide-react';
import { JournalEntry, MoodType } from '../types';

interface JournalEditorProps {
  entry: JournalEntry;
  onChange: (updated: JournalEntry) => void;
  onSummarize: () => void;
  onOpenPrompts: () => void;
  onToggleSidebar: () => void;
  onToggleCompanion: () => void;
  isCompanionOpen: boolean;
  isSummarizing: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved';
}

const MOODS: { type: MoodType; label: string; emoji: string }[] = [
  { type: 'reflective', label: 'Reflective', emoji: '🪞' },
  { type: 'calm', label: 'Calm', emoji: '🍃' },
  { type: 'grateful', label: 'Grateful', emoji: '✨' },
  { type: 'joyful', label: 'Joyful', emoji: '☀️' },
  { type: 'anxious', label: 'Anxious', emoji: '🌊' },
  { type: 'energized', label: 'Energized', emoji: '⚡' },
  { type: 'tired', label: 'Tired', emoji: '🌙' },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onChange,
  onSummarize,
  onOpenPrompts,
  onToggleSidebar,
  onToggleCompanion,
  isCompanionOpen,
  isSummarizing,
  saveStatus,
}) => {
  const [tagInput, setTagInput] = React.useState('');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...entry, title: e.target.value });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    onChange({ ...entry, content: text, wordCount: words });
  };

  const handleMoodSelect = (mood: MoodType) => {
    onChange({ ...entry, mood });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const sanitized = tagInput.trim().replace(/^#/, '').toLowerCase();
      if (sanitized && !entry.tags.includes(sanitized)) {
        onChange({ ...entry, tags: [...entry.tags, sanitized] });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange({ ...entry, tags: entry.tags.filter((t) => t !== tagToRemove) });
  };

  const wordCount = entry.wordCount || (entry.content.trim() ? entry.content.trim().split(/\s+/).length : 0);
  const readTimeMinutes = Math.ceil(wordCount / 200);

  const formattedDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Top action header */}
      <div className="border-b border-stone-200/70 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 bg-stone-50/50">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100"
            title="Open Archive"
          >
            <Menu className="w-4 h-4" />
          </button>

          <span className="text-xs text-stone-500 hidden sm:inline">{formattedDate}</span>

          {/* Auto-save badge */}
          <div className="flex items-center gap-1 text-[11px] text-stone-500 font-medium">
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Firestore Synced</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <div className="w-3 h-3 border-2 border-stone-300 border-t-amber-600 rounded-full animate-spin" />
                <span>Syncing...</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Unsaved changes</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Daily Prompt Inserter */}
          <button
            onClick={onOpenPrompts}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200/70 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
            title="Need inspiration? Generate reflective prompts."
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            <span>Inspire</span>
          </button>

          {/* AI Summarizer Button */}
          <button
            id="summarize-entry-btn"
            onClick={onSummarize}
            disabled={isSummarizing || !entry.content.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100/80 border border-amber-300 text-amber-900 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Extract themes, core insight, and reflection steps with Gemini"
          >
            {isSummarizing ? (
              <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            )}
            <span className="hidden sm:inline">AI Summary</span>
            <span className="sm:hidden">Summary</span>
          </button>

          {/* Toggle Gemini Companion Drawer */}
          <button
            id="toggle-gemini-companion-btn"
            onClick={onToggleCompanion}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isCompanionOpen
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Reflection Partner</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-6 sm:px-10 py-8 space-y-6">
        {/* Title Field */}
        <div>
          <input
            id="journal-title-input"
            type="text"
            placeholder="Title of this reflection..."
            value={entry.title}
            onChange={handleTitleChange}
            className="w-full text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-stone-900 placeholder:text-stone-300 focus:outline-none border-b border-transparent focus:border-stone-200 pb-2 transition-colors"
          />
        </div>

        {/* Mood Selector Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-2 border-b border-stone-100">
          <span className="text-xs font-medium text-stone-500 mr-1">Mood:</span>
          {MOODS.map((m) => {
            const isSelected = entry.mood === m.type;
            return (
              <button
                key={m.type}
                onClick={() => handleMoodSelect(m.type)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-white font-medium shadow-2xs scale-102'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Textarea Body */}
        <div className="relative">
          <textarea
            id="journal-body-textarea"
            rows={16}
            placeholder="Pour your thoughts freely here... What happened today? What did you feel? What gave you pause? Gemini will listen and reflect back with you."
            value={entry.content}
            onChange={handleContentChange}
            className="w-full text-base sm:text-lg leading-relaxed text-stone-800 placeholder:text-stone-300 focus:outline-none resize-none font-sans bg-transparent"
          />
        </div>

        {/* Tags Section */}
        <div className="pt-4 border-t border-stone-100 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-stone-400 mr-1" />
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-medium"
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-stone-400 hover:text-stone-700 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Add tag (press Enter)..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="px-2 py-0.5 text-xs text-stone-700 bg-transparent placeholder:text-stone-400 focus:outline-none min-w-[120px]"
            />
          </div>
        </div>

        {/* Word Count / Reading Stats */}
        <div className="pt-2 flex items-center justify-between text-xs text-stone-400 border-t border-stone-100">
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{readTimeMinutes} min read</span>
            </span>
          </div>

          <span className="text-[11px] font-mono">
            Auto-saves continuously to Cloud Firestore
          </span>
        </div>
      </div>
    </div>
  );
};
