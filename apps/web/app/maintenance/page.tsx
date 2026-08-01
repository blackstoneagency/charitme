import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getMaintenanceStatus } from '../../lib/maintenance-data';
import MaintenanceCountdown from './MaintenanceCountdown';

export const metadata: Metadata = {
  title: 'Site Maintenance',
  description: 'Current CharitMe platform availability and maintenance status.',
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const status = await getMaintenanceStatus();

  return (
    <main id="main-content" className="maintenance-page">
      <Link className="maintenance-brand" href="/" aria-label="CharitMe home">
        <Image src="/icons/icon-192.png" alt="" width={34} height={34} />
        <span>CharitMe</span>
      </Link>

      <div className="maintenance-cloud maintenance-cloud-one" aria-hidden="true" />
      <div className="maintenance-cloud maintenance-cloud-two" aria-hidden="true" />

      <section className="maintenance-content" aria-labelledby="maintenance-title">
        <Image
          className="maintenance-art"
          src="/images/charitme-maintenance-barricade.webp"
          alt="Roadwork barricade with two warning lights and traffic cones"
          width={1200}
          height={658}
          sizes="(max-width: 640px) 92vw, 620px"
          priority
        />
        <h1 id="maintenance-title">
          {status.enabled ? "We're Making Things Better!" : 'CharitMe Is Ready!'}
        </h1>
        <p>{status.enabled ? status.message : 'The platform is available and ready to help you make an impact.'}</p>
        {status.enabled && status.expectedBackAt ? (
          <MaintenanceCountdown expectedBackAt={status.expectedBackAt} />
        ) : status.enabled ? (
          <p className="maintenance-status">We will be back shortly.</p>
        ) : (
          <Link className="maintenance-home-link" href="/">Go to CharitMe</Link>
        )}
        <p className="maintenance-follow">
          Questions? Email <a href={`mailto:${status.supportEmail}`}>{status.supportEmail}</a>
        </p>
      </section>
    </main>
  );
}
