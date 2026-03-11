'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/src/components/NavBar';

const KNOWN_STEPS = [
  { label: 'Extracting participant info...', duration: 4000 },
  { label: 'Searching the web for intel...', duration: 8000 },
  { label: 'Building intel profiles...', duration: 6000 },
  { label: 'Generating talking points...', duration: 5000 },
  { label: 'Creating person cards...', duration: 5000 },
  { label: 'Almost ready...', duration: 99999 },
];

const UNKNOWN_STEPS = [
  { label: 'Building event archetypes...', duration: 4000 },
  { label: 'Crafting practice personas...', duration: 6000 },
  { label: 'Generating talking points...', duration: 4000 },
  { label: 'Almost ready...', duration: 99999 },
];

function LoadingScreen({ unknownMode }: { unknownMode: boolean }) {
  const LOADING_STEPS = unknownMode ? UNKNOWN_STEPS : KNOWN_STEPS;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    LOADING_STEPS.forEach((step, i) => {
      if (i < LOADING_STEPS.length - 1) {
        const timer = setTimeout(() => setStepIndex(i + 1), elapsed + step.duration);
        timers.push(timer);
        elapsed += step.duration;
      }
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 bg-cream z-50 flex flex-col items-center justify-center px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-ink/[0.03] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative text-center max-w-sm w-full">
        {/* Spinner */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-ink/30" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-ink animate-spin" />
            <div className="absolute inset-2 rounded-full bg-white border border-ink/[0.08] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-amber animate-pulse" />
            </div>
          </div>
        </div>

        {/* Step label */}
        <div className="h-6 mb-8">
          <p key={stepIndex} className="text-sm text-ink-muted animate-fade-in">
            {LOADING_STEPS[stepIndex].label}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {LOADING_STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-500 ${
                i < stepIndex
                  ? 'w-2 h-2 bg-amber'
                  : i === stepIndex
                  ? 'w-2.5 h-2.5 bg-amber/60 animate-pulse'
                  : 'w-1.5 h-1.5 bg-ink/20'
              }`}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-ink/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-ink rounded-full transition-all duration-1000"
            style={{ width: `${Math.round((stepIndex / (LOADING_STEPS.length - 1)) * 100)}%` }}
          />
        </div>

        <p className="mt-6 text-xs text-ink-muted/50">This usually takes 20–40 seconds</p>
      </div>
    </div>
  );
}

export default function PrepPage() {
  const router = useRouter();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknownMode, setUnknownMode] = useState(false);

  const [eventType, setEventType] = useState('');
  const [industry, setIndustry] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userGoal, setUserGoal] = useState('');
  const [targetPeople, setTargetPeople] = useState('');
  const [urls, setUrls] = useState('');
  const [plainTextNotes, setPlainTextNotes] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!eventType || !industry || !userRole || !userGoal) {
      setError('Please fill in all required fields');
      return;
    }
    if (!unknownMode && !targetPeople) {
      setError('Please describe who you want to meet, or switch to Open Networking mode');
      return;
    }
    if (unknownMode) {
      submit(false);
    } else {
      setShowConsentModal(true);
    }
  };

  const submit = async (consentGiven: boolean) => {
    setShowConsentModal(false);
    setIsSubmitting(true);
    setError(null);
    try {
      const contextInput = {
        eventType, industry, userRole, userGoal,
        targetPeopleDescription: unknownMode ? `Open networking at ${eventType}` : targetPeople,
        urls: urls ? urls.split('\n').filter(u => u.trim()) : undefined,
        plainTextNotes: plainTextNotes || undefined,
        screenshotStoragePaths: screenshots.length > 0 ? [] : undefined,
      };
      const response = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextInput, consentGiven, unknownMode }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create context');
      }
      const { contextId } = await response.json();
      router.push(`/prep/${contextId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-cream border border-ink/[0.1] rounded-lg text-sm text-ink placeholder-ink-muted/50 focus:border-ink/30 focus:ring-1 focus:ring-ink/[0.06] transition-colors outline-none";
  const labelClass = "block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-cream">
      {isSubmitting && <LoadingScreen unknownMode={unknownMode} />}
      <NavBar />

      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 animate-slide-up">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-1">Prepare for Your Event</h1>
            <p className="text-sm text-ink-muted">Tell us about your networking event and who you&apos;ll be meeting.</p>
          </div>

          {/* Mode toggle */}
          <div className="mb-6 animate-slide-up-1">
            <div className="flex gap-2 p-1 bg-white border border-ink/[0.08] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={() => setUnknownMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  !unknownMode
                    ? 'bg-ink/[0.06] text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${!unknownMode ? 'bg-amber' : 'bg-ink/20'}`} />
                I know who I&apos;m meeting
              </button>
              <button
                type="button"
                onClick={() => setUnknownMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                  unknownMode
                    ? 'bg-ink/[0.06] text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${unknownMode ? 'bg-ink/40' : 'bg-ink/20'}`} />
                Open networking
              </button>
            </div>
            {unknownMode && (
              <p className="mt-2 text-xs text-ink-muted px-1 animate-fade-in">
                We&apos;ll generate realistic fictional personas you might encounter — great for practicing cold conversations.
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="bg-white border border-ink/[0.08] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-slide-up-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Event Type <span className="text-red-500 normal-case">*</span></label>
                  <input type="text" value={eventType} onChange={(e) => setEventType(e.target.value)}
                    placeholder="Conference, Career Fair, Mixer..." className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Industry <span className="text-red-500 normal-case">*</span></label>
                  <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Technology, Finance, Healthcare..." className={inputClass} required />
                </div>
              </div>

              <div>
                <label className={labelClass}>Your Role <span className="text-red-500 normal-case">*</span></label>
                <input type="text" value={userRole} onChange={(e) => setUserRole(e.target.value)}
                  placeholder="Software Engineer, Product Manager..." className={inputClass} required />
              </div>

              <div>
                <label className={labelClass}>Your Goal <span className="text-red-500 normal-case">*</span></label>
                <textarea value={userGoal} onChange={(e) => setUserGoal(e.target.value)}
                  placeholder="Find a mentor in AI, explore job opportunities..." rows={2}
                  className={inputClass} required />
              </div>

              {!unknownMode && (
                <div className="animate-fade-in">
                  <label className={labelClass}>Who You&apos;ll Meet <span className="text-red-500 normal-case">*</span></label>
                  <textarea value={targetPeople} onChange={(e) => setTargetPeople(e.target.value)}
                    placeholder="Names, roles, companies of people you want to meet..." rows={3}
                    className={inputClass} />
                </div>
              )}

              {!unknownMode && (
                <div className="border-t border-ink/[0.06] pt-5 animate-fade-in">
                  <p className="text-xs text-ink-muted/50 mb-4 uppercase tracking-wider font-medium">Optional intel sources</p>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>URLs</label>
                      <textarea value={urls} onChange={(e) => setUrls(e.target.value)}
                        placeholder="Event page, LinkedIn profiles, company websites — one per line"
                        rows={2} className={inputClass} />
                    </div>

                    <div>
                      <label className={labelClass}>Screenshots</label>
                      <div className="relative">
                        <input type="file" accept="image/*" multiple
                          onChange={(e) => setScreenshots(Array.from(e.target.files || []))}
                          className="w-full text-xs text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-ink/[0.06] file:text-ink hover:file:bg-ink/[0.1] file:cursor-pointer cursor-pointer" />
                      </div>
                      {screenshots.length > 0 && (
                        <p className="mt-1.5 text-xs text-ink-muted">{screenshots.length} file{screenshots.length > 1 ? 's' : ''} selected</p>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>Additional Notes</label>
                      <textarea value={plainTextNotes} onChange={(e) => setPlainTextNotes(e.target.value)}
                        placeholder="Any additional context..." rows={3} className={inputClass} />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button type="submit" disabled={isSubmitting}
                  className="w-full bg-ink hover:bg-ink/80 disabled:opacity-50 disabled:cursor-not-allowed text-cream py-3 rounded-xl text-sm font-bold transition-colors active:scale-[0.99]">
                  {unknownMode ? 'Generate Practice Personas' : 'Generate Prep Materials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-ink/[0.08] rounded-2xl max-w-lg w-full p-8 animate-slide-up">
            <h2 className="text-base font-semibold text-ink mb-1">Intel Gathering Consent</h2>
            <p className="text-xs text-ink-muted mb-6">Before we proceed, please review what we&apos;ll do with your input.</p>

            <div className="space-y-3 text-sm text-ink-muted mb-6">
              <p>To provide personalized prep materials, Rapport will:</p>
              <ul className="space-y-1.5 ml-4">
                {[
                  'Search for publicly available info about the people you mentioned',
                  'Scrape content from any URLs you provided',
                  'Temporarily store this info to generate your materials',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-amber mt-0.5 text-xs">◆</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-ink-muted/50 text-xs">All data is deleted after 90 days. We only use publicly available information.</p>
              <div className="px-3 py-2.5 bg-cream border border-ink/[0.1] rounded-lg text-xs text-ink-muted">
                If you decline, we&apos;ll still generate prep materials using only what you provided directly (Degraded Mode).
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => submit(false)}
                className="flex-1 bg-cream hover:bg-ink/[0.04] border border-ink/[0.1] text-ink py-2.5 rounded-lg text-sm font-medium transition-colors">
                Decline
              </button>
              <button onClick={() => submit(true)}
                className="flex-1 bg-ink hover:bg-ink/80 text-cream py-2.5 rounded-lg text-sm font-semibold transition-colors active:scale-[0.98]">
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
