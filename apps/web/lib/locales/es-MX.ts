// Spanish (Mexico) — overrides ONLY where Mexican usage differs from the
// peninsular source in `es`. Everything else resolves to `es`.
import type { Dictionary } from '../i18n';

export const esMX: Dictionary = {
  // "Ajustes" is peninsular; Mexico says "Configuración".
  'nav.settings': 'Configuración',
  'settings.title': 'Configuración',
  'dashboard.settings': 'Configuración',
  // "Importe" reads as peninsular; "Monto" is standard in Mexico.
  'donate.amount': 'Monto',
  'donate.custom_amount': 'Otro monto',
  'auth.email': 'Correo',
  'action.upload': 'Cargar',
};
