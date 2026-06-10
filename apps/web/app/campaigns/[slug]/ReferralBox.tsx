'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';

interface Props {
  campaignUrl: string;
  userId: string | null;
}

export default function ReferralBox({ campaignUrl, userId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  if (!userId) return null;

  const referralUrl = `${campaignUrl}?ref=${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      inputRef.current?.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="pc-referral">
      <div className="pc-referral-head">
        <span style={{ fontSize: 22 }}>🎁</span>
        <div>
          <b>Earn rewards by sharing</b>
          <span>Donations made through your personal link count toward your CharitMe referral rewards — completely free.</span>
        </div>
      </div>

      <div className="pc-share-copy">
        <input ref={inputRef} type="text" readOnly value={referralUrl} aria-label="Your personal referral link" />
        <button type="button" onClick={handleCopy} style={{ minWidth: 60 }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <Link href="/dashboard/referrals" className="pc-referral-link">
        View your referral rewards →
      </Link>
    </div>
  );
}
