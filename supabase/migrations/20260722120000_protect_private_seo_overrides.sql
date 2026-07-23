-- Existing SEO seed rows for private surfaces must never make those routes indexable.
update seo_settings
set noindex = true,
    updated_at = now()
where route in ('/achievements', '/privacy-center', '/impact/manage')
   or route like '/events/manage%'
   or route like '/matching/manage%'
   or route like '/sponsor/manage%';
