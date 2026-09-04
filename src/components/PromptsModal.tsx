import React from 'react';
import { X, Sparkles, Lightbulb, ArrowRight, RefreshCw } from 'lucide-react';
import { fetchInspirationalPrompts, PromptOption } from '../services/geminiClient';
import { getCurrentUserToken } from '../services/firebase';
import { UserProfile } from '../types';

interface PromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string) => void;
  user: UserProfile;
}

const CATEGORIES = [
  'Gratitude & Grounding',
  'Overcoming Challenges & Resilience',
  'Values & Personal Growth',
  'Creative Brainstorming',
  'Relationships & Compassion',
];

export const PromptsModal: React.FC<PromptsModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
  user,
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState(CATEGORIES[0]);
  const [prompts, setPrompts] = React.useState<PromptOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadPrompts = async (category: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = await getCurrentUserToken(user);
      const data = await fetchInspirationalPrompts(category, token);
      setPrompts(data);
    } catch (err: any) {
      console.error('Failed to load prompts:', err);
      setError('Unable to fetch prompts from Gemini. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      loadPrompts(selectedCategory);
    }
  }, [isOpen, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-stone-900 text-base">
                Reflective Journaling Prompts
              </h3>
              <p className="text-[11px] text-stone-500">
                Curated dynamically by Gemini 2.5 Flash
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="p-3 border-b border-stone-100 bg-stone-50/60 overflow-x-auto flex gap-1.5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-stone-900 text-white font-medium shadow-2xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Prompts list */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-stone-500 font-medium">
                Gemini is crafting insightful questions...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center space-y-2">
              <p>{error}</p>
              <button
                onClick={() => loadPrompts(selectedCategory)}
                className="px-3 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 font-medium text-xs transition-colors"
              >
                Retry
              </button>
            </div>
          ) : prompts.length === 0 ? (
            <p className="text-center py-8 text-xs text-stone-400">
              No prompts available right now. Click refresh below.
            </p>
          ) : (
            prompts.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-4 rounded-xl border border-stone-200/80 bg-stone-50/40 hover:bg-white hover:border-stone-300 transition-all space-y-2 group text-left"
              >
                <p className="font-serif text-sm font-medium text-stone-900 leading-snug">
                  "{item.text}"
                </p>
                {item.context && (
                  <p className="text-xs text-stone-500 italic leading-relaxed">
                    {item.context}
                  </p>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      onSelectPrompt(item.text);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-amber-900 hover:text-amber-950 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200/60 transition-colors cursor-pointer"
                  >
                    <span>Write about this</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        <div className="p-3 border-t border-stone-100 bg-stone-50/60 flex items-center justify-between text-xs">
          <button
            onClick={() => loadPrompts(selectedCategory)}
            disabled={loading}
            className="flex items-center gap-1.5 text-stone-600 hover:text-stone-900 font-medium px-2 py-1 rounded hover:bg-stone-200/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerate Prompts</span>
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-100 font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
