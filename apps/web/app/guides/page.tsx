import { permanentRedirect } from 'next/navigation';

// Design 22 is the "Resources / Guides listing" — and that page already exists at
// /resources: an index over every guide, report and reference page on the site,
// each card pointing at something that really returns 200.
//
// So /guides is a REDIRECT, not a second listing. Building it as its own page
// would mean two indexes over one set of guides, and the second one starts
// drifting the day someone adds a guide to only one of them. The repo has already
// paid this cost once, with three hand-maintained copies of CAMPAIGN_CATEGORIES.
//
// 308 rather than 307 because this is a permanent piece of information
// architecture, not a temporary detour: it lets search engines and anything that
// bookmarked /guides transfer to the real page instead of re-resolving forever.
export default function GuidesPage() {
  permanentRedirect('/resources');
}
