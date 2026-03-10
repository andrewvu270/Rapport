import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50">
      {/* Nav */}
      <nav className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">NetWork</span>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="text-sm text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors">
              Sign in
            </Link>
            <Link href="/auth/register" className="text-sm bg-violet-500 hover:bg-violet-600 text-white px-4 py-1.5 rounded-lg transition-colors font-medium active:scale-[0.98]">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 py-28 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-500/8 blur-[120px] rounded-full" />
        </div>
        <div className="relative max-w-4xl mx-auto animate-slide-up">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-violet-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            AI-powered networking practice
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-zinc-50 leading-[1.1] tracking-tight mb-6">
            Walk into every networking<br />event{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-violet-600">ready</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            NetWork researches the people you'll meet, builds personalized talking points, then lets you practice conversations with AI personas before the real thing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register" className="bg-violet-500 hover:bg-violet-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-colors active:scale-[0.98]">
              Start practicing free
            </Link>
            <Link href="/auth/login" className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-100 px-8 py-3.5 rounded-xl text-base font-semibold transition-colors">
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-600">No credit card required · 1 free session per month</p>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">How it works</h2>
            <p className="text-zinc-500 max-w-md mx-auto">Three steps from blank slate to confident networker</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Tell us about the event', description: 'Paste LinkedIn profiles, event URLs, or describe who you want to meet. Our AI scrapes, searches, and extracts intel automatically.', accent: 'text-violet-400', border: 'border-violet-500/20' },
              { step: '02', title: 'Get your prep materials', description: 'Receive personalized talking points, icebreakers, and person cards for each attendee — tailored to your goals.', accent: 'text-blue-400', border: 'border-blue-500/20' },
              { step: '03', title: 'Practice the real conversation', description: 'Talk to an AI persona via voice or video. After each session, Claude scores your performance and assigns homework drills.', accent: 'text-emerald-400', border: 'border-emerald-500/20' },
            ].map(({ step, title, description, accent, border }) => (
              <div key={step} className={`bg-zinc-900 border ${border} rounded-xl p-8`}>
                <div className={`text-4xl font-bold ${accent} mb-5 font-mono`}>{step}</div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">Everything you need</h2>
            <p className="text-zinc-500">Built for professionals who hate winging it</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { title: 'AI intel gathering', description: 'Automatically scrapes LinkedIn, event pages, and company sites to build a profile on everyone you want to meet.' },
              { title: 'Voice practice', description: 'Have a real-time voice conversation with an AI persona built from actual public information about your contact.' },
              { title: 'Video practice', description: 'Practice face-to-face with a Tavus video avatar — the closest thing to the real conversation before it happens.' },
              { title: 'Scored debrief', description: 'Claude scores your openers, question quality, response relevance, and closing on a 1–10 scale with specific feedback.' },
              { title: 'Homework drills', description: 'Three targeted exercises after every session to fix your weakest area before the next practice.' },
              { title: 'Progress tracking', description: 'See your scores improve over time. Know exactly which networking skill to work on next.' },
            ].map(({ title, description }) => (
              <div key={title} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-6 transition-colors duration-200">
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 border-t border-zinc-800/60" id="pricing">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">Simple pricing</h2>
            <p className="text-zinc-500">Pay only for the sessions you use</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
              <h3 className="text-xs font-medium text-zinc-500 mb-4 uppercase tracking-wider">Free</h3>
              <div className="text-4xl font-bold text-zinc-50 mb-1">$0</div>
              <p className="text-zinc-600 text-sm mb-8">forever</p>
              <ul className="space-y-2.5 mb-8">
                {['1 voice session per month', 'AI intel gathering', 'Talking points + person cards', 'Scored debrief', 'Homework drills'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-zinc-400">
                    <span className="text-emerald-400 text-xs">✓</span>{item}
                  </li>
                ))}
                <li className="flex items-center gap-2.5 text-sm text-zinc-700"><span className="text-zinc-700 text-xs">✗</span>Video sessions</li>
              </ul>
              <Link href="/auth/register" className="block text-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Get started free
              </Link>
            </div>
            <div className="bg-zinc-900 border border-violet-500/40 rounded-xl p-8 relative">
              <div className="absolute -top-3 left-6 bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
              <h3 className="text-xs font-medium text-violet-400 mb-4 uppercase tracking-wider">Pro</h3>
              <div className="text-4xl font-bold text-zinc-50 mb-1">$19</div>
              <p className="text-zinc-600 text-sm mb-8">per month</p>
              <ul className="space-y-2.5 mb-8">
                {['10 sessions per month', 'Voice + video sessions', 'AI intel gathering', 'Talking points + person cards', 'Scored debrief', 'Homework drills', 'Progress dashboard'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <span className="text-violet-400 text-xs">✓</span>{item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register" className="block text-center bg-violet-500 hover:bg-violet-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]">
                Start free trial
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-zinc-700 mt-8">Billing coming soon · All features available during beta</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center border-t border-zinc-800/60">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-zinc-100 mb-4 tracking-tight">Your next event is coming.<br />Are you ready?</h2>
          <p className="text-zinc-500 mb-8">Join professionals using NetWork to walk into rooms with confidence.</p>
          <Link href="/auth/register" className="inline-block bg-violet-500 hover:bg-violet-600 text-white px-8 py-3.5 rounded-xl font-semibold transition-colors active:scale-[0.98]">
            Start for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-zinc-700 text-xs">© 2026 NetWork. All rights reserved.</span>
          <div className="flex gap-6 text-xs text-zinc-700">
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
