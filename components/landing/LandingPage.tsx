'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  Clapperboard,
  Wand2,
  Globe,
  Crown,
  ShieldCheck,
  Smartphone,
  Store,
  Sparkles,
  Camera,
  Layers,
  Play,
  Check,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared motion presets
// ─────────────────────────────────────────────────────────────────────────────
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: 'easeOut' as const },
};

// Rotating "ad frames" for the hero phone mock — pure CSS gradients + elite copy.
const HERO_FRAMES = [
  {
    gradient: 'from-emerald-950 via-[#1a2e1a] to-amber-900',
    glow: 'bg-amber-400/30',
    hook: 'Skin Drinks Light',
    cta: 'Begin The Ritual',
  },
  {
    gradient: 'from-stone-900 via-neutral-800 to-emerald-950',
    glow: 'bg-emerald-300/20',
    hook: 'Hand-Cut Linen, Stillness',
    cta: 'Wear The Heritage',
  },
  {
    gradient: 'from-[#2a1a2e] via-[#1a1f2e] to-[#0d1117]',
    glow: 'bg-violet-400/20',
    hook: 'Silk That Whispers',
    cta: 'Find Your Drape',
  },
];

const SHOWCASE_FRAMES = [
  { gradient: 'from-amber-900 via-amber-700 to-yellow-600', hook: 'Golden Hour, Bottled', tag: 'Beauty' },
  { gradient: 'from-emerald-950 via-emerald-800 to-teal-700', hook: 'Hand-Loomed In Lagos', tag: 'Fashion' },
  { gradient: 'from-slate-950 via-slate-800 to-zinc-700', hook: 'Precision, Engineered Quiet', tag: 'Tech' },
  { gradient: 'from-rose-950 via-rose-800 to-orange-700', hook: 'Harvest To Table', tag: 'Culinary' },
  { gradient: 'from-indigo-950 via-violet-900 to-purple-800', hook: 'Cashmere, Quiet As Snow', tag: 'Fashion' },
];

const TIERS = [
  {
    name: 'Starter',
    price: 'D399',
    blurb: 'Open your boutique and make your first sales.',
    features: ['Up to 10 items', 'Mobile-first storefront', '3 AI photo upgrades / month'],
    dark: false,
  },
  {
    name: 'Pro',
    price: 'D1,500',
    blurb: 'Unlimited inventory with the full AI toolkit.',
    features: ['Unlimited inventory', 'Verified Seller badge', '50 AI photos + 10 ad scripts'],
    dark: false,
    popular: true,
  },
  {
    name: 'Advanced',
    price: 'D2,500',
    blurb: 'The enterprise suite — including your AI-built website.',
    features: ['Unlimited AI generation', 'AI Website Generator', 'Priority placement + escrow'],
    dark: true,
  },
];

function HeroPhoneMock() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % HERO_FRAMES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const active = HERO_FRAMES[frame];

  return (
    <div className="relative mx-auto w-[280px] shrink-0 md:w-[320px]">
      {/* Ambient glow behind the phone */}
      <div className="absolute -inset-8 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative aspect-[9/16] overflow-hidden rounded-[2.4rem] border-[6px] border-black bg-black shadow-2xl ring-1 ring-white/20">
        <motion.div
          key={frame}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`absolute inset-0 bg-gradient-to-br ${active.gradient}`}
        >
          {/* Product "glow" stand-in */}
          <div className={`absolute left-1/2 top-[34%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full ${active.glow} blur-2xl`} />
          <div className="absolute left-1/2 top-[34%] h-24 w-16 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/30" />

          {/* Caption chips — mirrors the real Ad Studio output */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-xl bg-black/60 px-4 py-2 backdrop-blur-sm"
          >
            <p className="whitespace-nowrap text-sm font-extrabold text-white">{active.hook}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.35 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 rounded-xl bg-[#f0a500]/90 px-4 py-1.5"
          >
            <p className="whitespace-nowrap text-xs font-black uppercase tracking-wide text-black">{active.cta}</p>
          </motion.div>
        </motion.div>

        {/* Fake status bar + progress dots */}
        <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
          <div className="h-4 w-20 rounded-full bg-black" />
        </div>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
          {HERO_FRAMES.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${i === frame ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      </div>

      {/* Floating badge */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute -right-6 top-16 flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-xl ring-1 ring-gray-100"
      >
        <Sparkles size={14} className="text-[#f0a500]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-900">AI Generated</span>
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-10">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="Sanndikaa" className="h-14 w-auto object-contain" />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link href="/" className="text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-900">
              Marketplace
            </Link>
            <Link href="/pricing" className="text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-900">
              Pricing
            </Link>
            <Link href="/login" className="text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-900">
              Seller Login
            </Link>
          </div>

          <Link
            href="/pricing"
            className="flex items-center gap-2 rounded-full bg-[#1a2e1a] px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-md transition hover:bg-black active:scale-95"
          >
            Open Your Boutique <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-emerald-900/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 pb-20 pt-16 md:grid-cols-[1.2fr_1fr] md:px-10 md:pb-28 md:pt-24">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5"
            >
              <Sparkles size={13} className="text-[#f0a500]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                The AI Commerce Engine For Africa
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-serif text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"
            >
              Your Products.
              <br />
              Cinematic Production.
              <br />
              <span className="text-[#1a2e1a]">Zero Studios.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600"
            >
              Upload one photo. Sanndikaa&apos;s AI builds a photorealistic luxury scene around your product,
              turns it into a scroll-stopping video ad, and — on the Advanced tier — generates your entire
              storefront website. Enterprise-grade selling, minutes not months.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Link
                href="/pricing"
                className="flex items-center gap-2 rounded-full bg-[#1a2e1a] px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition hover:bg-black active:scale-95"
              >
                Start Selling <ArrowRight size={14} />
              </Link>
              <a
                href="#ai-engine"
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-4 text-xs font-black uppercase tracking-widest text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-95"
              >
                <Play size={13} className="text-[#f0a500]" /> Watch It Work
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.25 }}
          >
            <HeroPhoneMock />
          </motion.div>
        </div>
      </header>

      {/* ── TRUST STRIP ─────────────────────────────────────────────────────── */}
      <section className="border-y border-black/5 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4 md:px-10">
          {[
            { icon: Store, label: 'Boutiques Across West Africa' },
            { icon: ShieldCheck, label: 'Escrow Buyer Protection' },
            { icon: Smartphone, label: 'Mobile Money Ready' },
            { icon: Clapperboard, label: 'AI Ad Studio Built In' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-center gap-3 text-center md:justify-start md:text-left">
              <item.icon size={18} className="shrink-0 text-[#1a2e1a]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI ENGINE GRID ──────────────────────────────────────────────────── */}
      <section id="ai-engine" className="mx-auto max-w-7xl px-4 py-24 md:px-10">
        <motion.div {...reveal} className="mb-14 max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#f0a500]">The AI Engine</p>
          <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight md:text-5xl">
            One photo in. A campaign out.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-600">
            Three enterprise tools, one platform. Every asset is generated to elite Shopify-storefront
            standards — your product pixels stay untouched.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              icon: Clapperboard,
              title: 'Ad Studio',
              body: 'A photorealistic luxury scene composed around your untouched product, animated into a cinematic 9:16 video with editorial captions.',
              accent: 'bg-emerald-50 text-[#1a2e1a]',
            },
            {
              icon: Camera,
              title: 'Magic Auto-Fill',
              body: 'Point the AI at a product photo and get a premium title, description, and tags — written in a voice worthy of the price tag.',
              accent: 'bg-amber-50 text-amber-700',
            },
            {
              icon: Globe,
              title: 'AI Website Generator',
              body: 'Advanced tier: the AI studies your inventory, picks a niche-matched template, and generates your entire storefront — copy, layout, and hero film included.',
              accent: 'bg-violet-50 text-violet-700',
              badge: 'Advanced',
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.1 }}
              className="group relative rounded-[2rem] border border-gray-100 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              {card.badge && (
                <span className="absolute right-6 top-6 flex items-center gap-1 rounded-full bg-[#1a1a1a] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#f0a500]">
                  <Crown size={10} /> {card.badge}
                </span>
              )}
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
                <card.icon size={22} />
              </div>
              <h3 className="mt-6 font-serif text-2xl font-bold">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{card.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="border-y border-black/5 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-10">
          <motion.div {...reveal} className="mb-14 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#f0a500]">How It Works</p>
            <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight md:text-5xl">
              Three steps to your first campaign
            </h2>
          </motion.div>

          <div className="relative grid grid-cols-1 gap-10 md:grid-cols-3">
            {/* Connecting line (desktop) */}
            <div className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden border-t-2 border-dashed border-gray-200 md:block" />

            {[
              { icon: Camera, step: '01', title: 'Upload a photo', body: 'Any product shot — a phone photo works. Pick your category and hit Generate.' },
              { icon: Layers, step: '02', title: 'The AI builds the scene', body: 'Your product is extracted pixel-perfect and placed into a luxury environment with cinematic motion and editorial copy.' },
              { icon: Store, step: '03', title: 'Publish everywhere', body: 'One click sends the video to your product page. Download it for socials. Advanced sellers generate a full website.' },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.12 }}
                className="relative text-center"
              >
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1a2e1a] text-white shadow-lg">
                  <s.icon size={24} />
                </div>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-[#f0a500]">Step {s.step}</p>
                <h3 className="mt-2 font-serif text-xl font-bold">{s.title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-600">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHOWCASE BAND ───────────────────────────────────────────────────── */}
      <section className="bg-[#1a2e1a] py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-10">
          <motion.div {...reveal} className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#f0a500]">The Output Standard</p>
              <h2 className="mt-3 max-w-lg font-serif text-4xl font-bold tracking-tight text-white md:text-5xl">
                Every ad reads like a luxury campaign
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/60">
              Editorial voice, cinematic motion, zero discount-retailer noise. This is the bar the AI holds itself to — for every niche.
            </p>
          </motion.div>

          <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
            {SHOWCASE_FRAMES.map((f, i) => (
              <motion.div
                key={f.hook}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.07 }}
                className={`relative aspect-[9/16] w-48 shrink-0 snap-start overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${f.gradient} shadow-2xl ring-1 ring-white/10 md:w-56`}
              >
                <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-white/90 backdrop-blur-sm">
                  {f.tag}
                </span>
                <div className="absolute inset-x-3 bottom-4">
                  <div className="rounded-lg bg-black/55 px-3 py-2 backdrop-blur-sm">
                    <p className="text-sm font-extrabold leading-snug text-white">{f.hook}</p>
                  </div>
                </div>
                <div className="absolute left-1/2 top-[38%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 blur-xl" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIER TEASER ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24 md:px-10">
        <motion.div {...reveal} className="mb-14 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#f0a500]">Plans</p>
          <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight md:text-5xl">
            Built for every stage of your boutique
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              {...reveal}
              transition={{ ...reveal.transition, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-[2rem] p-8 transition-all duration-300 hover:-translate-y-1 ${
                tier.dark
                  ? 'bg-[#1a1a1a] text-white shadow-2xl'
                  : 'border border-gray-100 bg-white shadow-sm hover:shadow-xl'
              } ${tier.popular ? 'ring-2 ring-emerald-600' : ''}`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                  Most Popular
                </span>
              )}
              {tier.dark && (
                <Crown size={20} className="absolute right-7 top-7 text-[#f0a500]" />
              )}
              <h3 className="font-serif text-2xl font-bold">{tier.name}</h3>
              <p className={`mt-1 text-sm ${tier.dark ? 'text-white/60' : 'text-gray-500'}`}>{tier.blurb}</p>
              <p className="mt-6 font-serif text-4xl font-bold">
                {tier.price}
                <span className={`text-sm font-normal ${tier.dark ? 'text-white/50' : 'text-gray-400'}`}> /month</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check size={15} className={`mt-0.5 shrink-0 ${tier.dark ? 'text-[#f0a500]' : 'text-emerald-600'}`} />
                    <span className={tier.dark ? 'text-white/85' : 'text-gray-700'}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className={`mt-8 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[11px] font-black uppercase tracking-widest transition active:scale-95 ${
                  tier.dark
                    ? 'bg-[#f0a500] text-black hover:bg-amber-400'
                    : 'bg-[#1a2e1a] text-white hover:bg-black'
                }`}
              >
                Compare Plans <ArrowRight size={13} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#1a2e1a] via-[#14240f] to-black py-28">
        <motion.div {...reveal} className="mx-auto max-w-3xl px-4 text-center md:px-10">
          <Wand2 size={28} className="mx-auto text-[#f0a500]" />
          <h2 className="mt-6 font-serif text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
            The boutiques of tomorrow are being generated today.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/60">
            Join Sanndikaa and let the AI produce your ads, your listings, and your website — while you focus on the craft.
          </p>
          <Link
            href="/pricing"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#f0a500] px-10 py-4 text-xs font-black uppercase tracking-widest text-black shadow-2xl transition hover:bg-amber-400 active:scale-95"
          >
            Open Your Boutique <ArrowRight size={14} />
          </Link>
        </motion.div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-10">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            <div className="col-span-2">
              <img src="/logo.png" alt="Sanndikaa" className="h-12 w-auto object-contain" />
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-500">
                The AI commerce engine for Africa&apos;s finest boutiques — cinematic ads, instant listings, generated storefronts.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Shop</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Marketplace</Link></li>
                <li><Link href="/" className="text-sm text-gray-500 transition hover:text-gray-900">Boutique Directory</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sell</p>
              <ul className="mt-4 space-y-2.5">
                <li><Link href="/pricing" className="text-sm text-gray-500 transition hover:text-gray-900">Pricing</Link></li>
                <li><Link href="/login" className="text-sm text-gray-500 transition hover:text-gray-900">Seller Login</Link></li>
                <li><Link href="/pricing" className="text-sm text-gray-500 transition hover:text-gray-900">Open Your Boutique</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 md:flex-row">
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} Sanndikaa. All rights reserved.</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Made for Africa&apos;s Finest</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
