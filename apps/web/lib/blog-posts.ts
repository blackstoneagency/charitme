// ─────────────────────────────────────────────────────────────────────────────
// Static blog content library.
// Each post renders at /blog/[slug] with full SEO metadata + JSON-LD.
// Content blocks are a small discriminated union so the renderer stays simple.
// ─────────────────────────────────────────────────────────────────────────────

export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'ul'; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  publishedAt: string; // ISO date
  readTimeMinutes: number;
  content: BlogBlock[];
  cta: { label: string; href: string };
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'write-a-campaign-story-donors-trust',
    title: 'How to write a campaign story donors trust',
    category: 'AI Fundraising',
    excerpt:
      'Structure, proof, and emotion — the three ingredients that help supporters understand the need in under thirty seconds and feel safe giving.',
    publishedAt: '2026-06-01',
    readTimeMinutes: 7,
    content: [
      { type: 'p', text: 'Most campaign stories fail in the first three sentences. Donors arrive with two questions — "what happened?" and "can I trust this?" — and if either goes unanswered, they leave. The good news: a trustworthy story follows a learnable structure, and you don\'t need to be a writer to use it.' },
      { type: 'h2', text: 'Open with the moment, not the backstory' },
      { type: 'p', text: 'Start at the turning point. "On March 4th, my sister Maria was diagnosed with stage 3 lymphoma" works better than three paragraphs of family history. Donors read the first two sentences and decide whether to keep reading — spend them on the single most important fact.' },
      { type: 'h2', text: 'The three-part structure that works' },
      { type: 'ul', items: [
        'The situation — what happened, to whom, and when. Be specific with names, dates, and places (as much as you\'re comfortable sharing).',
        'The need — exactly what the money pays for, broken into concrete line items. "$8,000 covers two rounds of chemotherapy co-pays and six weeks of lost wages" beats "we need help with expenses."',
        'The ask — what reaching the goal makes possible, and what happens if you fall short. Donors give more when they understand the stakes.',
      ]},
      { type: 'h2', text: 'Proof beats polish' },
      { type: 'p', text: 'A perfectly written story with no verification loses to a rough one with receipts. Add photos that match your story, link any news coverage, and complete identity verification before you share the campaign widely. On CharitMe, verified organizers display a trust badge and a CharitScore™ — donors check these before giving.' },
      { type: 'quote', text: 'Donors don\'t expect perfect writing. They expect specific facts, a clear plan for the money, and a real person behind the campaign.' },
      { type: 'h2', text: 'Let AI handle the blank page' },
      { type: 'p', text: 'If you\'re staring at an empty text box, the CharitMe campaign copilot drafts a structured story from a few details — what happened, who it\'s for, what the funds cover — and you edit it into your own voice. The best campaigns use AI for structure and humans for honesty.' },
      { type: 'h3', text: 'Before you publish, check these five things' },
      { type: 'ul', items: [
        'The first sentence states what happened.',
        'The goal amount is itemized into real costs.',
        'At least one photo shows the person or cause by name.',
        'Your identity is verified and payouts are connected.',
        'A friend who knows nothing about the situation can summarize it back to you after one read.',
      ]},
    ],
    cta: { label: 'Start a campaign with AI help', href: '/create' },
  },
  {
    slug: 'five-updates-that-keep-donations-moving',
    title: 'Five updates that keep donations moving after launch day',
    category: 'Growth',
    excerpt:
      'Campaigns that post updates raise dramatically more than those that go quiet. Here is the update cadence and the five formats that re-activate donors.',
    publishedAt: '2026-05-22',
    readTimeMinutes: 6,
    content: [
      { type: 'p', text: 'The typical campaign raises a third of its total in the first 72 hours, then flatlines. The difference between campaigns that stall and campaigns that climb is almost always the same thing: updates. Every update is a new reason for past donors to share and new visitors to give.' },
      { type: 'h2', text: '1. The milestone update' },
      { type: 'p', text: 'When you cross 25%, 50%, or 75% of goal, say so — and thank the people who got you there. Milestones convert because they signal momentum, and momentum is the strongest social proof a campaign has. If you\'ve set up stretch goals on your campaign page, each one you hit is a ready-made update.' },
      { type: 'h2', text: '2. The "where the money went" update' },
      { type: 'p', text: 'Post a photo of the receipt, the repaired roof, the first treatment session. Nothing re-activates lapsed donors like evidence their money did what you said it would. This is also the update most likely to be shared by donors to their own networks.' },
      { type: 'h2', text: '3. The personal progress update' },
      { type: 'p', text: 'How is the person at the center of the campaign actually doing? A two-paragraph update with one new photo outperforms a long essay. Write it like a text message to a friend who has been asking.' },
      { type: 'h2', text: '4. The deadline update' },
      { type: 'p', text: 'Real deadlines move money: a surgery date, a rent due date, an end-of-month matching offer. If your campaign has a genuine time constraint, every update should mention it. If an employer is matching donations, remind donors to check the employer-match tool at checkout — it can double a gift at no cost to them.' },
      { type: 'h2', text: '5. The thank-you roll call' },
      { type: 'p', text: 'Once a week, thank recent donors by first name (or "Anonymous"). Donors who feel seen give again — repeat donations make up a meaningful share of most successful campaigns, and they almost always follow a thank-you.' },
      { type: 'h3', text: 'Cadence that works' },
      { type: 'ul', items: [
        'Days 1–7: every other day while momentum is highest.',
        'Weeks 2–4: twice a week, alternating formats.',
        'After week 4: weekly, anchored to milestones and real news.',
        'Always: within 24 hours of any major development, good or bad.',
      ]},
      { type: 'p', text: 'Every update you publish on CharitMe notifies your donors automatically and appears on your public campaign page — so each one is working for you even while you sleep.' },
    ],
    cta: { label: 'See campaign growth features', href: '/features' },
  },
  {
    slug: 'what-donors-look-for-before-giving',
    title: 'What donors look for before giving (and how to show it)',
    category: 'Trust & Safety',
    excerpt:
      'Donors run a quiet checklist before entering a card number. Pass it and conversion doubles; fail one item and most quietly leave.',
    publishedAt: '2026-05-15',
    readTimeMinutes: 6,
    content: [
      { type: 'p', text: 'Online donors have learned to be careful. Before giving to a stranger\'s campaign, most run a quick mental checklist — usually in under a minute, usually without telling anyone. Organizers who understand the checklist can address every item up front.' },
      { type: 'h2', text: 'The donor\'s checklist' },
      { type: 'ul', items: [
        'Is there a real, identifiable person behind this? Full name, clear photos, a story with verifiable details.',
        'Is the goal amount justified? Itemized costs read as honest; round numbers with no breakdown read as arbitrary.',
        'Is money already flowing? A campaign with recent donations and a visible donor wall feels safe to join.',
        'Are there updates? An active organizer signals an active, real situation.',
        'What happens to the money if the goal isn\'t met? Say it explicitly — donors fill silence with worst-case assumptions.',
      ]},
      { type: 'h2', text: 'Verification is the strongest signal' },
      { type: 'p', text: 'On CharitMe, organizers verify identity through Stripe\'s banking-grade KYC process before receiving payouts, and verified campaigns display a public trust badge. Campaigns also carry a CharitScore™ — an at-a-glance trust rating factoring verification, update activity, and transparency. Completing verification on day one is the single highest-leverage trust move an organizer can make.' },
      { type: 'h2', text: 'Transparency closes the loop' },
      { type: 'quote', text: 'Donors don\'t demand perfection. They demand the absence of red flags — and the presence of one green one.' },
      { type: 'p', text: 'A transparency ledger — a public record of what the raised money was spent on — turns one-time donors into advocates. CharitMe campaigns can publish spend entries that appear directly on the campaign page, something no major competitor offers natively.' },
      { type: 'h3', text: 'For donors: your 60-second safety check' },
      { type: 'ul', items: [
        'Look for the verification badge and CharitScore on the campaign page.',
        'Read the most recent update — when was it posted?',
        'Check the donor wall for steady, recent activity.',
        'Search the organizer\'s name plus a key detail from the story.',
        'When in doubt, donate a small amount first and watch how the campaign behaves.',
      ]},
    ],
    cta: { label: 'How CharitMe keeps donors safe', href: '/trust-safety' },
  },
  {
    slug: 'recurring-donations-playbook-for-nonprofits',
    title: 'The recurring donations playbook for nonprofits',
    category: 'Nonprofits',
    excerpt:
      'Monthly donors are worth several times a one-time gift over their lifetime. How to ask, what to offer, and the checkout details that move the needle.',
    publishedAt: '2026-05-08',
    readTimeMinutes: 8,
    content: [
      { type: 'p', text: 'A $25 monthly donor contributes $300 a year — and the average monthly donor keeps giving for years. For nonprofits, recurring revenue is the difference between planning programs and praying for them. Yet most fundraising pages still treat monthly giving as an afterthought checkbox.' },
      { type: 'h2', text: 'Make monthly the suggested path, not the alternative' },
      { type: 'p', text: 'Position matters. A frequency toggle shown before the amount — with monthly visually highlighted — converts far better than a small checkbox below the card form. CharitMe\'s donate flow puts the once/monthly choice front and center, with a gentle nudge showing what a monthly gift accomplishes over a year.' },
      { type: 'h2', text: 'Anchor the monthly ask lower' },
      { type: 'p', text: 'Donors think in budgets, not totals. The right monthly ask is roughly 20–40% of your typical one-time gift: if one-time donors give $100, suggest $25/month. The annual value is higher and the commitment feels lighter.' },
      { type: 'h2', text: 'Give monthly donors a name and a reason' },
      { type: 'ul', items: [
        'Name the program: "The Lighthouse Circle" outperforms "monthly giving" every time.',
        'Attach a concrete unit of impact: "$15/month keeps one student in the after-school program."',
        'Recognize them: giving levels, badges, and streaks give monthly donors a visible identity. CharitMe tracks giving streaks and levels automatically on donor profiles.',
      ]},
      { type: 'h2', text: 'Reduce the friction nobody talks about' },
      { type: 'p', text: 'Recurring gifts die at the payment step. Offering wallet payments — Apple Pay, Google Pay, Link — means donors never type a card number, which matters even more for a recurring commitment. CharitMe checkout supports these for monthly gifts out of the box, and donors can manage or cancel their recurring gift themselves, which paradoxically increases retention: people commit more readily when they know they can leave.' },
      { type: 'h2', text: 'The retention calendar' },
      { type: 'ul', items: [
        'Day 1: instant receipt plus a personal-feeling welcome.',
        'Month 1: a "here\'s what your first gift did" update.',
        'Quarterly: impact summary tied to their cumulative giving.',
        'Month 11: anniversary thank-you — just gratitude, no upgrade ask.',
        'Any failed payment: a friendly retry note, never a guilt trip.',
      ]},
      { type: 'p', text: 'Nonprofits on CharitMe get recurring checkout, donor self-service, automatic update notifications, and donor recognition built in — no add-on fees, no third-party tools to stitch together.' },
    ],
    cta: { label: 'CharitMe for nonprofits', href: '/for-nonprofits' },
  },
  {
    slug: 'how-fast-payouts-work',
    title: 'How fast payouts work on CharitMe',
    category: 'Payouts',
    excerpt:
      'Standard, same-day, and instant payout options explained — how the money moves, what verification is required, and how to avoid the common delays.',
    publishedAt: '2026-04-29',
    readTimeMinutes: 5,
    content: [
      { type: 'p', text: 'When you\'re fundraising for an emergency, payout speed isn\'t a nice-to-have — it\'s the whole point. Here\'s exactly how money moves from a donor\'s card to your bank account on CharitMe, and how to make it as fast as possible.' },
      { type: 'h2', text: 'The pipeline' },
      { type: 'ul', items: [
        'A donor completes checkout — the payment is processed immediately by Stripe, our payment partner.',
        'Funds settle to your connected account after standard card processing.',
        'Payouts transfer to your bank on your payout schedule — standard transfers typically arrive in about 2 business days.',
        'Eligible accounts can request instant payouts to a supported debit card, arriving in minutes.',
      ]},
      { type: 'h2', text: 'Verification: do it before you need the money' },
      { type: 'p', text: 'The single biggest cause of payout delays is incomplete verification. Identity verification (KYC) is a banking regulation, not a CharitMe policy — every platform requires it. Connect your bank and complete verification when you create the campaign, not when you need the first payout. It takes a few minutes with a government ID.' },
      { type: 'h2', text: 'What can slow a payout down' },
      { type: 'ul', items: [
        'Name mismatch between your ID, bank account, and campaign organizer profile.',
        'A sudden spike in donations that triggers a routine review — large viral moments are verified to protect donors.',
        'Bank-side processing windows: weekends and holidays pause standard transfers (instant payouts still work).',
      ]},
      { type: 'h2', text: 'Fees, stated plainly' },
      { type: 'p', text: 'CharitMe shows the full fee breakdown at checkout — platform fee and payment processing — before a donor confirms. Donors can opt to cover fees so your campaign keeps more, and the itemized math is always visible. No surprises on either side of the transaction.' },
      { type: 'quote', text: 'Rule of thumb: verify on day one, connect your bank on day one, and the money will never be the bottleneck.' },
    ],
    cta: { label: 'Read the fast payouts guide', href: '/fast-payouts' },
  },
  {
    slug: 'donor-trust-signals-checklist',
    title: 'Six trust signals every donor should check before giving',
    category: 'Donors',
    excerpt:
      'A practical 60-second checklist for evaluating any online fundraiser — what verification badges mean, which red flags matter, and when to walk away.',
    publishedAt: '2026-04-18',
    readTimeMinutes: 5,
    content: [
      { type: 'p', text: 'Online fundraising moves billions of dollars a year, and the overwhelming majority of campaigns are exactly what they claim to be. But "overwhelming majority" isn\'t "all" — and a careful donor can tell the difference in about a minute. Here\'s the checklist.' },
      { type: 'h2', text: '1. Identity verification' },
      { type: 'p', text: 'On CharitMe, organizers must pass banking-grade identity verification before withdrawing a cent. Look for the verified badge on the campaign page. An unverified campaign isn\'t necessarily fraudulent — it may be new — but verified means a real, government-ID-checked person is accountable for the funds.' },
      { type: 'h2', text: '2. The trust score' },
      { type: 'p', text: 'CharitMe assigns every campaign a CharitScore™ that factors verification status, update activity, account history, and transparency. It\'s the fastest single signal on the page. Behind the scenes, automated risk scoring also flags anomalous campaigns for human review before donors ever see them.' },
      { type: 'h2', text: '3. Specifics in the story' },
      { type: 'p', text: 'Real situations produce specific details: names, dates, places, itemized costs. Vague stories ("a family in need," "medical expenses") deserve more scrutiny. Reverse-image-search the photos if something feels off — recycled images are the most common fraud tell.' },
      { type: 'h2', text: '4. Update history' },
      { type: 'p', text: 'Scroll the updates. A real campaign accumulates a paper trail — progress notes, thank-yous, photos. Silence since launch day is a yellow flag on any campaign older than a couple of weeks.' },
      { type: 'h2', text: '5. The donor wall' },
      { type: 'p', text: 'Steady donations from many small donors — visible on the campaign\'s donor wall — is organic support. Be more careful with campaigns showing only one or two large anonymous gifts and no community around them.' },
      { type: 'h2', text: '6. Where the money goes' },
      { type: 'p', text: 'The strongest campaigns publish a transparency ledger showing what raised funds were spent on. If it\'s there, read it. If it isn\'t, a sincere organizer will answer a polite question about fund usage — and how they respond tells you plenty.' },
      { type: 'quote', text: 'If a campaign fails two or more of these checks, give somewhere else. There is always a verified campaign serving the same cause.' },
      { type: 'p', text: 'See something that doesn\'t add up? Every CharitMe campaign has a report button, and every report is reviewed. Donors are the immune system of honest fundraising.' },
    ],
    cta: { label: 'How CharitMe protects donors', href: '/for-donors' },
  },
  {
    slug: 'team-fundraising-guide',
    title: 'Team fundraising: how to multiply a campaign through people',
    category: 'Growth',
    excerpt:
      'One organizer has one network. A team of ten has ten. How peer-to-peer team fundraising works and how to run a team that actually raises.',
    publishedAt: '2026-04-09',
    readTimeMinutes: 6,
    content: [
      { type: 'p', text: 'The math of fundraising is the math of networks. A single organizer can reach their own friends, family, and followers — call it a few hundred people. Add nine teammates and the realistic audience grows by an order of magnitude, with each ask coming from a trusted voice rather than a stranger.' },
      { type: 'h2', text: 'What team fundraising actually is' },
      { type: 'p', text: 'On CharitMe, a campaign organizer can invite co-organizers and team members with defined roles and permissions. Teammates share the campaign through their own personal referral links, and every donation they drive is tracked back to them — fueling friendly competition and a site-wide leaderboard.' },
      { type: 'h2', text: 'Recruiting a team that shows up' },
      { type: 'ul', items: [
        'Recruit asks, not titles: each teammate commits to a number of personal asks (ten texts beats one broadcast post).',
        'Give everyone a first-day script: a two-sentence personal message template they can adapt in 30 seconds.',
        'Set a team kickoff moment: launching together creates the early momentum spike that drives a campaign\'s first-week curve.',
      ]},
      { type: 'h2', text: 'Use the scoreboard' },
      { type: 'p', text: 'People raise more when progress is visible. CharitMe\'s referral tracking shows each member exactly how many visits and donations their link produced, and top fundraisers appear on the public leaderboard. A weekly "top 3 this week" shoutout in your team chat costs nothing and reliably lifts totals.' },
      { type: 'h2', text: 'Don\'t forget employer matching' },
      { type: 'p', text: 'Teams are usually colleagues — and colleagues often work for companies with donation-matching programs. The employer-match lookup built into every CharitMe donate flow lets each donor check in seconds whether their company will double their gift. For corporate teams, matching can be the largest single multiplier available.' },
      { type: 'h3', text: 'A simple weekly team rhythm' },
      { type: 'ul', items: [
        'Monday: organizer posts a campaign update; everyone shares it with their link.',
        'Wednesday: each member makes three personal asks.',
        'Friday: leaderboard shoutout plus thank-yous to the week\'s donors.',
      ]},
    ],
    cta: { label: 'Start a team campaign', href: '/create' },
  },
  {
    slug: 'ai-tools-that-actually-help-fundraisers',
    title: 'The AI tools that actually help fundraisers (and the ones that don\'t)',
    category: 'AI Fundraising',
    excerpt:
      'AI can draft your story, plan your outreach, and diagnose a stalled campaign — or it can generate generic noise. Where AI genuinely moves money raised.',
    publishedAt: '2026-03-30',
    readTimeMinutes: 7,
    content: [
      { type: 'p', text: 'Every fundraising platform now claims to be "AI-powered." Most of it is a thin chat window. The useful question for an organizer is narrower: at which specific moments does AI measurably increase money raised? After building AI into every stage of the CharitMe campaign lifecycle, here\'s the honest answer.' },
      { type: 'h2', text: 'Where AI genuinely helps' },
      { type: 'h3', text: '1. Beating the blank page' },
      { type: 'p', text: 'The biggest drop-off in campaign creation is the story field. An AI copilot that turns five plain-language answers into a structured first draft gets organizers past the hardest step — and a campaign that launches today raises more than a perfect one that launches never. The draft should be a starting point you personalize, not copy verbatim: donors can smell generic text.' },
      { type: 'h3', text: '2. Goal-setting sanity checks' },
      { type: 'p', text: 'Organizers routinely set goals by gut feel. AI that suggests a goal from your itemized costs — and warns when a goal is implausibly round or high for the category — produces goals donors find credible. Credible goals get funded.' },
      { type: 'h3', text: '3. The always-on coach' },
      { type: 'p', text: 'Most organizers are first-timers who don\'t know what "normal" looks like. CharitMe\'s AI coach reads your campaign\'s actual stats — traffic, conversion, update cadence, days since launch — and answers questions like "why did donations stop?" with specific, situational advice instead of generic tips.' },
      { type: 'h3', text: '4. Channel-ready content' },
      { type: 'p', text: 'A campaign update needs to become an Instagram caption, a tweet-length blurb, and an email — three formats, one message. AI handles reformatting flawlessly, which means updates actually get shared instead of staying on the campaign page.' },
      { type: 'h2', text: 'Where AI doesn\'t help' },
      { type: 'ul', items: [
        'Faking emotion: AI-written sob stories read as hollow and damage trust. Facts from AI, feelings from you.',
        'Mass cold outreach: AI-generated spam to strangers burns reputation for pennies. Fundraising runs on warm networks.',
        'Replacing photos and updates: no language model substitutes for one real photo of where the money went.',
      ]},
      { type: 'quote', text: 'The rule: use AI for structure, speed, and analysis. Use yourself for truth.' },
      { type: 'p', text: 'CharitMe is the only major fundraising platform with a full AI suite — campaign copilot, fundraising coach, and growth planner — built natively into the product at no extra cost.' },
    ],
    cta: { label: 'Explore AI fundraising tools', href: '/ai-fundraising' },
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}
