import type { Metadata } from 'next';
import {
  ReferenceCta,
  ReferenceHero,
  ReferenceIconGrid,
  ReferencePage,
  ReferenceQuote,
  ReferenceSection,
  ReferenceStats,
  ReferenceSteps,
} from '../../../components/ReferenceMarketing';
import { getPublicOpportunities, getVolunteerCategories } from '../../../lib/volunteers-server';
import VolunteerClient from '../VolunteerClient';

export const metadata: Metadata = {
  title: 'Volunteer - Give Your Time',
  description: 'Find volunteer opportunities by cause, skill, location, and remote availability, then apply and track your service through CharitMe.',
  alternates: { canonical: 'https://www.charitme.com/volunteer' },
};

export const dynamic = 'force-dynamic';

const BENEFITS = [
  { icon: 'heart', title: 'Create Real Impact', body: 'Put your time behind work a community has already identified.' },
  { icon: 'briefcase', title: 'Use Your Skills', body: 'Match professional or practical experience to an active need.' },
  { icon: 'people', title: 'Meet Your Community', body: 'Build relationships with people working toward the same outcome.' },
  { icon: 'award', title: 'Track Your Service', body: 'Keep applications and verified volunteer hours in your dashboard.' },
];

const STEPS = [
  { icon: 'search', title: 'Explore', body: 'Search by cause, skill, location, or remote work.' },
  { icon: 'document', title: 'Review', body: 'Read the role, organization, timing, and requirements.' },
  { icon: 'edit', title: 'Apply', body: 'Send a short application through your CharitMe account.' },
  { icon: 'people', title: 'Connect', body: 'Coordinate details directly with the organization.' },
  { icon: 'heart', title: 'Make an Impact', body: 'Serve, track your time, and stay involved.' },
];

export default async function VolunteerPage() {
  const [opportunityResult, categories] = await Promise.all([getPublicOpportunities(48), getVolunteerCategories()]);

  // `null` = the read FAILED; `[]` = there genuinely are none. The tiles below
  // render an em dash for the first and a real 0 for the second, because "we
  // could not read this" and "there are none" are different claims — and the
  // page previously made the confident one on an outage.
  const readFailed = opportunityResult === null;
  const opportunities = opportunityResult ?? [];
  const countLabel = (n: number) => (readFailed ? '—' : n.toLocaleString());
  const remoteCount = opportunities.filter((opportunity) => opportunity.is_remote).length;
  const verifiedCount = opportunities.filter((opportunity) => opportunity.verified).length;
  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Get Involved', href: '/get-involved' }, { label: 'Volunteer' }]}
        eyebrow="Volunteer"
        title={<>Your Time.<br />Their Tomorrow.<br /><span className="rp-accent">Make a Difference.</span></>}
        lede="Find meaningful ways to give back in your community and around the world. Every hour you give helps build a better future."
        search={{ action: '/volunteer', placeholder: 'Search volunteer opportunities...' }}
        image="/images/reference/volunteer-hero.jpg"
        imageAlt="Volunteers working together at a community organization"
        callout={{ icon: 'people', title: 'Together, we can create stronger communities and lasting change.', body: 'Start with one opportunity.' }}
        variant="catalog"
      />

      <ReferenceStats items={[
        { icon: 'hand', value: countLabel(opportunities.length), label: 'Opportunities shown' },
        { icon: 'tag', value: categories.length.toLocaleString(), label: 'Categories available' },
        { icon: 'globe', value: countLabel(remoteCount), label: 'Remote roles shown' },
        { icon: 'shield', value: countLabel(verifiedCount), label: 'Verified roles shown' },
      ]} />

      <div id="opportunities">
        <ReferenceSection title="Featured Volunteer Opportunities" intro="Search live listings and narrow them by category or remote availability.">
          <div className="rp-live-panel"><VolunteerClient initialOpportunities={opportunities} categories={categories} /></div>
        </ReferenceSection>
      </div>

      <ReferenceSection title="Why Volunteer With CharitMe">
        <ReferenceIconGrid items={BENEFITS} columns={4} />
      </ReferenceSection>

      <ReferenceSection title="How Volunteering Works">
        <ReferenceSteps items={STEPS} />
      </ReferenceSection>

      <ReferenceSection title="Service Creates Connection">
        <div className="rp-split">
          <ReferenceQuote quote="I found a role that used skills I already had and introduced me to people doing meaningful work in my own community." name="CharitMe Volunteer" context="Community program volunteer" />
          <ReferenceQuote quote="A reliable volunteer gives a small team breathing room. The right match is often worth more than an extra pair of hands." name="Nonprofit Organizer" context="Volunteer coordinator" />
        </div>
      </ReferenceSection>

      <ReferenceCta
        icon="hand"
        title="Ready to Give Your Time?"
        body="Explore live roles or help an organization reach volunteers by listing an opportunity."
        actions={[
          { label: 'Explore Opportunities', href: '#opportunities' },
          { label: 'List an Opportunity', href: '/dashboard/volunteer', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
