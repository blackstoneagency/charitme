import Image from 'next/image';
import { Heart, Play, Users, Trophy, Globe, Shirt, Whistle, Footprints, GraduationCap } from 'lucide-react';
import type { Campaign, Story, Stat } from '@/lib/queries';
import { money, pct } from '@/lib/queries';

/* ── Hero ──────────────────────────────────────────────────────────────────
   White copy over a photographic scrim. The scrim is painted on the SECTION,
   not a pseudo-element: a ::before is not an ancestor background, so a contrast
   checker resolves the text against the page and reports white-on-white. */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero">
      <div className="absolute inset-y-0 right-0 hidden w-[58%] md:block">
        <Image
          src="https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1400&q=70"
          alt="" fill priority sizes="58vw" className="object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-hero-scrim" />
      <div className="relative mx-auto max-w-[1280px] px-5 pb-14 pt-7 md:px-10 md:pb-20">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap gap-2 text-[13px] text-white/60">
            <li><a href="/" className="hover:text-white hover:underline">Home</a></li>
            <li aria-hidden="true">›</li>
            <li><a href="/causes" className="hover:text-white hover:underline">Causes</a></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="font-semibold text-white">Sports &amp; Youth</li>
          </ol>
        </nav>
        <div className="mt-7 max-w-[34rem]">
          <h1 className="flex items-center gap-3 text-hero text-white">
            Sports &amp; Youth
            <Heart className="h-[0.6em] w-[0.6em] text-heart" aria-hidden="true" />
          </h1>
          <p className="mt-3 text-[15px] font-bold text-brand">Building champions. Building futures.</p>
          <p className="mt-4 text-[15.5px] leading-relaxed text-white/80">
            Every kid deserves the chance to play, grow, and dream big. Your support provides gear,
            coaching, mentorship, and safe spaces for young athletes to thrive on and off the field.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="/campaigns?cause=sports-youth" className="cta-primary">Donate now</a>
            <a href="/create" className="btn-secondary">Start a fundraiser →</a>
          </div>
        </div>
      </div>
    </section>
  );
}

const STAT_ICONS = [Users, Heart, Trophy, Globe];

/* ── Impact band ─────────────────────────────────────────────────────────── */
export function ImpactBand({ stats }: { stats: Stat[] }) {
  return (
    <section aria-labelledby="impact-title" className="bg-canvas">
      <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-8 md:grid-cols-[320px_1fr] md:px-10">
        <div>
          <h2 id="impact-title" className="flex items-center gap-2 text-[22px] font-extrabold leading-tight">
            Real Impact. Real Champions.
            <Heart className="h-5 w-5 text-heart" aria-hidden="true" />
          </h2>
          <p className="mt-2 max-w-[40ch] text-sm text-ink-3">
            Thanks to supporters like you, young athletes achieve more every day.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s, i) => {
            const Icon = STAT_ICONS[i] ?? Users;
            return (
              <div key={s.label} className="flex flex-col items-center gap-1 text-center">
                <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-brand">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <dd className="text-stat">{s.value}</dd>
                <dt className="text-[12.5px] text-ink-3">{s.label}</dt>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

/* ── Filter tabs ─────────────────────────────────────────────────────────── */
const TABS = [
  { href: '/campaigns?cause=sports-youth', label: 'All campaigns' },
  { href: '/events?cause=sports-youth', label: 'Events' },
  { href: '/teams?cause=sports-youth', label: 'Teams & clubs' },
  { href: '/volunteer', label: 'Volunteer' },
  { href: '/success-stories', label: 'Stories' },
  { href: '/impact', label: 'Impact reports' },
];

export function Tabs() {
  return (
    <nav aria-label="More in Sports & Youth" className="mx-auto max-w-[1280px] px-5 md:px-10">
      <ul className="flex flex-wrap gap-2.5">
        {TABS.map((t) => (
          <li key={t.href}>
            <a href={t.href}
               className="inline-flex min-h-[44px] items-center rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink">
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Campaign grid ───────────────────────────────────────────────────────── */
export function CampaignGrid({ campaigns }: { campaigns: Campaign[] | null }) {
  if (campaigns === null) {
    return (
      <p className="mx-auto max-w-[1280px] px-5 py-10 text-sm text-ink-3 md:px-10">
        We could not load these campaigns just now.{' '}
        <a href="/causes/sports-youth" className="font-bold text-brand hover:underline">Try again</a>.
      </p>
    );
  }
  if (campaigns.length === 0) {
    return (
      <p className="mx-auto max-w-[1280px] px-5 py-10 text-sm text-ink-3 md:px-10">
        No live campaigns in this cause yet.{' '}
        <a href="/create" className="font-bold text-brand hover:underline">Start the first one</a>.
      </p>
    );
  }
  return (
    <ul className="mx-auto grid max-w-[1280px] gap-[18px] px-5 py-7 sm:grid-cols-2 lg:grid-cols-3 md:px-10">
      {campaigns.map((c) => {
        const p = pct(c.raised_amount, c.goal_amount);
        return (
          <li key={c.id}>
            <a href={`/campaigns/${c.slug}`}
               className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-line-strong">
              <span className="relative block aspect-[16/10] bg-surface-3">
                <Image src={c.cover_image_url ?? 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70'}
                       alt="" fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  {c.category}
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-2 p-4">
                <strong className="text-[15.5px] font-bold leading-snug">{c.title}</strong>
                {c.tagline && <span className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-3">{c.tagline}</span>}
                <span className="mt-auto pt-2">
                  <span className="flex items-baseline justify-between text-[13px]">
                    <b className="text-ink">{money(c.raised_amount)}</b>
                    <span className="text-ink-3">of {money(c.goal_amount)}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-grad-brand" style={{ width: `${p}%` }} />
                  </span>
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/* ── How Your Support Helps ──────────────────────────────────────────────── */
const HELPS = [
  { icon: Shirt, cls: 'bg-accent-gear', title: 'Provide Gear', body: 'Equip kids with the gear they need to play and succeed.', img: '1517649763962-0c623066013b' },
  { icon: Whistle, cls: 'bg-accent-coach', title: 'Fund Coaching', body: 'Invest in quality coaching and mentorship that builds skills and confidence.', img: '1526232761682-d26e03ac148e' },
  { icon: Footprints, cls: 'bg-accent-run', title: 'Create Opportunities', body: 'Support leagues, clinics, and programs that open doors for every kid.', img: '1544620347-c4fd4a3d5957' },
  { icon: Users, cls: 'bg-accent-community', title: 'Build Community', body: 'Strengthen communities through teamwork, inclusion, and belonging.', img: '1509099836639-18ba1795216d' },
  { icon: GraduationCap, cls: 'bg-accent-learn', title: 'Support Beyond Sports', body: 'Encourage education, life skills, and leadership on and off the field.', img: '1497486751825-1233686d5d80' },
];

export function Helps() {
  return (
    <section aria-labelledby="helps-title" className="mx-auto max-w-[1280px] px-5 py-10 md:px-10">
      <h2 id="helps-title" className="text-center text-h2">
        How Your Support Helps
        <span aria-hidden="true" className="mx-auto mt-3 block h-[3px] w-[54px] rounded-full bg-grad-brand" />
      </h2>
      <ul className="mt-6 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-5">
        {HELPS.map(({ icon: Icon, cls, title, body, img }) => (
          <li key={title} className="overflow-hidden rounded-card border border-line bg-surface">
            <span className="relative block aspect-[16/10] bg-surface-3">
              <Image src={`https://images.unsplash.com/photo-${img}?auto=format&fit=crop&w=640&q=70`}
                     alt="" fill sizes="(max-width:640px) 100vw, 20vw" className="object-cover" />
            </span>
            <span className={`relative -mt-6 ml-4 flex h-11 w-11 items-center justify-center rounded-full text-white ${cls}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mx-4 mt-3 text-[15.5px] font-bold leading-snug">{title}</h3>
            <p className="mx-4 mb-4 mt-2 text-[13.5px] leading-relaxed text-ink-3">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Stories from the Field ──────────────────────────────────────────────── */
const CHIP = ['bg-accent-gear', 'bg-accent-coach', 'bg-accent-run'];

export function Stories({ stories }: { stories: Story[] | null }) {
  if (!stories || stories.length === 0) return null;
  return (
    <section aria-labelledby="stories-title" className="mx-auto max-w-[1280px] px-5 py-10 md:px-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="stories-title" className="text-h2">Stories from the Field</h2>
        <a href="/success-stories" className="text-[13.5px] font-bold text-brand hover:underline">View All Stories →</a>
      </header>
      <ul className="mt-5 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((s, i) => (
          <li key={s.id}>
            {/* The play control renders ONLY when video_url is set. A button over
                a card with nothing behind it is a control that does nothing. */}
            <a href={s.video_url ?? '/success-stories'}
               {...(s.video_url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
               className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-line-strong">
              <span className="relative block aspect-[16/10] bg-surface-3">
                <Image src={s.poster_url ?? 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70'}
                       alt="" fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover" />
                {s.chip_label && (
                  <span className={`absolute left-3 top-3 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-white ${CHIP[s.chip_accent] ?? CHIP[0]}`}>
                    {s.chip_label}
                  </span>
                )}
                {s.video_url && (
                  <span aria-hidden="true"
                        className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/90 bg-black/40 text-white backdrop-blur-sm transition-colors group-hover:bg-black/60">
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </span>
                )}
              </span>
              <span className="flex flex-1 flex-col gap-2 p-4">
                <strong className="text-[15.5px] font-bold leading-snug">{s.title}</strong>
                {s.blurb && <span className="text-[13.5px] leading-relaxed text-ink-3">{s.blurb}</span>}
                <span className="mt-auto pt-2 text-[13.5px] font-bold text-brand">
                  {s.video_url ? 'Watch Story →' : 'Read the story →'}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Closing band ────────────────────────────────────────────────────────── */
export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-[1280px] px-5 pb-14 md:px-10">
      <div className="grid items-center gap-4 rounded-xl2 border border-line bg-surface-2 p-6 md:grid-cols-[auto_1fr_auto]">
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full border border-heart/40 text-heart">
          <Heart className="h-8 w-8" />
        </span>
        <div>
          <h2 id="cta-title" className="text-[19px] font-extrabold">Be Part of Their Journey</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            Your donation today helps young athletes dream bigger, work harder, and go further.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/campaigns?cause=sports-youth" className="cta-primary">Donate Now</a>
          <a href="/create" className="btn-secondary !border-line-strong !bg-surface !text-ink">Start a Fundraiser →</a>
        </div>
      </div>
    </section>
  );
}
