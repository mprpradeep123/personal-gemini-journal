import React, { useState } from 'react';
import {
  ShieldCheck,
  LogIn,
  Sparkles,
  Lock,
  Database,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  signInWithGoogle,
  signInWithDemoUser,
  isFirebaseConfigured,
  getAuthDomainInfo,
  UnauthorizedDomainError,
} from '../services/firebase';

interface AuthGateProps {
  onLoginSuccess: (user: UserProfile) => void;
  onOpenConfig: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onLoginSuccess, onOpenConfig }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDetails, setUnauthorizedDetails] = useState<{
    domain: string;
    projectId: string;
    consoleUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const configured = isFirebaseConfigured();
  const domainInfo = getAuthDomainInfo();

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      setUnauthorizedDetails(null);
      const user = await signInWithGoogle();
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const isDomainError =
        err instanceof UnauthorizedDomainError ||
        err?.code === 'auth/unauthorized-domain' ||
        (typeof err?.message === 'string' && err.message.includes('auth/unauthorized-domain'));

      if (isDomainError) {
        setUnauthorizedDetails({
          domain: err?.domain || domainInfo.currentHostname || window.location.hostname,
          projectId: err?.projectId || domainInfo.projectId,
          consoleUrl: err?.consoleUrl || domainInfo.consoleUrl,
        });
        setError('The current domain is not yet authorized in Firebase Authentication.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    const demoUser = signInWithDemoUser();
    onLoginSuccess(demoUser);
  };

  const handleCopyDomain = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between selection:bg-amber-100 selection:text-stone-900">
      {/* Top minimal status bar */}
      <header className="w-full border-b border-stone-200/80 bg-white/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-amber-200">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-serif text-lg font-semibold tracking-tight text-stone-900">
            Personal Gemini Journal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-xs font-mono text-stone-600">
            <span className={`w-2 h-2 rounded-full ${configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{configured ? 'Firebase Live' : 'Firebase Ready'}</span>
          </div>
          <button
            onClick={onOpenConfig}
            className="text-xs font-medium text-stone-600 hover:text-stone-900 hover:underline px-2 py-1 cursor-pointer"
          >
            Cloud Config
          </button>
        </div>
      </header>

      {/* Main Hero / Authentication Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-xl bg-white border border-stone-200 rounded-2xl shadow-sm p-6 sm:p-10 space-y-6">
          
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Strict Data Isolation: users/{'{userId}'}/journals</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-stone-900 tracking-tight">
              A private haven for mindful reflection.
            </h1>
            <p className="text-stone-600 text-xs sm:text-sm md:text-base leading-relaxed max-w-md mx-auto">
              Engage in multi-turn dialogues with Gemini as your Socratic reflection partner, securely isolated within your personal partition.
            </p>
          </div>

          {/* Dedicated Unauthorized Domain Assistant */}
          {unauthorizedDetails && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 space-y-4 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-200/80 text-amber-900 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-800" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="font-serif font-semibold text-sm sm:text-base text-amber-950">
                    Firebase Domain Authorization Required
                  </h3>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Google OAuth popups require your Cloud Run preview domain to be registered under <strong>Authorized domains</strong> in your Firebase project (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{unauthorizedDetails.projectId}</code>).
                  </p>
                </div>
              </div>

              {/* Hostname display with copy button */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-medium text-amber-900">
                  <span>Domain to authorize:</span>
                  {copied && <span className="text-emerald-700 font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> Copied to clipboard!</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-stone-900 text-amber-200 px-3 py-2 rounded-xl font-mono text-xs select-all truncate border border-stone-800 shadow-inner">
                    {unauthorizedDetails.domain}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyDomain(unauthorizedDetails.domain)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-200 hover:bg-amber-300 active:bg-amber-400 text-amber-900 text-xs font-medium transition-colors cursor-pointer shrink-0"
                    title="Copy domain to clipboard"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy Domain'}</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="p-3 bg-white/80 rounded-xl border border-amber-200/80 text-xs space-y-2 text-stone-800">
                <p className="font-semibold text-stone-900 text-[11px] uppercase tracking-wider">
                  How to authorize in 30 seconds:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-stone-700 leading-relaxed text-[11px]">
                  <li>
                    Click the button below to open Firebase Console → <strong>Authentication</strong> → <strong>Settings</strong>.
                  </li>
                  <li>
                    Scroll down to <strong>Authorized domains</strong>, click <strong>Add domain</strong>, and paste the domain above.
                  </li>
                  <li>
                    Click <strong>Save</strong>, then return here and click <strong>Retry Google Sign-In</strong>.
                  </li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <a
                  href={unauthorizedDetails.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white font-medium text-xs transition-colors shadow-xs"
                >
                  <span>Open Firebase Console Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-stone-700 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Retry Google Sign-In</span>
                </button>
              </div>

              {/* Instant Sandbox Alternative */}
              <div className="pt-2 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] text-amber-900">
                  Need to start journaling immediately?
                </span>
                <button
                  type="button"
                  onClick={handleDemoSignIn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Launch Instant Sandbox Session</span>
                </button>
              </div>
            </div>
          )}

          {error && !unauthorizedDetails && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
              <p className="font-semibold">Authentication Notice</p>
              <p>{error}</p>
            </div>
          )}

          {/* Sign In CTAs */}
          {!unauthorizedDetails && (
            <div className="space-y-3 pt-2">
              <button
                id="google-signin-btn"
                onClick={handleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-stone-50 font-medium text-sm transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-stone-400 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.98 0 12s.45 3.84 1.24 5.42l4.04-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                    <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="flex-shrink mx-3 text-stone-400 text-[11px] uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              <button
                type="button"
                onClick={handleDemoSignIn}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 font-medium text-xs transition-colors border border-stone-200/80 cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-stone-600" />
                <span>Continue with Instant Sandbox Demo</span>
              </button>

              <p className="text-center text-xs text-stone-500 pt-1">
                Authentication initializes your encrypted user space partition.
              </p>
            </div>
          )}

          {/* Architectural Pillars */}
          <div className="pt-4 border-t border-stone-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-stone-800 text-xs font-semibold">
                <Database className="w-3.5 h-3.5 text-amber-700" />
                <span>Isolated Firestore</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Partitioned strictly at <code className="text-stone-800 font-mono">users/{'{userId}'}</code> with server rules.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-stone-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Gemini Flash</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Empathetic multi-turn dialogue with automated weekly mood and theme synthesis.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50/80 border border-stone-200/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-stone-800 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                <span>Zero-Trust API</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Protected behind validated Bearer tokens on every backend request.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-stone-200/60 py-4 px-6 text-center text-xs text-stone-500">
        Personal Gemini Journal • Full-stack Express & Vite with Cloud Firestore & Gemini API
      </footer>
    </div>
  );
};
