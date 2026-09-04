import React from 'react';
import {
  X,
  ShieldCheck,
  Database,
  Key,
  CheckCircle2,
  AlertCircle,
  Save,
  ExternalLink,
  Copy,
  Check,
  Globe,
  AlertTriangle,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import {
  getFirebaseConfig,
  saveCustomFirebaseConfig,
  isFirebaseConfigured,
  getAuthDomainInfo,
  getFirestoreRulesInfo,
  hasFirestorePermissionError,
  testAndVerifyFirestoreConnection,
  FirebaseConfigParams,
} from '../services/firebase';
import { syncLocalEntriesToFirestore } from '../services/journalService';
import { UserProfile } from '../types';

interface CloudConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
}

export const CloudConfigModal: React.FC<CloudConfigModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [geminiStatus, setGeminiStatus] = React.useState<{
    geminiConfigured: boolean;
    environment: string;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = React.useState(false);
  const [copiedRules, setCopiedRules] = React.useState(false);

  const [testingRules, setTestingRules] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  const [customConfig, setCustomConfig] = React.useState<FirebaseConfigParams>({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  });

  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const liveConfig = getFirebaseConfig();
  const configured = isFirebaseConfigured();
  const authDomainInfo = getAuthDomainInfo();
  const rulesInfo = getFirestoreRulesInfo();
  const permissionDenied = hasFirestorePermissionError();

  React.useEffect(() => {
    if (isOpen) {
      // Fetch health and secret status from Express server
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setGeminiStatus(data))
        .catch((err) => console.error('Health check failed:', err));

      if (liveConfig) {
        setCustomConfig(liveConfig);
      }
    }
  }, [isOpen]);

  const handleTestRules = async () => {
    if (!currentUser) {
      setTestResult({ success: false, message: 'Please sign in with your account to verify partitioned rules.' });
      return;
    }
    setTestingRules(true);
    setTestResult(null);
    try {
      const isReady = await testAndVerifyFirestoreConnection(currentUser.uid);
      if (isReady) {
        const syncedCount = await syncLocalEntriesToFirestore(currentUser.uid);
        setTestResult({
          success: true,
          message: `Success! Cloud Firestore rules are active. ${syncedCount > 0 ? `Synced ${syncedCount} local entries to cloud.` : 'Zero errors detected.'}`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Permission denied. Did you paste the rules and click "Publish" in Firebase Console?`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed.',
      });
    } finally {
      setTestingRules(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customConfig.apiKey.trim() || !customConfig.projectId.trim()) {
      saveCustomFirebaseConfig(null);
    } else {
      saveCustomFirebaseConfig({
        ...customConfig,
        apiKey: customConfig.apiKey.trim(),
        projectId: customConfig.projectId.trim(),
        authDomain: customConfig.authDomain.trim() || `${customConfig.projectId.trim()}.firebaseapp.com`,
        appId: customConfig.appId.trim(),
      });
    }
    setSavedSuccess(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-stone-900 text-base">
                Cloud Security & Architecture
              </h3>
              <p className="text-[11px] text-stone-500">
                Zero-Trust Secrets & Data Isolation Verification
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs text-stone-700">
          {/* Section 1: Server & Secret Diagnostics */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-stone-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Key className="w-3.5 h-3.5 text-amber-700" />
              <span>Environment & Secret Manager</span>
            </h4>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Gemini 2.5 API Key (Server-Side):</span>
                {geminiStatus?.geminiConfigured ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Injected & Ready</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    <span>Using Runtime Fallback</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-600">Backend Server Runtime:</span>
                <span className="font-mono text-stone-800 bg-stone-200/60 px-1.5 py-0.5 rounded">
                  Node.js / Express (Port 3000)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-600">Firebase Firestore Status:</span>
                <span className="inline-flex items-center gap-1 font-medium text-stone-800">
                  {configured ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Live Firestore Connected
                    </span>
                  ) : (
                    <span className="text-stone-600">Local Partition Sandbox (Ready for Env Vars)</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Data Isolation Architecture */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-stone-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <Database className="w-3.5 h-3.5 text-amber-700" />
              <span>Cloud Firestore Isolation Path</span>
            </h4>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2 text-stone-600">
              <p>
                Every user's journal entries, multi-turn chat logs, and generated reflections are partitioned under:
              </p>
              <div className="p-2 rounded-lg bg-stone-900 text-amber-200 font-mono text-[11px] select-all">
                users/{'{userId}'}/journals/{'{journalId}'}
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Rules enforced by <code className="font-mono text-stone-700">firestore.rules</code> guarantee <code className="font-mono text-stone-700">request.auth.uid == userId</code>, preventing cross-user data leakage.
              </p>
            </div>
          </div>

          {/* Section 3: Firebase Authorized Domains Checklist */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-stone-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-amber-700" />
                <span>Authorized Domains (Google Sign-In)</span>
              </h4>
              <a
                href={authDomainInfo.consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-800 hover:text-amber-950 flex items-center gap-1 font-medium"
              >
                <span>Console Settings</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-stone-700 text-xs space-y-2.5">
              <p className="text-[11px] text-stone-600 leading-relaxed">
                To prevent <code className="font-mono text-amber-900 bg-amber-100/80 px-1 py-0.5 rounded">auth/unauthorized-domain</code>, register this preview domain in Firebase Console under <strong>Authentication → Settings → Authorized domains</strong>:
              </p>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-stone-900 text-amber-200 px-3 py-1.5 rounded-lg font-mono text-[11px] select-all truncate border border-stone-800">
                  {authDomainInfo.currentHostname || window.location.hostname}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(authDomainInfo.currentHostname || window.location.hostname);
                    setCopiedDomain(true);
                    setTimeout(() => setCopiedDomain(false), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-800" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Firestore Security Rules Setup & Diagnostics */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-stone-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <FileCode className="w-3.5 h-3.5 text-amber-700" />
                <span>Firestore Security Rules (Permission Fix)</span>
              </h4>
              <a
                href={rulesInfo.rulesConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-800 hover:text-amber-950 flex items-center gap-1 font-medium"
              >
                <span>Console Rules Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs space-y-3 ${
              permissionDenied
                ? 'bg-red-50/70 border-red-200 text-red-950'
                : 'bg-stone-50 border-stone-200/80 text-stone-700'
            }`}>
              <div className="flex items-start gap-2">
                {permissionDenied ? (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-xs">
                    {permissionDenied
                      ? 'Action Required: Firestore "Missing or insufficient permissions"'
                      : 'Firestore Rules Specification'}
                  </p>
                  <p className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
                    By default, new Firestore databases block all reads and writes. To enable authenticated user partition access, copy the rules below and click <strong>Publish</strong> in your Firebase Console:
                  </p>
                </div>
              </div>

              {/* Rules Code Container */}
              <div className="relative">
                <pre className="p-3 rounded-lg bg-stone-900 text-amber-200 font-mono text-[10px] sm:text-[11px] overflow-x-auto leading-relaxed max-h-40 border border-stone-800 selection:bg-amber-900">
                  {rulesInfo.rulesContent}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rulesInfo.rulesContent);
                    setCopiedRules(true);
                    setTimeout(() => setCopiedRules(false), 2000);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-200 text-[11px] flex items-center gap-1 border border-stone-700 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedRules ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRules ? 'Copied' : 'Copy Rules'}</span>
                </button>
              </div>

              {/* Verify & Sync Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-stone-500">
                  {testResult && (
                    <span className={testResult.success ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                      {testResult.message}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleTestRules}
                  disabled={testingRules}
                  className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingRules ? 'animate-spin' : ''}`} />
                  <span>{testingRules ? 'Verifying Partition...' : 'Test & Sync Firestore'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Optional Custom Firebase Web App Config */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-stone-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <span>Firebase Web Client Credentials</span>
              </h4>
              <span className="text-[10px] text-stone-400">Optional / Dynamic</span>
            </div>

            <p className="text-[11px] text-stone-500">
              You can populate these via Cloud Run environment variables (e.g. <code className="font-mono">VITE_FIREBASE_API_KEY</code>) or paste your Web App config below:
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-stone-500 font-medium block mb-0.5">
                    Firebase Project ID
                  </label>
                  <input
                    type="text"
                    placeholder="my-journal-project"
                    value={customConfig.projectId}
                    onChange={(e) => setCustomConfig({ ...customConfig, projectId: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-stone-500 font-medium block mb-0.5">
                    Web API Key
                  </label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={customConfig.apiKey}
                    onChange={(e) => setCustomConfig({ ...customConfig, apiKey: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-stone-500 font-medium block mb-0.5">
                  App ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="1:123456789:web:abcdef..."
                  value={customConfig.appId}
                  onChange={(e) => setCustomConfig({ ...customConfig, appId: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    saveCustomFirebaseConfig(null);
                    setCustomConfig({
                      apiKey: '',
                      authDomain: '',
                      projectId: '',
                      appId: '',
                    });
                  }}
                  className="text-stone-500 hover:text-stone-800 text-[11px] underline cursor-pointer"
                >
                  Reset to Environment Defaults
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
