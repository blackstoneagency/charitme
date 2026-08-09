'use client';

import Link from 'next/link';

type StepVerifyProps = {
  campaignPath: string;
  signedIn: boolean;
  identityVerified: boolean;
  nonprofitVerified: boolean;
};

export default function StepVerify({
  campaignPath,
  signedIn,
  identityVerified,
  nonprofitVerified,
}: StepVerifyProps) {
  const requiresOrganizationVerification = campaignPath === 'nonprofit';
  const verificationComplete = identityVerified
    && (!requiresOrganizationVerification || nonprofitVerified);

  return (
    <div className="cr2-verify-panel">
      <h2 className="cr2-step-q">Complete required verification</h2>
      <p className="cr2-step-help">
        Verification protects donors, confirms the payout recipient, and prevents an unverified
        campaign from accepting money. Your draft remains saved while you complete these checks.
      </p>

      <div className={`cb-verification-status${identityVerified ? ' is-ready' : ''}`} role="status">
        <strong>{identityVerified ? 'Identity verified' : 'Identity verification required'}</strong>
        <span>
          {identityVerified
            ? 'The organizer identity check is complete.'
            : 'Confirm the organizer identity before this campaign can publish.'}
        </span>
      </div>

      {!identityVerified && (
        <Link className="cb-verification-action" href={signedIn ? '/verification' : '/login?next=/verification'}>
          {signedIn ? 'Verify identity' : 'Sign in to verify identity'}
        </Link>
      )}

      {requiresOrganizationVerification && (
        <>
          <div className={`cb-verification-status${nonprofitVerified ? ' is-ready' : ''}`} role="status">
            <strong>{nonprofitVerified ? 'Organization verified' : 'Nonprofit verification required'}</strong>
            <span>
              {nonprofitVerified
                ? 'The nonprofit record and eligibility checks are complete.'
                : 'Submit the organization record before publishing a nonprofit campaign.'}
            </span>
          </div>
          {!nonprofitVerified && (
            <Link className="cb-verification-action" href={signedIn ? '/dashboard/nonprofit' : '/login?next=/dashboard/nonprofit'}>
              {signedIn ? 'Verify nonprofit' : 'Sign in to verify nonprofit'}
            </Link>
          )}
        </>
      )}

      <p className="cb-verification-note">
        {verificationComplete
          ? 'All required checks are complete. Continue to preview.'
          : 'Return to this saved draft after verification to continue.'}
      </p>
    </div>
  );
}
