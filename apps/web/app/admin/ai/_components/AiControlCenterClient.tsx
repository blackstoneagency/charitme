'use client';

import { useCallback, useState } from 'react';
import { Btn } from '../../../../components/ui';
import {
  contextPackToMarkdown,
  statusTone,
  type AgentStatus,
  type ContextPack,
  type ContextSource,
  type SourceHealth,
} from '../../../../lib/ai-agents-core';

// ─────────────────────────────────────────────────────────────────────────────
// The console surface.
//
// Two rules govern everything rendered here:
//
//  1. A number that could not be read shows an em dash, never 0. On this screen
//     0 is the reassuring answer ("no open issues", "no risk flags"), so it has
//     to have been measured.
//  2. A status is never asserted for a source nobody reached. 'Ready' means the
//     agent's required sources answered on this request.
// ─────────────────────────────────────────────────────────────────────────────

export type SprintView = {
  id: string;
  number: number | null;
  title: string;
  goals: string[];
  backlog: string[];
} | null;

export type GithubView = {
  health: SourceHealth;
  repo: string | null;
  reason: string | null;
  openIssues: number | null;
  openPullRequests: number | null;
};

export type PlatformView = {
  health: SourceHealth;
  users: number | null;
  activeCampaigns: number | null;
  donations: number | null;
  openSupportCases: number | null;
  openRiskFlags: number | null;
};

export type AgentView = {
  id: string;
  name: string;
  mandate: string;
  responsibilities: string[];
  kpis: string[];
  requires: ContextSource[];
  status: AgentStatus;
};

const TONE_COLOR: Record<'green' | 'amber' | 'grey', string> = {
  green: 'var(--green-text)',
  amber: 'var(--orange-text)',
  grey: 'var(--t3)',
};

const SOURCE_LABEL: Record<SourceHealth, string> = {
  connected: 'Connected',
  unreadable: 'Unreadable',
  'not-configured': 'Not configured',
};

const SOURCE_TONE: Record<SourceHealth, 'green' | 'amber' | 'grey'> = {
  connected: 'green',
  unreadable: 'amber',
  'not-configured': 'grey',
};

/** Unknown renders as an em dash. Zero renders as zero. */
function num(value: number | null): string {
  return value === null ? '—' : value.toLocaleString();
}

function Dot({ tone }: { tone: 'green' | 'amber' | 'grey' }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: 999,
        background: TONE_COLOR[tone],
        flex: '0 0 auto',
      }}
    />
  );
}

function SourceRow({ name, health, detail }: { name: string; health: SourceHealth; detail: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '6px 0' }}>
      <Dot tone={SOURCE_TONE[health]} />
      <strong style={{ fontSize: 14 }}>{name}</strong>
      <span style={{ fontSize: 13, color: 'var(--t2)' }}>{SOURCE_LABEL[health]}</span>
      {detail && <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>· {detail}</span>}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div
      style={{
        border: '1px solid var(--b1)',
        borderRadius: 'var(--r, 10px)',
        background: 'var(--s1)',
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 4 }}>{label}</div>
      <strong style={{ fontSize: 22, lineHeight: 1.2, display: 'block', wordBreak: 'break-word' }}>{value}</strong>
      {note && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>{note}</div>}
    </div>
  );
}

export default function AiControlCenterClient({
  agents,
  github,
  platform,
  sprint,
}: {
  agents: AgentView[];
  github: GithubView;
  platform: PlatformView;
  sprint: SprintView;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pack, setPack] = useState<ContextPack | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openAgent = useCallback(async (agentId: string) => {
    setBusyId(agentId);
    setError(null);
    setCopied(false);
    setOpenId(agentId);
    setPack(null);
    try {
      const res = await fetch('/api/admin/ai/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      const body = (await res.json()) as { pack?: ContextPack; error?: string };
      if (!res.ok || !body.pack) {
        setError(body.error ?? `Context build failed (${res.status})`);
        return;
      }
      setPack(body.pack);
    } catch {
      setError('Context build failed — the request did not complete.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const copyPack = useCallback(async () => {
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(contextPackToMarkdown(pack));
      setCopied(true);
    } catch {
      setError('Could not copy to the clipboard.');
    }
  }, [pack]);

  const anyDegraded = github.health !== 'connected' || platform.health !== 'connected';

  return (
    <div style={{ padding: '0 4px 48px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 22 }}>
      {anyDegraded && (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--s2)',
            border: '1px solid var(--b2)',
            color: 'var(--t1)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4 }}>Some context sources are not reporting</strong>
          <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            Anything showing &ldquo;—&rdquo; could not be read and is unknown — it is not zero. Agents that
            depend on an unreporting source are marked below rather than shown as ready.
          </span>
        </div>
      )}

      {/* ── Sources ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="ai-sources" className="kf-card" style={{ padding: 18 }}>
        <h2 id="ai-sources" style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>
          Context sources
        </h2>
        <SourceRow
          name="GitHub"
          health={github.health}
          detail={github.reason ?? github.repo}
        />
        <SourceRow
          name="AI documents"
          health={sprint ? 'connected' : 'not-configured'}
          detail={sprint ? `AI/employees · AI/sprints (${sprint.id})` : 'no numbered sprint in AI/sprints'}
        />
        <SourceRow
          name="Platform database"
          health={platform.health}
          detail={platform.health === 'connected' ? 'Supabase' : 'no counts could be read'}
        />
      </section>

      {/* ── Delivery state ──────────────────────────────────────────────── */}
      <section aria-labelledby="ai-delivery" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <h2 id="ai-delivery" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
          Delivery state
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Stat
            label="Current sprint"
            value={sprint?.title ?? 'No sprint defined'}
            note={sprint?.goals.length ? sprint.goals.join(' · ') : 'from AI/sprints'}
          />
          <Stat label="Open GitHub issues" value={num(github.openIssues)} />
          <Stat label="Open pull requests" value={num(github.openPullRequests)} />
          <Stat label="Open support cases" value={num(platform.openSupportCases)} />
          <Stat label="Open risk flags" value={num(platform.openRiskFlags)} />
        </div>
      </section>

      {/* ── Roster ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="ai-roster" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <h2 id="ai-roster" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
          Agent roster
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {agents.map((agent) => {
            const tone = statusTone(agent.status);
            return (
              <article key={agent.id} className="kf-card" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15, flex: '1 1 auto', minWidth: 0 }}>{agent.name}</strong>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: TONE_COLOR[tone], fontWeight: 600 }}>
                    <Dot tone={tone} />
                    {agent.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.5 }}>{agent.mandate}</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6 }}>
                  {agent.responsibilities.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <div>
                  <Btn
                    size="sm"
                    variant={agent.id === 'executive-assistant' ? 'primary' : 'secondary'}
                    loading={busyId === agent.id}
                    onClick={() => openAgent(agent.id)}
                    aria-busy={busyId === agent.id}
                  >
                    {busyId === agent.id ? 'Building context…' : `Open ${agent.name}`}
                  </Btn>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Built context pack ──────────────────────────────────────────── */}
      <section aria-labelledby="ai-context" aria-live="polite" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
        <h2 id="ai-context" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
          Context pack
        </h2>
        {!openId && (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--t3)' }}>
            Open an agent to build its context pack from the sources above.
          </p>
        )}
        {error && (
          <div
            role="alert"
            style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--b2)', background: 'var(--s2)', fontSize: 13.5 }}
          >
            {error}
          </div>
        )}
        {pack && (
          <div className="kf-card" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15, flex: '1 1 auto' }}>{pack.agentName}</strong>
              <Btn size="sm" variant="secondary" onClick={copyPack}>
                {copied ? 'Copied' : 'Copy as markdown'}
              </Btn>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.5 }}>{pack.mandate}</p>

            {pack.kpis.length > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>
                <strong style={{ color: 'var(--t2)' }}>Measured on:</strong> {pack.kpis.join(' · ')}
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 380 }}>
                <caption className="sr-only">Facts assembled for {pack.agentName}</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--t3)', fontWeight: 600, borderBottom: '1px solid var(--b1)' }}>Fact</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--t3)', fontWeight: 600, borderBottom: '1px solid var(--b1)' }}>Value</th>
                    <th scope="col" style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--t3)', fontWeight: 600, borderBottom: '1px solid var(--b1)' }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.facts.map((f) => (
                    <tr key={f.key}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--b1)' }}>
                        {f.label}
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--t3)' }}>{f.hint}</span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--b1)', fontFamily: 'var(--mono)' }}>
                        {f.value ?? '—'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--b1)', color: 'var(--t3)' }}>
                        {f.source === 'github' ? 'GitHub' : 'Platform'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pack.missing.length > 0 && (
              <div
                role="alert"
                style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--b2)', background: 'var(--s2)', fontSize: 13 }}
              >
                <strong>{pack.missing.length} fact{pack.missing.length === 1 ? '' : 's'} could not be read.</strong>{' '}
                {pack.missing.join(', ')} — unknown, not zero. The copied pack says so explicitly so the agent
                does not read a gap as an all-clear.
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
              Built {new Date(pack.builtAt).toLocaleString()}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
