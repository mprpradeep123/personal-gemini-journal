import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, X as CloseIcon } from 'lucide-react';
import { UserProfile, JournalEntry, MoodType, ChatMessage, JournalSummary } from './types';
import { subscribeToAuthChanges, getCurrentUserToken, subscribeToFirestorePermissionChanges } from './services/firebase';
import { subscribeToJournals, saveJournal, deleteJournal } from './services/journalService';
import { generateEntrySummary } from './services/geminiClient';
import { AuthGate } from './components/AuthGate';
import { Navbar } from './components/Navbar';
import { JournalSidebar } from './components/JournalSidebar';
import { JournalEditor } from './components/JournalEditor';
import { GeminiCompanion } from './components/GeminiCompanion';
import { SummaryCard } from './components/SummaryCard';
import { PromptsModal } from './components/PromptsModal';
import { CloudConfigModal } from './components/CloudConfigModal';
import { WeeklyInsightsDashboard } from './components/WeeklyInsightsDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // View state: 'journal' or 'insights'
  const [activeView, setActiveView] = useState<'journal' | 'insights'>('journal');

  // Journal Entries state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCompanionOpen, setIsCompanionOpen] = useState(true);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [hasPermissionDenied, setHasPermissionDenied] = useState(false);
  const [isDismissedNotice, setIsDismissedNotice] = useState(false);

  // Debounce save ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to Firestore permission status
  useEffect(() => {
    const unsub = subscribeToFirestorePermissionChanges((denied) => {
      setHasPermissionDenied(denied);
    });
    return () => unsub();
  }, []);

  // 1. Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to user-partitioned Firestore journals: users/{userId}/journals
  useEffect(() => {
    if (!currentUser) {
      setEntries([]);
      setActiveEntryId(null);
      setActiveEntry(null);
      return;
    }

    const unsubscribe = subscribeToJournals(
      currentUser.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);

        // If no active entry selected yet, select the first or create a default one
        if (!activeEntryId && fetchedEntries.length > 0) {
          setActiveEntryId(fetchedEntries[0].id);
          setActiveEntry(fetchedEntries[0]);
        }
      },
      (err) => {
        console.error('Subscription error to partitioned storage:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Keep activeEntry synchronized when entries change from Firestore
  useEffect(() => {
    if (activeEntryId && entries.length > 0) {
      const match = entries.find((e) => e.id === activeEntryId);
      if (match && !saveTimeoutRef.current) {
        setActiveEntry(match);
      }
    }
  }, [entries, activeEntryId]);

  // Handle entry creation
  const handleCreateNewEntry = (initialText?: string, initialTitle?: string) => {
    if (!currentUser) return;

    const newId = 'journal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newEntry: JournalEntry = {
      id: newId,
      userId: currentUser.uid,
      title: initialTitle || '',
      content: initialText || '',
      mood: 'reflective',
      tags: ['reflection'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatHistory: [],
      wordCount: initialText ? initialText.trim().split(/\s+/).length : 0,
    };

    setActiveEntryId(newId);
    setActiveEntry(newEntry);
    saveJournal(currentUser.uid, newEntry);
  };

  // Debounced auto-save to Cloud Firestore
  const handleEditorChange = (updated: JournalEntry) => {
    setActiveEntry(updated);
    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (currentUser && updated) {
        setSaveStatus('saving');
        try {
          await saveJournal(currentUser.uid, updated);
          setSaveStatus('saved');
        } catch (err) {
          console.error('Failed to auto-save to Firestore partition:', err);
          setSaveStatus('unsaved');
        } finally {
          saveTimeoutRef.current = null;
        }
      }
    }, 800);
  };

  // Delete an entry
  const handleDeleteEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    if (!window.confirm('Are you sure you want to delete this reflection?')) return;

    try {
      await deleteJournal(currentUser.uid, id);
      if (activeEntryId === id) {
        const remaining = entries.filter((item) => item.id !== id);
        if (remaining.length > 0) {
          setActiveEntryId(remaining[0].id);
          setActiveEntry(remaining[0]);
        } else {
          setActiveEntryId(null);
          setActiveEntry(null);
        }
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (entry: JournalEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    const updated = { ...entry, pinned: !entry.pinned };
    await saveJournal(currentUser.uid, updated);
  };

  // AI Summarization with Gemini
  const handleSummarizeEntry = async () => {
    if (!currentUser || !activeEntry) return;

    try {
      setIsSummarizing(true);
      const token = await getCurrentUserToken(currentUser);
      const summaryResult = await generateEntrySummary(
        activeEntry.title,
        activeEntry.content,
        activeEntry.mood,
        activeEntry.chatHistory,
        token
      );

      const updated: JournalEntry = {
        ...activeEntry,
        summary: summaryResult,
        updatedAt: Date.now(),
      };

      setActiveEntry(updated);
      await saveJournal(currentUser.uid, updated);
    } catch (err: any) {
      console.error('Summarize error:', err);
      alert(err.message || 'Failed to generate AI summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Update chat history from Gemini companion
  const handleUpdateChatHistory = async (newHistory: ChatMessage[]) => {
    if (!currentUser || !activeEntry) return;

    const updated: JournalEntry = {
      ...activeEntry,
      chatHistory: newHistory,
      updatedAt: Date.now(),
    };

    setActiveEntry(updated);
    // Persist immediately to isolated Firestore
    await saveJournal(currentUser.uid, updated);
  };

  // Apply suggested title from AI summary
  const handleApplyTitle = (newTitle: string) => {
    if (!activeEntry || !currentUser) return;
    const updated = { ...activeEntry, title: newTitle };
    handleEditorChange(updated);
  };

  // Inserter for prompts modal
  const handleSelectPrompt = (promptText: string) => {
    if (!activeEntry) {
      handleCreateNewEntry(`Prompt:\n"${promptText}"\n\n`, 'Contemplation on ' + new Date().toLocaleDateString());
    } else {
      const addition = activeEntry.content
        ? `${activeEntry.content}\n\nReflection Prompt:\n"${promptText}"\n\n`
        : `Reflection Prompt:\n"${promptText}"\n\n`;
      handleEditorChange({ ...activeEntry, content: addition });
    }
  };

  // Initial loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          <p className="text-xs font-serif tracking-wide">Initializing Personal Gemini Journal...</p>
        </div>
      </div>
    );
  }

  // Mandatory Authentication Gate: UI must require authentication before exposing any journaling dashboard
  if (!currentUser) {
    return (
      <>
        <AuthGate
          onLoginSuccess={(user) => setCurrentUser(user)}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
        <CloudConfigModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          currentUser={currentUser}
        />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white text-stone-900 font-sans antialiased overflow-hidden selection:bg-amber-100">
      {/* Top Navigation */}
      <Navbar
        user={currentUser}
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        onNewEntry={() => {
          handleCreateNewEntry();
          setActiveView('journal');
        }}
        onOpenPrompts={() => setIsPromptsOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
        onLogout={() => setCurrentUser(null)}
      />

      {/* Non-blocking Firestore Security Rules Notice */}
      {hasPermissionDenied && !isDismissedNotice && (
        <div className="bg-amber-50 border-b border-amber-200/90 px-4 py-2 flex items-center justify-between text-xs text-amber-950 shrink-0 z-20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="truncate">
              <strong>Cloud Firestore Sync:</strong> Security rules in Firebase Console require publishing. Your reflections are safely isolated &amp; saved locally.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => setIsConfigOpen(true)}
              className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-medium rounded transition-colors cursor-pointer"
            >
              Fix Rules &amp; Sync
            </button>
            <button
              onClick={() => setIsDismissedNotice(true)}
              className="p-1 text-amber-700 hover:text-amber-950 rounded cursor-pointer"
              title="Dismiss warning"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main App Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeView === 'insights' ? (
          <WeeklyInsightsDashboard
            user={currentUser}
            entries={entries}
            onNavigateToEditor={(id) => {
              if (id) {
                setActiveEntryId(id);
              }
              setActiveView('journal');
            }}
            onNewEntry={() => {
              handleCreateNewEntry();
              setActiveView('journal');
            }}
          />
        ) : (
          <>
            {/* Archive Sidebar */}
            <JournalSidebar
              entries={entries}
              activeEntryId={activeEntryId}
              onSelectEntry={(entry) => {
                setActiveEntryId(entry.id);
                setActiveEntry(entry);
              }}
              onDeleteEntry={handleDeleteEntry}
              onTogglePin={handleTogglePin}
              isOpen={isSidebarOpen}
              onCloseMobile={() => setIsSidebarOpen(false)}
            />

            {/* Center / Primary Writing Space */}
            {activeEntry ? (
              <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Display AI Summary banner if available */}
                {activeEntry.summary && (
                  <div className="px-6 sm:px-10 pt-4 max-w-3xl w-full mx-auto">
                    <SummaryCard
                      summary={activeEntry.summary}
                      onApplyTitle={handleApplyTitle}
                      onRegenerate={handleSummarizeEntry}
                      isRegenerating={isSummarizing}
                    />
                  </div>
                )}

                <JournalEditor
                  entry={activeEntry}
                  onChange={handleEditorChange}
                  onSummarize={handleSummarizeEntry}
                  onOpenPrompts={() => setIsPromptsOpen(true)}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  onToggleCompanion={() => setIsCompanionOpen(!isCompanionOpen)}
                  isCompanionOpen={isCompanionOpen}
                  isSummarizing={isSummarizing}
                  saveStatus={saveStatus}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 bg-stone-50/50">
                <div className="text-center max-w-md space-y-4">
                  <h3 className="font-serif text-2xl font-semibold text-stone-800">
                    Begin your reflection
                  </h3>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Take a quiet moment to write down what is on your mind. Gemini will join you as an introspective reflection partner.
                  </p>
                  <button
                    onClick={() => handleCreateNewEntry()}
                    className="px-5 py-2.5 rounded-xl bg-stone-900 text-stone-50 font-medium text-xs hover:bg-stone-800 transition-all shadow-xs cursor-pointer"
                  >
                    + Write First Reflection
                  </button>
                </div>
              </div>
            )}

            {/* Right Socratic Reflection Partner (Multi-Turn Gemini Companion) */}
            {activeEntry && (
              <GeminiCompanion
                entry={activeEntry}
                user={currentUser}
                isOpen={isCompanionOpen}
                onClose={() => setIsCompanionOpen(false)}
                onUpdateChatHistory={handleUpdateChatHistory}
              />
            )}
          </>
        )}
      </div>

      {/* Daily Reflective Prompts Modal */}
      <PromptsModal
        isOpen={isPromptsOpen}
        onClose={() => setIsPromptsOpen(false)}
        onSelectPrompt={handleSelectPrompt}
        user={currentUser}
      />

      {/* Cloud Secrets & Data Isolation Diagnostics Modal */}
      <CloudConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
