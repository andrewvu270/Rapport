'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useInView, useMotionValue, useSpring, useAnimationFrame, useTransform } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { createClient } from '@/src/lib/supabase';

// ── CountUp ───────────────────────────────────────────────────────────────
function CountUp({ to, from = 0, direction = 'up', delay = 0, duration = 2, className = '', startWhen = true, separator = '', suffix = '' }: { to: number; from?: number; direction?: 'up'|'down'; delay?: number; duration?: number; className?: string; startWhen?: boolean; separator?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);
  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  const getDecimalPlaces = (num: number) => {
    const str = num.toString();
    if (str.includes('.')) { const d = str.split('.')[1]; if (parseInt(d) !== 0) return d.length; }
    return 0;
  };
  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback((latest: number) => {
    const options: Intl.NumberFormatOptions = { useGrouping: !!separator, minimumFractionDigits: maxDecimals > 0 ? maxDecimals : 0, maximumFractionDigits: maxDecimals > 0 ? maxDecimals : 0 };
    const formatted = Intl.NumberFormat('en-US', options).format(latest);
    return (separator ? formatted.replace(/,/g, separator) : formatted) + suffix;
  }, [maxDecimals, separator, suffix]);

  useEffect(() => { if (ref.current) ref.current.textContent = formatValue(direction === 'down' ? to : from); }, [from, to, direction, formatValue]);

  useEffect(() => {
    if (isInView && startWhen) {
      const t = setTimeout(() => motionValue.set(direction === 'down' ? from : to), delay * 1000);
      return () => clearTimeout(t);
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay]);

  useEffect(() => {
    const unsub = springValue.on('change', (latest) => { if (ref.current) ref.current.textContent = formatValue(latest); });
    return () => unsub();
  }, [springValue, formatValue]);

  return <span className={className} ref={ref} />;
}

// ── BlurText ──────────────────────────────────────────────────────────────
function BlurText({ text = '', delay = 150, className = '', animateBy = 'words', direction = 'bottom' }: { text?: string; delay?: number; className?: string; animateBy?: 'words'|'letters'; direction?: 'top'|'bottom' }) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const defaultFrom = direction === 'top' ? { filter: 'blur(10px)', opacity: 0, y: -30 } : { filter: 'blur(10px)', opacity: 0, y: 30 };
  const defaultTo = [{ filter: 'blur(5px)', opacity: 0.5, y: direction === 'top' ? 5 : -5 }, { filter: 'blur(0px)', opacity: 1, y: 0 }];
  const stepCount = defaultTo.length + 1;
  const totalDuration = 0.35 * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => i / (stepCount - 1));

  const buildKeyframes = (from: Record<string, string|number>, steps: Record<string, string|number>[]) => {
    const keys = new Set([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);
    const kf: Record<string, (string|number)[]> = {};
    keys.forEach(k => { kf[k] = [from[k], ...steps.map(s => s[k])]; });
    return kf;
  };

  return (
    <p ref={ref} className={`flex flex-wrap ${className}`}>
      {elements.map((segment, index) => (
        <motion.span key={index} initial={defaultFrom} animate={inView ? buildKeyframes(defaultFrom, defaultTo) : defaultFrom}
          transition={{ duration: totalDuration, times, delay: (index * delay) / 1000, ease: (t: number) => t } as Transition}
          style={{ display: 'inline-block', willChange: 'transform, filter, opacity' }}>
          {segment === ' ' ? '\u00A0' : segment}{animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </p>
  );
}

// ── ShinyText ─────────────────────────────────────────────────────────────
function ShinyText({ text, speed = 3, className = '', color = '#b5b5b5', shineColor = '#ffffff', spread = 120 }: { text: string; speed?: number; className?: string; color?: string; shineColor?: string; spread?: number }) {
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const lastTime = useRef<number|null>(null);

  useAnimationFrame((time) => {
    if (lastTime.current === null) { lastTime.current = time; return; }
    elapsed.current += time - lastTime.current;
    lastTime.current = time;
    const p = (elapsed.current % (speed * 1000)) / (speed * 1000) * 100;
    progress.set(p);
  });

  const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`);

  return (
    <motion.span className={`inline-block ${className}`}
      style={{ backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`, backgroundSize: '200% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundPosition }}>
      {text}
    </motion.span>
  );
}

// ── SpotlightCard ─────────────────────────────────────────────────────────
function SpotlightCard({ children, className = '', spotlightColor = 'rgba(255, 255, 255, 0.08)' as `rgba(${number}, ${number}, ${number}, ${number})` }: { children: React.ReactNode; className?: string; spotlightColor?: `rgba(${number}, ${number}, ${number}, ${number})` }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = e => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={divRef} onMouseMove={handleMouseMove} onFocus={() => { setIsFocused(true); setOpacity(1); }} onBlur={() => { setIsFocused(false); setOpacity(0); }}
      onMouseEnter={() => setOpacity(1)} onMouseLeave={() => setOpacity(0)} className={`relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity, background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)` }} />
      {children}
    </div>
  );
}

// ── Reveal ────────────────────────────────────────────────────────────────
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.65s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.65s ${delay}s cubic-bezier(0.16,1,0.3,1)`,
    }}>
      {children}
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────
const STATS = [
  { value: 20, suffix: 's', label: 'Intel generated' },
  { value: 3, suffix: '×', label: 'More confident' },
  { value: 10, suffix: '+', label: 'AI personas' },
];

const TICKER = [
  'AI intel in 20 seconds',
  'Voice practice sessions',
  'Personalized icebreakers',
  'Scored debriefs',
  'Video AI personas',
  'Open networking mode',
  'Homework drills',
  'Real-time feedback',
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Tell us about the event',
    description: 'Paste LinkedIn profiles, event URLs, or describe who you want to meet. AI scrapes and extracts intel automatically.',
  },
  {
    step: '02',
    title: 'Get your prep brief',
    description: 'Personalized talking points, icebreakers, and person cards for each attendee — tailored to your goals.',
  },
  {
    step: '03',
    title: 'Practice the conversation',
    description: 'Talk to an AI persona via voice or video. Get a scored debrief with targeted homework after each session.',
  },
];

const FEATURES = [
  { title: 'AI intel gathering', description: 'Automatically scrapes LinkedIn, event pages, and company sites to build a full profile on everyone you want to meet.' },
  { title: 'Voice practice', description: 'Real-time voice conversation with an AI persona built from actual public information about your contact.' },
  { title: 'Video practice', description: 'Practice face-to-face with a Tavus video avatar — the closest thing to the real conversation before it happens.' },
  { title: 'Scored debrief', description: 'Get rated on openers, question quality, response relevance, and closing — 1 to 10 with specific written feedback.' },
  { title: 'Homework drills', description: 'Three targeted exercises after every session to fix your weakest area before the next one.' },
  { title: 'Open networking mode', description: "Don't know who you'll meet? We generate realistic archetypes so you can practice cold conversations." },
];

// ── Page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-cream text-ink">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-ink/[0.06] bg-cream/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight">Rapport</span>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">How it works</a>
            <a href="#features" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">Sign in</Link>
            <Link href="/auth/register" className="px-4 py-2 rounded-xl text-sm font-bold bg-ink text-cream hover:bg-ink/80 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-ink text-cream relative overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}>
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24">
          <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">

            {/* Left */}
            <div className="flex-1 min-w-0">
              <div className="animate-slide-up inline-flex items-center gap-2 rounded-full border border-cream/10 px-4 py-1.5 text-xs font-semibold text-cream/50 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse-dot" />
                AI-powered networking prep
              </div>

              <BlurText
                text="Walk into every networking event ready."
                delay={120}
                direction="bottom"
                className="text-[clamp(3rem,6vw,5.5rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-cream mb-7"
              />

              <p className="animate-slide-up-2 text-lg text-cream/50 font-normal leading-relaxed max-w-lg mb-10">
                Rapport researches the people you&apos;ll meet, builds personalized
                talking points, then lets you practice with AI personas before the real thing.
              </p>

              <div className="animate-slide-up-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-16">
                <Link href="/auth/register"
                  className="px-7 py-3.5 rounded-xl text-sm font-bold bg-amber text-ink hover:bg-amber-hover transition-colors shadow-[0_4px_0_#92400e]">
                  <ShinyText text="Start for free" color="#0F0F0E" shineColor="rgba(255,255,255,0.6)" speed={2.5} />
                </Link>
                <Link href="/auth/login"
                  className="px-7 py-3.5 rounded-xl text-sm font-medium text-cream/50 border border-cream/10 hover:border-cream/20 hover:text-cream transition-colors">
                  Sign in →
                </Link>
              </div>

              {/* Stats */}
              <div className="animate-slide-up-4 flex flex-col sm:flex-row gap-8 sm:gap-0 sm:divide-x sm:divide-cream/10 pt-8 border-t border-cream/10">
                {STATS.map(({ value, suffix, label }) => (
                  <div key={label} className="sm:px-10 first:pl-0 last:pr-0">
                    <div className="text-3xl font-extrabold tracking-tight text-cream mb-0.5">
                      <CountUp to={value} suffix={suffix} />
                    </div>
                    <div className="text-xs text-cream/40 font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — product preview card */}
            <div className="animate-slide-up-2 hidden lg:block relative shrink-0 w-[380px]">
              <div className="rounded-2xl bg-white p-5 shadow-[0_16px_64px_rgba(0,0,0,0.4)]">
                {/* Card header */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-ink/[0.06]">
                  <div className="w-10 h-10 rounded-full bg-amber/15 flex items-center justify-center text-sm font-bold text-amber-600 shrink-0">JD</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">Jane Doe</div>
                    <div className="text-xs text-ink-muted">CTO @ Acme Corp · Series B</div>
                  </div>
                  <span className="text-[11px] font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200 shrink-0">
                    Ready
                  </span>
                </div>

                {/* Icebreaker */}
                <div className="mb-3">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-ink-muted/50 mb-1.5">Icebreaker</p>
                  <p className="text-xs text-ink leading-relaxed bg-cream rounded-lg p-3">
                    &ldquo;I saw you spoke at SaaStr — what was the most surprising question from the audience?&rdquo;
                  </p>
                </div>

                {/* Topics */}
                <div className="mb-4">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-ink-muted/50 mb-1.5">Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['AI/ML', 'Fundraising', 'Team scaling', 'PLG'].map(t => (
                      <span key={t} className="text-[11px] font-semibold bg-amber/10 text-amber-700 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Practice button */}
                <button className="w-full py-2.5 rounded-xl text-xs font-bold bg-ink text-cream text-center">
                  🎤  Start voice practice
                </button>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-3 -left-5 bg-amber text-ink rounded-xl px-4 py-2.5 shadow-[0_8px_24px_rgba(245,158,11,0.4)]">
                <div className="text-xl font-extrabold leading-none">20s</div>
                <div className="text-[10px] font-semibold opacity-60 mt-0.5">intel ready</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="border-y border-ink/[0.06] bg-cream overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap py-3">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2.5 px-7 text-xs font-semibold text-ink-muted uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-amber inline-block shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-cream py-28">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber mb-4">How it works</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] text-ink mb-16 max-w-lg leading-[1.1]">
              Three steps to<br />confident networking
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map(({ step, title, description }, i) => (
              <Reveal key={step} delay={i * 0.1}>
                <div className="group bg-white rounded-2xl p-8 shadow-[0_2px_0_rgba(0,0,0,0.04),0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_0_rgba(0,0,0,0.06),0_8px_40px_rgba(0,0,0,0.1)] transition-shadow duration-300 h-full">
                  <div className="text-5xl font-extrabold tracking-tight text-amber/20 group-hover:text-amber/35 transition-colors duration-300 mb-5 leading-none">{step}</div>
                  <h3 className="text-base font-bold text-ink mb-3">{title}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-ink text-cream py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-28">
              <Reveal>
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber mb-4">Features</p>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] text-cream mb-6 leading-[1.1]">
                  Everything you need<br />to stop winging it
                </h2>
                <p className="text-cream/40 leading-relaxed mb-8 max-w-sm text-sm">
                  Built for professionals who show up prepared — not just hoping for the best.
                </p>
                <Link href="/auth/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber text-ink hover:bg-amber-hover transition-colors shadow-[0_4px_0_#92400e]">
                  Try it free →
                </Link>
              </Reveal>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURES.map(({ title, description }, i) => (
                <Reveal key={title} delay={i * 0.07}>
                  <SpotlightCard className="rounded-2xl border border-cream/[0.07] p-6 hover:border-cream/[0.15] transition-colors cursor-default h-full" spotlightColor="rgba(245, 158, 11, 0.12)">
                    <h3 className="text-sm font-bold text-cream mb-2">{title}</h3>
                    <p className="text-xs text-cream/40 leading-relaxed">{description}</p>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-cream py-28">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber mb-4">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] text-ink mb-16 max-w-lg leading-[1.1]">
              Simple,<br />honest pricing
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
            <Reveal delay={0}>
              <div className="bg-white rounded-2xl p-8 shadow-[0_2px_0_rgba(0,0,0,0.04),0_4px_24px_rgba(0,0,0,0.06)] h-full flex flex-col">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-ink-muted mb-6">Free</p>
                <div className="text-5xl font-extrabold tracking-tight text-ink mb-1">$0</div>
                <p className="text-sm text-ink-muted mb-8">forever</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {['1 voice session / month', 'AI intel gathering', 'Talking points + person cards', 'Scored debrief', 'Homework drills'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm text-ink">
                      <span className="text-amber font-bold text-base leading-none">✓</span>{item}
                    </li>
                  ))}
                  <li className="flex items-center gap-3 text-sm text-ink/25">
                    <span className="font-bold text-base leading-none">✗</span>Video sessions
                  </li>
                </ul>
                <Link href="/auth/register" className="block text-center py-3 rounded-xl text-sm font-bold border border-ink/10 text-ink hover:bg-ink hover:text-cream transition-colors">
                  Get started free
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="bg-ink rounded-2xl p-8 h-full flex flex-col">
                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-cream/30 mb-6">Pro</p>
                <div className="text-5xl font-extrabold tracking-tight text-cream mb-1">$19</div>
                <p className="text-sm text-cream/40 mb-8">per month</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {['10 sessions / month', 'Voice + video sessions', 'AI intel gathering', 'Talking points + person cards', 'Scored debrief', 'Homework drills', 'Progress dashboard'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm text-cream/75">
                      <span className="text-amber font-bold text-base leading-none">✓</span>{item}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register" className="block text-center py-3 rounded-xl text-sm font-bold bg-amber text-ink hover:bg-amber-hover transition-colors shadow-[0_4px_0_#92400e]">
                  Start free trial
                </Link>
              </div>
            </Reveal>
          </div>
          <p className="text-xs text-ink-muted mt-5">Billing coming soon · All features available during beta</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-ink text-cream py-32">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-[-0.04em] mb-6 leading-[1.02]">
              Your next event<br />is coming.
            </h2>
            <p className="text-cream/40 text-base mb-10 max-w-xs mx-auto leading-relaxed">
              Walk in knowing exactly who you&apos;re meeting and what to say.
            </p>
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-base font-bold bg-amber text-ink hover:bg-amber-hover transition-colors shadow-[0_4px_0_#92400e]">
              Start for free →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-ink border-t border-cream/[0.06] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold text-cream/25">Rapport</span>
          <span className="text-xs text-cream/20">© 2026 Rapport. All rights reserved.</span>
          <div className="flex gap-6 text-xs text-cream/25">
            <Link href="/terms" className="hover:text-cream/50 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-cream/50 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
