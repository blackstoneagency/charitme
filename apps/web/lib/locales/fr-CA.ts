// French (Canada) — Quebec French differs from France in exactly the places a
// fundraising product touches: "cagnotte" is a France-ism, and Canadian French
// uses "courriel" and "clavardage" where France borrows from English.
// Everything else resolves to `fr`.
import type { Dictionary } from '../i18n';

export const frCA: Dictionary = {
  'nav.start_campaign': 'Lancer une campagne',
  'campaign.ended': 'Cette campagne est terminée.',
  'campaign.paused_notice': 'Les dons à cette campagne sont temporairement suspendus.',
  'campaign.share_campaign': 'Partager cette campagne',
  'campaign.report': 'Signaler cette campagne',
  'campaign.save': 'Enregistrer la campagne',
  'campaign.similar': 'Campagnes similaires',
  'dashboard.my_campaigns': 'Mes campagnes',
  'dashboard.active_campaigns': 'Campagnes actives',
  'dashboard.no_campaigns': 'Vous n’avez pas encore lancé de campagne',
  'auth.email': 'Courriel',
  'auth.check_email': 'Consultez votre courriel pour trouver le lien de confirmation.',
  'auth.invalid_credentials': 'Ce courriel ou ce mot de passe est incorrect.',
  'footer.blog': 'Blogue',
};
