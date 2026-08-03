'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { SORTS, type SortValue } from '../../lib/story-sort';

/**
 * The reference's sort dropdown.
 *
 * The only client component on this page — everything else is server-rendered,
 * because this is a common entry point from a shared link and a client bundle
 * for a hero costs LCP.
 *
 * ⚠️ It navigates on `change` rather than posting a form, and that is a real
 * trade: without JS the control does nothing. The alternative shapes were worse
 * — a GET form needs a visible submit button the design does not have, and a
 * pair of links is not the dropdown the reference draws. It is a SORT, so the
 * no-JS failure leaves the page fully readable in its default order rather than
 * withholding content; that is why this one is allowed to depend on JS and the
 * category filter below it (which changes WHICH stories exist) is a plain link.
 *
 * The existing params are preserved, so sorting does not silently drop the
 * category the visitor already chose — the same defect that shipped on the
 * campaigns list.
 */
export default function SortSelect({ value }: { value: SortValue }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="ss-sort">
      <span className="ss-visually-hidden">Sort stories</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set('sort', e.target.value);
          router.push(`/success-stories?${next.toString()}`);
        }}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </label>
  );
}
