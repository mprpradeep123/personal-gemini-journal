import React from 'react';
import { Sparkles, Plus, Lightbulb, ShieldCheck, LogOut, Settings2, BookOpen, TrendingUp } from 'lucide-react';
import { UserProfile } from '../types';
import { signOutUser } from '../services/firebase';

interface NavbarProps {
  user: UserProfile;
  activeView: 'journal' | 'insights';
  onSelectView: (view: 'journal' | 'insights') => void;
  onNewEntry: () => void;
  onOpenPrompts: () => void;
  onOpenConfig: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onSelectView,
  onNewEntry,
  onOpenPrompts,
  onOpenConfig,
  onLogout,
}) => {
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      await signOutUser();
      onLogout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const truncatedUid = user.uid.length > 12 ? `${user.uid.slice(0, 8)}...` : user.uid;

  return (
    <header className="h-16 border-b border-stone-200/80 bg-white/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-amber-300 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-serif font-semibold text-stone-900 text-sm sm:text-base tracking-tight block leading-tight">
              Personal Gemini Journal
            </span>
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-stone-500 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Partition: users/{truncatedUid}</span>
            </div>
          </div>
        </div>

        {/* View Switcher: Journal vs Weekly Insights */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/70">
          <button
            id="nav-journal-tab"
            onClick={() => onSelectView('journal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeView === 'journal'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Journal</span>
          </button>

          <button
            id="nav-insights-tab"
            onClick={() => onSelectView('insights')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeView === 'insights'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
            <span>Weekly Insights</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* New Entry Button */}
        <button
          id="new-entry-btn"
          onClick={onNewEntry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs sm:text-sm font-medium transition-all shadow-xs active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Reflection</span>
          <span className="sm:hidden">New</span>
        </button>

        {/* Daily Prompts Button */}
        <button
          id="prompts-trigger-btn"
          onClick={onOpenPrompts}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
          title="Inspire with Gemini Journaling Prompts"
        >
          <Lightbulb className="w-4 h-4 text-amber-600" />
          <span className="hidden md:inline">Prompts</span>
        </button>


        {/* Cloud Config Status */}
        <button
          onClick={onOpenConfig}
          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Cloud Secret & Firestore Config"
        >
          <Settings2 className="w-4 h-4 text-stone-500" />
          <span className="hidden lg:inline">Config</span>
        </button>

        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-7 h-7 rounded-full object-cover border border-stone-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-medium text-xs">
              {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <div className="hidden xl:block text-left">
            <p className="text-xs font-medium text-stone-800 leading-tight">
              {user.displayName || 'User'}
            </p>
            <p className="text-[10px] text-stone-500 truncate max-w-[120px]">
              {user.email}
            </p>
          </div>

          <button
            id="sign-out-btn"
            onClick={handleSignOut}
            disabled={loggingOut}
            className="p-1.5 rounded-md text-stone-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
