// Dictionary registry.
//
// Importing this module registers every dictionary with lib/i18n. The root layout
// imports it once, so every Server Component and client bundle has translations
// without each call site knowing which files exist.
//
// Statically imported, never dynamically loaded: these files sit outside any
// route, and Next's output file tracing would not ship a dynamically-required
// dictionary into a Vercel function — the trap the AI roster already hit, where a
// runtime read worked in dev and produced an empty roster in production.

import { registerDictionary } from '../i18n';
import { en } from './en';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pt } from './pt';
import { enGB } from './en-GB';
import { esMX } from './es-MX';
import { esUS } from './es-US';
import { frCA } from './fr-CA';

let registered = false;

/** Idempotent — the layout renders many times per process. */
export function registerAllDictionaries(): void {
  if (registered) return;
  registered = true;

  // Base languages carry the strings — the grain of SUPPORTED_LOCALES.
  registerDictionary('en', en);
  registerDictionary('de', de);
  registerDictionary('es', es);
  registerDictionary('fr', fr);
  registerDictionary('it', it);
  registerDictionary('nl', nl);
  registerDictionary('pt', pt);

  // Markets carry only what they genuinely say differently.
  registerDictionary('en-GB', enGB);
  registerDictionary('es-MX', esMX);
  registerDictionary('es-US', esUS);
  registerDictionary('fr-CA', frCA);
}

// Registering at module scope means importing this file is enough; no caller can
// forget to call it and get a silently English site.
registerAllDictionaries();

export { en, de, es, fr, it, nl, pt, enGB, esMX, esUS, frCA };
