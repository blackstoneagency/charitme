import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase';
import { FOOTER_SETTINGS_DEFAULTS, resolveFooterSettings, type FooterSettings } from './footer-nav';

// ─────────────────────────────────────────────────────────────────────────────
// Operator-controlled footer content (social profiles, app store listings,
// contact address), stored at `platform_settings.config.footer` and edited in
// Super Admin → Settings → Footer.
//
// Cached exactly like getBannerSettings: the footer renders in the root layout,
// so an uncached read would force every page in the app to become dynamic.
// ─────────────────────────────────────────────────────────────────────────────

const fetchFooterSettings = unstable_cache(
  async (): Promise<FooterSettings> => {
    try {
      const { data } = await supabaseAdmin
        .from('platform_settings')
        .select('config')
        .eq('id', 1)
        .maybeSingle();

      const config = (data?.config && typeof data.config === 'object' && !Array.isArray(data.config))
        ? (data.config as Record<string, unknown>)
        : {};
      return resolveFooterSettings(config.footer);
    } catch {
      // Table missing or database unavailable — render the footer exactly as it
      // looked before it became configurable. A footer is not worth an error
      // page, but it must not render half-empty either.
      return FOOTER_SETTINGS_DEFAULTS;
    }
  },
  ['footer-settings'],
  { revalidate: 60, tags: ['footer-settings', 'platform-settings'] },
);

export async function getFooterSettings(): Promise<FooterSettings> {
  return fetchFooterSettings();
}
