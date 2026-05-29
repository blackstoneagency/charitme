'use client';

import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';

const SUBJECTS = [
  'Campaign support',
  'Donor question',
  'AI fundraising',
  'Billing or pricing',
  'Press inquiries',
  'Partnerships',
  'Other',
] as const;

const FAQS = [
  'How does KindFund work?',
  'Is there a platform fee?',
  'How long does it take to receive donations?',
  'Can I track my campaign performance?',
  'Is my data secure?',
] as const;

const CONTACT_METHODS = [
  {
    icon: 'chat',
    title: 'Live Chat',
    body: 'Chat with our support team in real-time.',
    action: 'Start Chat',
    href: 'mailto:hello@kindfund.com?subject=Live%20chat%20request',
  },
  {
    icon: 'book',
    title: 'Help Center',
    body: 'Browse articles and guides for quick answers.',
    action: 'Visit Help Center',
    href: '/faq',
  },
  {
    icon: 'community',
    title: 'Community',
    body: 'Connect with other fundraisers and experts.',
    action: 'Join Community',
    href: '/success-stories',
  },
  {
    icon: 'megaphone',
    title: 'Press Inquiries',
    body: 'For media and partnership opportunities.',
    action: 'Contact Press Team',
    href: 'mailto:press@kindfund.com?subject=Press%20inquiry',
  },
] as const;

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, React.ReactNode> = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z" /></>,
    community: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    megaphone: <><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
    calendar: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function ContactInfo({ icon, title, lines }: { icon: string; title: string; lines: string[] }) {
  return (
    <div className="contact-info-row">
      <div className="contact-info-icon"><Icon name={icon} /></div>
      <div>
        <h2>{title}</h2>
        {lines.map((line) => <p key={line}>{line}</p>)}
      </div>
    </div>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [notice, setNotice] = useState('');

  const updateField = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setNotice('');

    // Post to support-tickets (stores in DB + sends email) with fallback to /api/contact
    const response = await fetch('/api/support-tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
        category: 'general',
        priority: 'normal',
      }),
    }).catch(() => null);

    if (response?.ok) {
      setStatus('sent');
      setNotice("Thanks, your message is on its way. We'll get back to you soon.");
      setForm({ name: '', email: '', subject: '', message: '' });
      return;
    }

    const payload = await response?.json().catch(() => null) as { error?: string } | null;
    setStatus('error');
    setNotice(payload?.error ?? 'Something went wrong. Please try again.');
  };

  return (
    <div className="contact-page">
      <section className="contact-hero">
        <div className="container contact-hero-grid">
          <div className="contact-copy">
            <nav className="contact-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span>&gt;</span>
              <strong>Contact Us</strong>
            </nav>

            <h1>
              We&apos;re here to help.<br />
              Let&apos;s make an <span>impact</span> together.
            </h1>
            <p className="contact-intro">Have a question, need support, or just want to say hello? Our team is ready to help you succeed.</p>

            <div className="contact-details">
              <ContactInfo icon="mail" title="Email Us" lines={['hello@kindfund.com', 'We typically reply within 24 hours.']} />
              <ContactInfo icon="phone" title="Call Us" lines={['+1 (888) 123-4567', 'Mon - Fri, 9:00 AM - 6:00 PM (EST)']} />
              <ContactInfo icon="pin" title="Our Office" lines={['123 Impact Way, Suite 400', 'San Francisco, CA 94107, USA']} />
            </div>

            <div className="contact-illustration" aria-hidden="true">
              <div className="contact-mug"><span /></div>
              <div className="contact-plant">
                <i /><i /><i /><i /><i />
              </div>
              <div className="contact-envelope" />
              <div className="contact-confetti one" />
              <div className="contact-confetti two" />
              <div className="contact-confetti three" />
            </div>
          </div>

          <div className="contact-form-wrap">
            <div className="contact-plane" aria-hidden="true">
              <Icon name="send" />
              <span />
            </div>
            <form className="contact-form-card" onSubmit={handleSubmit}>
              <h2>Send us a message</h2>
              <p>Fill out the form below and we&apos;ll get back to you soon.</p>

              <div className="contact-form-grid">
                <label>
                  <span>Full Name</span>
                  <input required value={form.name} onChange={updateField('name')} placeholder="Enter your full name" autoComplete="name" />
                </label>
                <label>
                  <span>Email Address</span>
                  <input required type="email" value={form.email} onChange={updateField('email')} placeholder="Enter your email" autoComplete="email" />
                </label>
              </div>

              <label>
                <span>Subject</span>
                <select required value={form.subject} onChange={updateField('subject')}>
                  <option value="">Select a subject</option>
                  {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </label>

              <label>
                <span>Message</span>
                <textarea required value={form.message} onChange={updateField('message')} placeholder="How can we help you?" rows={5} />
              </label>

              {notice && <div className={`contact-notice ${status === 'sent' ? 'success' : 'error'}`}>{notice}</div>}

              <button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending...' : 'Send Message'}
                <Icon name="send" />
              </button>

              <div className="contact-privacy"><Icon name="lock" /> We respect your privacy. Your information is safe with us.</div>
            </form>
          </div>
        </div>
      </section>

      <section className="contact-lower">
        <div className="container contact-lower-grid">
          <div className="contact-faq-card">
            <h2>Frequently Asked Questions</h2>
            <div className="contact-faq-list">
              {FAQS.map((question) => (
                <details key={question}>
                  <summary>{question}<Icon name="chevron" /></summary>
                  <p>Our support team can walk you through this in detail and point you to the right next step.</p>
                </details>
              ))}
            </div>
            <Link href="/faq" className="contact-text-link">View All FAQs <Icon name="arrow" /></Link>
          </div>

          <div className="contact-reach-card">
            <h2>Other ways to reach us</h2>
            <div className="contact-method-grid">
              {CONTACT_METHODS.map((method) => (
                <Link href={method.href} className="contact-method" key={method.title}>
                  <span><Icon name={method.icon} /></span>
                  <strong>{method.title}</strong>
                  <p>{method.body}</p>
                  <em>{method.action} <Icon name="arrow" /></em>
                </Link>
              ))}
            </div>

            <div className="contact-help-band">
              <div className="kind-logo" aria-hidden="true"><span><i /><b /></span></div>
              <div>
                <strong>Still need help?</strong>
                <p>Our team is here for you. We&apos;re committed to helping you create successful campaigns and make a bigger impact.</p>
              </div>
              <Link href="mailto:hello@kindfund.com?subject=Schedule%20a%20call" className="contact-schedule"><Icon name="calendar" /> Schedule a Call</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
