import type { Metadata } from 'next';
import { requireUser } from '../../../lib/auth';
import { listOrganizerEvents } from '../../../lib/events';
import { EVENT_TYPES } from '../../../lib/events-core';
import ManageEvents from './ManageEvents';

export const metadata: Metadata = {
  title: 'Manage Events',
  description: 'Host fundraising events and check attendees in.',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function ManageEventsPage() {
  const user = await requireUser();
  const events = await listOrganizerEvents(user.id);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 880 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Manage Events</h1>
        <p style={{ color: 'var(--t3)', fontSize: 15 }}>Host an event, share it, and check attendees in on the day.</p>
      </div>
      <ManageEvents initialEvents={events} eventTypes={[...EVENT_TYPES]} />
    </div>
  );
}
