'use client';
import React, { useState } from 'react';
import Link from 'next/link';

const SUBJECTS = [
  'Organizer support',
  'Donor question',
  'Nonprofit onboarding',
  'Enterprise / corporate giving',
  'Trust and safety review',
  'Press and partnerships',
  'Other',
] as const;

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    // Simulate submission — replace with real API call / email service
    await new Promise((r) => setTimeout(r, 900));
    setStatus('sent');
  };

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-20">
        <div className="container">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              Contact
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Talk with the GiveRise team.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Questions about fundraising, nonprofits, enterprise giving, safety reviews, or partnerships? We respond within one business day.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
            {/* Form */}
            <div>
              {status === 'sent' ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center">
                  <div className="text-4xl">✉️</div>
                  <h2 className="mt-4 text-2xl font-black text-slate-950">Message sent!</h2>
                  <p className="mt-3 text-slate-600">We typically respond within one business day. Check your inbox at <strong>{email}</strong>.</p>
                  <button
                    onClick={() => { setStatus('idle'); setName(''); setEmail(''); setSubject(''); setMessage(''); }}
                    className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-black text-slate-700">Full name</label>
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-black text-slate-700">Email address</label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-black text-slate-700">Subject</label>
                    <select
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">Select a topic…</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-black text-slate-700">Message</label>
                    <textarea
                      required
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your question or situation in as much detail as possible…"
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  {status === 'error' && (
                    <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">Something went wrong. Please try again or email us directly.</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="rounded-xl bg-emerald-600 px-7 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    {status === 'sending' ? 'Sending…' : 'Send message →'}
                  </button>
                </form>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {[
                {
                  icon: '🙋',
                  title: 'Organizer support',
                  body: 'Help with campaign setup, payouts, verification, or account issues.',
                  response: 'Response: same business day',
                },
                {
                  icon: '🏛️',
                  title: 'Nonprofit onboarding',
                  body: 'CRM setup, recurring donations, tax receipts, and team access for 501(c)(3) organizations.',
                  response: 'Response: 1–2 business days',
                },
                {
                  icon: '🏢',
                  title: 'Enterprise & corporate giving',
                  body: 'Employee matching, corporate giving programs, disaster dashboards, and API access.',
                  response: 'Response: 1 business day',
                },
                {
                  icon: '🛡️',
                  title: 'Trust & safety',
                  body: 'Report a campaign, appeal a trust review, or flag a compliance concern.',
                  response: 'Response: within 24 hours',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <div className="font-black text-slate-950">{item.title}</div>
                      <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                      <div className="mt-2 text-xs font-bold text-emerald-700">{item.response}</div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="font-black text-slate-950">Looking for quick answers?</div>
                <p className="mt-1 text-sm text-slate-600">Check our FAQ for instant answers on fees, payouts, and trust scores.</p>
                <Link href="/faq" className="mt-3 inline-block text-sm font-black text-emerald-700">
                  Browse FAQ →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
