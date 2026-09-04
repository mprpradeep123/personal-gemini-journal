import React from 'react';
import { Search, Pin, Trash2, Calendar, Sparkles, Filter } from 'lucide-react';
import { JournalEntry, MoodType } from '../types';

interface JournalSidebarProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  onTogglePin: (entry: JournalEntry, e: React.MouseEvent) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

const MOOD_FILTERS: { label: string; value: MoodType | 'all'; color: string }[] = [
  { label: 'All', value: 'all', color: 'bg-stone-200 text-stone-800' },
  { label: 'Reflective', value: 'reflective', color: 'bg-indigo-100 text-indigo-800' },
  { label: 'Calm', value: 'calm', color: 'bg-teal-100 text-teal-800' },
  { label: 'Grateful', value: 'grateful', color: 'bg-amber-100 text-amber-800' },
  { label: 'Joyful', value: 'joyful', color: 'bg-emerald-100 text-emerald-800' },
  { label: 'Anxious', value: 'anxious', color: 'bg-rose-100 text-rose-800' },
  { label: 'Energized', value: 'energized', color: 'bg-orange-100 text-orange-800' },
];

export const JournalSidebar: React.FC<JournalSidebarProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onDeleteEntry,
  onTogglePin,
  isOpen,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedMood, setSelectedMood] = React.useState<MoodType | 'all'>('all');

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.tags && entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;

    return matchesSearch && matchesMood;
  });

  // Sort pinned entries to top, then by updatedAt desc
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const formatRelativeTime = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-30 w-80 md:w-88 bg-stone-50 border-r border-stone-200/80 flex flex-col transition-transform duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Search Header */}
      <div className="p-4 border-b border-stone-200/70 space-y-3 bg-white/60">
        <div className="flex items-center justify-between lg:hidden pb-1">
          <span className="font-serif font-semibold text-sm text-stone-800">Your Journal Archive</span>
          <button
            onClick={onCloseMobile}
            className="text-stone-400 hover:text-stone-700 text-xs px-2 py-1"
          >
            Close
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search reflections, tags, or insights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white transition-all"
          />
        </div>

        {/* Mood filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          {MOOD_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSelectedMood(f.value)}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                selectedMood === f.value
                  ? 'bg-stone-900 text-white font-medium shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedEntries.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2">
            <p className="text-xs font-medium text-stone-500">No reflections found</p>
            <p className="text-[11px] text-stone-400 max-w-[200px] mx-auto">
              {searchQuery ? 'Try adjusting your search terms or mood filters.' : 'Click "New Reflection" to write your first entry.'}
            </p>
          </div>
        ) : (
          sortedEntries.map((entry) => {
            const isActive = entry.id === activeEntryId;
            return (
              <div
                key={entry.id}
                onClick={() => {
                  onSelectEntry(entry);
                  onCloseMobile();
                }}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-white border-stone-400/80 shadow-xs ring-1 ring-stone-900/5'
                    : 'bg-white/70 border-stone-200 hover:bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`text-xs font-semibold line-clamp-1 ${isActive ? 'text-stone-900' : 'text-stone-800'}`}>
                    {entry.title || 'Untitled Reflection'}
                  </h3>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={(e) => onTogglePin(entry, e)}
                      title={entry.pinned ? 'Unpin' : 'Pin to top'}
                      className={`p-1 rounded hover:bg-stone-100 transition-colors ${
                        entry.pinned ? 'text-amber-700' : 'text-stone-400 hover:text-stone-700'
                      }`}
                    >
                      <Pin className="w-3 h-3 fill-current" />
                    </button>
                    <button
                      onClick={(e) => onDeleteEntry(entry.id, e)}
                      title="Delete reflection"
                      className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="mt-1 text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                  {entry.content || 'Blank entry...'}
                </p>

                <div className="mt-2.5 flex items-center justify-between text-[10px] text-stone-400">
                  <div className="flex items-center gap-2">
                    <span className="capitalize px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                      {entry.mood}
                    </span>
                    {entry.summary && (
                      <span className="flex items-center gap-0.5 text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Insight</span>
                      </span>
                    )}
                  </div>
                  <span>{formatRelativeTime(entry.updatedAt || entry.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer count */}
      <div className="p-3 border-t border-stone-200/70 bg-white/40 text-[11px] text-stone-500 text-center">
        {entries.length} {entries.length === 1 ? 'reflection' : 'reflections'} stored in Cloud Firestore
      </div>
    </aside>
  );
};
