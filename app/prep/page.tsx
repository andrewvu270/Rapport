'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/src/components/NavBar';

const LOADING_STEPS = [
  { label: 'Extracting participant info...', duration: 4000 },
  { label: 'Searching the web for intel...', duration: 8000 },
  { label: 'Building intel profiles...', duration: 6000 },
  { label: 'Generating talking points...', duration: 5000 },
  { label: 'Creating person cards...', duration: 5000 },
  { label: 'Almost ready...', duration: 99999 },
];

function LoadingScreen() {
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
    <div className="fixed inset-0 bg-[#09090b] z-50 flex flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-500/8 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative text-center max-w-sm w-full">
        {/* Spinner */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
            <div className="absolute inset-2 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Step label */}
        <div className="h-6 mb-8">
          <p key={stepIndex} className="text-sm text-zinc-300 animate-fade-in">
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
                  ? 'w-2 h-2 bg-violet-500'
                  : i === stepIndex
                  ? 'w-2.5 h-2.5 bg-violet-400 animate-pulse'
                  : 'w-1.5 h-1.5 bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-1000"
            style={{ width: `${Math.round((stepIndex / (LOADING_STEPS.length - 1)) * 100)}%` }}
          />
        </div>

        <p className="mt-6 text-xs text-zinc-600">This usually takes 20–40 seconds</p>
      </div>
    </div>
  );
}

export default function PrepPage() {
  const router = useRouter();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!eventType || !industry || !userRole || !userGoal || !targetPeople) {
      setError('Please fill in all required fields');
      return;
    }
    setShowConsentModal(true);
  };

  const submit = async (consentGiven: boolean) => {
    setShowConsentModal(false);
    setIsSubmitting(true);
    setError(null);
    try {
      const contextInput = {
        eventType, industry, userRole, userGoal,
        targetPeopleDescription: targetPeople,
        urls: urls ? urls.split('\n').filter(u => u.trim()) : undefined,
        plainTextNotes: plainTextNotes || undefined,
        screenshotStoragePaths: screenshots.length > 0 ? [] : undefined,
      };
      const response = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextInput, consentGiven }),
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

  const inputClass = "w-full px-3 py-2.5 bg-zinc-800 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-colors";
  const labelClass = "block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-[#09090b]">
      {isSubmitting && <LoadingScreen />}
      <NavBar />

      <div className="py-10 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 animate-slide-up">
            <h1 className="text-xl font-semibold text-zinc-100 mb-1">Prepare for Your Event</h1>
            <p className="text-sm text-zinc-500">Tell us about your networking event and who you'll be meeting.</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-slide-up-1">
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

              <div>
                <label className={labelClass}>Target People <span className="text-red-500 normal-case">*</span></label>
                <textarea value={targetPeople} onChange={(e) => setTargetPeople(e.target.value)}
                  placeholder="Names, roles, companies of people you want to meet..." rows={3}
                  className={inputClass} required />
              </div>

              {/* Divider */}
              <div className="border-t border-zinc-800 pt-5">
                <p className="text-xs text-zinc-600 mb-4 uppercase tracking-wider font-medium">Optional intel sources</p>
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
                        className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 file:cursor-pointer cursor-pointer" />
                    </div>
                    {screenshots.length > 0 && (
                      <p className="mt-1.5 text-xs text-zinc-500">{screenshots.length} file{screenshots.length > 1 ? 's' : ''} selected</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Additional Notes</label>
                    <textarea value={plainTextNotes} onChange={(e) => setPlainTextNotes(e.target.value)}
                      placeholder="Any additional context..." rows={3} className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isSubmitting}
                  className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg text-sm font-semibold transition-colors active:scale-[0.99]">
                  Generate Prep Materials
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-8 animate-slide-up">
            <h2 className="text-base font-semibold text-zinc-100 mb-1">Intel Gathering Consent</h2>
            <p className="text-xs text-zinc-500 mb-6">Before we proceed, please review what we'll do with your input.</p>

            <div className="space-y-3 text-sm text-zinc-400 mb-6">
              <p>To provide personalized prep materials, NetWork will:</p>
              <ul className="space-y-1.5 ml-4">
                {[
                  'Search for publicly available info about the people you mentioned',
                  'Scrape content from any URLs you provided',
                  'Temporarily store this info to generate your materials',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-violet-400 mt-0.5 text-xs">◆</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-zinc-500 text-xs">All data is deleted after 90 days. We only use publicly available information.</p>
              <div className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400">
                If you decline, we'll still generate prep materials using only what you provided directly (Degraded Mode).
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => submit(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Decline
              </button>
              <button onClick={() => submit(true)}
                className="flex-1 bg-violet-500 hover:bg-violet-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors active:scale-[0.98]">
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
