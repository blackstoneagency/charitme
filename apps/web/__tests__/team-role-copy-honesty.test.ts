import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// The team role selector must not promise capabilities the code doesn't enforce.
//
// It used to offer, in user-facing copy:
//   "Admin — can edit and manage campaign"
//   "Member — can post updates"
//   "Viewer — read-only access"
//
// None of that was true. Nine campaign routes enforce an ownership check; exactly
// one (`analytics`) consults `team_members` at all, and none consult the member's
// ROLE. Campaign mutations go through `canManageCampaign()`, which is owner-or-
// platform-admin with no team path — so an invited "Admin" could not edit
// anything, and a "Viewer" had identical access to an "Admin".
//
// This guard is deliberately CONDITIONAL, so it retires itself: it only demands
// honest copy while role enforcement is genuinely missing. The moment a campaign
// route checks a team member's role, the guard stops applying and the richer copy
// may legitimately come back.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEAM_UI = join(APP_WEB_ROOT, 'app/dashboard/team/_components/TeamActions.tsx');

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e === 'route.ts') out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** True once any campaign route gates on a team member's ROLE, not just membership. */
function roleEnforcementExists(): boolean {
  return routeFiles(join(APP_WEB_ROOT, 'app/api/campaigns')).some((f) => {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('team_members')) return false;
    // A role check looks like `.eq('role', …)`, `tm.role`, or `member.role`.
    return /\.eq\(\s*['"]role['"]/.test(src) || /\b\w+\.role\b/.test(src);
  });
}

describe('team role copy stays honest', () => {
  it('does not advertise capabilities while no route enforces team roles', () => {
    if (roleEnforcementExists()) return; // enforcement shipped — guard retires itself.

    const copy = readFileSync(TEAM_UI, 'utf8');
    const falseClaims = [
      /can edit and manage/i,
      /can post updates/i,
      /read-only access/i,
      /full access/i,
    ].filter((re) => re.test(copy));

    expect(
      falseClaims.map(String),
      'The team role selector promises capabilities no code enforces. ' +
        'canManageCampaign() is owner-or-platform-admin with no team path, and no ' +
        'campaign route checks a team member\'s role — so an "Admin" cannot edit ' +
        'and a "Viewer" has identical access. Either implement enforcement (which ' +
        'retires this guard automatically) or keep the copy honest.',
    ).toEqual([]);
  });

  it('is non-vacuous — it would catch the copy that shipped', () => {
    const shipped = '<option value="admin">Admin — can edit and manage campaign</option>';
    expect(/can edit and manage/i.test(shipped)).toBe(true);
    // And the detector recognises a real role check when one exists.
    expect(/\.eq\(\s*['"]role['"]/.test(`.eq('role', 'admin')`)).toBe(true);
  });
});
