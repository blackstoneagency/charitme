'use client';

import { useState } from 'react';
import { Btn, Input, Badge, Card, EmptyState } from '../../../components/ui';

export type CorporateAccountView = {
  id: string;
  name: string;
  emailDomain: string | null;
  defaultMatchRatio: number;
  annualCapCents: number | null;
  active: boolean;
};

export type RuleView = {
  id: string;
  category: string | null;
  ratio: number;
  perGiftCapCents: number | null;
  annualCapCents: number | null;
  active: boolean;
};

export type MemberView = { id: string; email: string; role: string; status: string };

function dollars(cents: number | null): string {
  return cents == null ? '—' : `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function CorporateClient({
  initialAccount, initialRules, initialMembers,
}: {
  initialAccount: CorporateAccountView | null;
  initialRules: RuleView[];
  initialMembers: MemberView[];
}) {
  const [account, setAccount] = useState<CorporateAccountView | null>(initialAccount);
  const [rules, setRules] = useState<RuleView[]>(initialRules);
  const [members, setMembers] = useState<MemberView[]>(initialMembers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createForm, setCreateForm] = useState({ name: '', emailDomain: '', ratio: '1', annualCap: '' });
  const [ruleForm, setRuleForm] = useState({ category: '', ratio: '1', perGiftCap: '', annualCap: '' });
  const [inviteEmail, setInviteEmail] = useState('');

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/corporate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          emailDomain: createForm.emailDomain.trim() || undefined,
          defaultMatchRatio: parseFloat(createForm.ratio) || 1,
          annualCapCents: createForm.annualCap.trim() ? Math.round(parseFloat(createForm.annualCap) * 100) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not create account'); return; }
      const a = data.account;
      setAccount({ id: a.id, name: a.name, emailDomain: a.email_domain, defaultMatchRatio: Number(a.default_match_ratio) || 1, annualCapCents: a.annual_cap_cents, active: a.active });
    } finally { setBusy(false); }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/corporate/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: ruleForm.category.trim() || null,
          ratio: parseFloat(ruleForm.ratio) || 1,
          perGiftCapCents: ruleForm.perGiftCap.trim() ? Math.round(parseFloat(ruleForm.perGiftCap) * 100) : null,
          annualCapCents: ruleForm.annualCap.trim() ? Math.round(parseFloat(ruleForm.annualCap) * 100) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not add rule'); return; }
      const r = data.rule;
      setRules((prev) => [...prev, { id: r.id, category: r.category, ratio: Number(r.ratio) || 0, perGiftCapCents: r.per_gift_cap_cents, annualCapCents: r.annual_cap_cents, active: r.active }]);
      setRuleForm({ category: '', ratio: '1', perGiftCap: '', annualCap: '' });
    } finally { setBusy(false); }
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/corporate/rules/${id}`, { method: 'DELETE' });
    if (res.ok) setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/corporate/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not invite'); return; }
      const m = data.member;
      setMembers((prev) => {
        const rest = prev.filter((x) => x.email !== m.email);
        return [...rest, { id: m.id, email: m.email, role: m.role, status: m.status }];
      });
      setInviteEmail('');
    } finally { setBusy(false); }
  }

  if (!account) {
    return (
      <Card style={{ maxWidth: 560 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Register your company</h2>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>
          Set up a corporate account to match your employees&apos; donations. You&apos;ll define match rules and enroll staff.
        </p>
        <form onSubmit={createAccount} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Company name" aria-label="Company name" />
          <Input value={createForm.emailDomain} onChange={(e) => setCreateForm({ ...createForm, emailDomain: e.target.value })} placeholder="Employee email domain (e.g. acme.com)" aria-label="Email domain" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <Input type="number" step="0.5" min={0} value={createForm.ratio} onChange={(e) => setCreateForm({ ...createForm, ratio: e.target.value })} placeholder="Default match ratio" aria-label="Default match ratio" />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <Input type="number" min={0} value={createForm.annualCap} onChange={(e) => setCreateForm({ ...createForm, annualCap: e.target.value })} placeholder="Annual cap per employee ($, optional)" aria-label="Annual cap" />
            </div>
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}
          <div><Btn type="submit" loading={busy} disabled={busy || createForm.name.trim().length < 2}>Create corporate account</Btn></div>
        </form>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{account.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--t3)' }}>
              {account.emailDomain ? `@${account.emailDomain} · ` : ''}Default match {account.defaultMatchRatio}:1
              {account.annualCapCents != null ? ` · Annual cap ${dollars(account.annualCapCents)}/employee` : ''}
            </div>
          </div>
          <Badge color={account.active ? 'green' : 'gray'}>{account.active ? 'Active' : 'Inactive'}</Badge>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Matching-gift rules</h2>
        {rules.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12 }}>No custom rules — the default {account.defaultMatchRatio}:1 match applies to all categories.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {rules.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 8 }}>
                <div style={{ fontSize: 14 }}>
                  <strong>{r.category ?? 'All categories'}</strong> · {r.ratio}:1
                  {r.perGiftCapCents != null ? ` · ${dollars(r.perGiftCapCents)}/gift cap` : ''}
                  {r.annualCapCents != null ? ` · ${dollars(r.annualCapCents)}/yr cap` : ''}
                </div>
                <Btn size="sm" variant="ghost" onClick={() => deleteRule(r.id)}>Remove</Btn>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addRule} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: '1 1 140px' }}><Input value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })} placeholder="Category (blank = all)" aria-label="Rule category" /></div>
          <div style={{ flex: '0 0 90px' }}><Input type="number" step="0.5" min={0} value={ruleForm.ratio} onChange={(e) => setRuleForm({ ...ruleForm, ratio: e.target.value })} placeholder="Ratio" aria-label="Ratio" /></div>
          <div style={{ flex: '0 0 120px' }}><Input type="number" min={0} value={ruleForm.perGiftCap} onChange={(e) => setRuleForm({ ...ruleForm, perGiftCap: e.target.value })} placeholder="$/gift cap" aria-label="Per-gift cap" /></div>
          <div style={{ flex: '0 0 120px' }}><Input type="number" min={0} value={ruleForm.annualCap} onChange={(e) => setRuleForm({ ...ruleForm, annualCap: e.target.value })} placeholder="$/yr cap" aria-label="Annual cap" /></div>
          <Btn type="submit" loading={busy}>Add rule</Btn>
        </form>
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Employees</h2>
        {members.length === 0 ? (
          <EmptyState icon="👥" title="No employees enrolled" body="Invite employees by email so their donations are matched." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {members.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 8 }}>
                <span style={{ fontSize: 14 }}>{m.email}{m.role === 'admin' ? ' (admin)' : ''}</span>
                <Badge color={m.status === 'active' ? 'green' : 'gray'}>{m.status}</Badge>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={invite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="employee@company.com" aria-label="Employee email" /></div>
          <Btn type="submit" loading={busy} disabled={busy || !inviteEmail.trim()}>Invite employee</Btn>
        </form>
      </Card>

      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}
    </div>
  );
}
