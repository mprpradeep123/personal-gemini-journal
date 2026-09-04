import React from 'react';
import {
  Sparkles,
  Send,
  X,
  MessageSquare,
  HelpCircle,
  RefreshCw,
  Quote,
  Check,
} from 'lucide-react';
import { ChatMessage, JournalEntry, UserProfile } from '../types';
import { sendGeminiChatMessage } from '../services/geminiClient';
import { getCurrentUserToken } from '../services/firebase';

interface GeminiCompanionProps {
  entry: JournalEntry;
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdateChatHistory: (newHistory: ChatMessage[]) => void;
}

const REFLECTION_STARTERS = [
  'What is the unspoken feeling behind this?',
  'Help me reframe this setback with compassion',
  'What core value is being tested right now?',
  'What would my wisest future self advise me?',
];

export const GeminiCompanion: React.FC<GeminiCompanionProps> = ({
  entry,
  user,
  isOpen,
  onClose,
  onUpdateChatHistory,
}) => {
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [entry.chatHistory, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    setError(null);
    setInput('');

    const userMessage: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    const updatedHistory = [...entry.chatHistory, userMessage];
    onUpdateChatHistory(updatedHistory);
    setLoading(true);

    try {
      const token = await getCurrentUserToken(user);
      const reply = await sendGeminiChatMessage(
        updatedHistory,
        {
          title: entry.title,
          content: entry.content,
          mood: entry.mood,
          tags: entry.tags,
        },
        token
      );

      const aiMessage: ChatMessage = {
        id: 'msg_gemini_' + Date.now(),
        role: 'model',
        content: reply,
        timestamp: Date.now(),
      };

      onUpdateChatHistory([...updatedHistory, aiMessage]);
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      setError(err.message || 'Unable to connect to Gemini. Check your network or API status.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="w-full lg:w-96 xl:w-104 border-l border-stone-200/80 bg-stone-50/70 flex flex-col h-full shrink-0 shadow-lg lg:shadow-none z-20">
      {/* Header */}
      <div className="p-4 border-b border-stone-200/80 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-stone-900 leading-tight">
              Gemini Reflection Partner
            </h3>
            <p className="text-[10px] text-stone-500 font-mono">
              gemini-2.5-flash • Context Active
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          title="Close Partner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Intro Banner */}
        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-1.5 text-xs text-stone-700">
          <p className="font-semibold text-amber-900 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
            <span>Socratic Introspection</span>
          </p>
          <p className="text-[11px] leading-relaxed text-stone-600">
            I am reading along with your draft: <span className="font-medium text-stone-800 italic">"{entry.title || 'Untitled'}"</span>.
            Ask me to challenge an assumption, unpack an emotion, or explore what this entry means to you.
          </p>
        </div>

        {/* Conversation bubbles */}
        {entry.chatHistory.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs text-stone-500 max-w-[220px] mx-auto">
              Start a conversation with your reflection partner or select a thought-starter below.
            </p>
          </div>
        ) : (
          entry.chatHistory.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-stone-900 text-stone-50 rounded-br-xs shadow-xs'
                      : 'bg-white border border-stone-200/90 text-stone-800 rounded-bl-xs shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <span className="text-[9px] text-stone-400 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex items-start gap-2">
            <div className="p-3.5 rounded-2xl bg-white border border-stone-200 rounded-bl-xs shadow-xs flex items-center gap-2 text-xs text-stone-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Gemini is reflecting...</span>
            </div>
          </div>
        )}

        {/* Error Callout */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <p className="font-semibold">Reflection Error</p>
            <p className="text-[11px] mt-0.5">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Thought Starters Carousel */}
      <div className="px-3 pt-2 pb-1 border-t border-stone-200/60 bg-white/70">
        <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-1.5">
          Reflection Prompts
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          {REFLECTION_STARTERS.map((starter, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(starter)}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-stone-700 whitespace-nowrap transition-colors cursor-pointer border border-stone-200/60 disabled:opacity-50"
            >
              {starter}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="p-3 bg-white border-t border-stone-200">
        <div className="relative flex items-center">
          <textarea
            id="gemini-chat-input"
            rows={2}
            placeholder="Reflect with Gemini... (Press Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="w-full pl-3 pr-10 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white resize-none"
          />

          <button
            id="gemini-send-btn"
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            className="absolute right-2 p-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Send to Gemini"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-stone-400 text-center mt-1.5">
          Multi-turn chat logs automatically isolate into Firestore: <code className="text-stone-600 font-mono">users/{'{userId}'}/journals</code>
        </p>
      </div>
    </aside>
  );
};
