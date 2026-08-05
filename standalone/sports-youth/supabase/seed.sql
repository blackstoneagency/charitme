-- Sample data. Run after schema.sql.

insert into public.campaigns (slug, title, tagline, category, cover_image_url, goal_amount, raised_amount, backer_count, status, visibility)
values
  ('national-championship-team','Help our team compete at the national championship','Every dollar gets us closer to changing a life. Please share this campaign.','Competition','https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70',2100000,128500,34,'active','public'),
  ('road-to-nationals','Help our team compete at the national championship','Every dollar gets us closer to changing a life. Please share this campaign.','Competition','https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70',2500000,102500,28,'active','public'),
  ('make-it-to-nationals','Help our team make it to nationals this season','Every dollar gets us closer to changing a life. Please share this campaign.','Sports','https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70',3600000,95000,21,'active','public')
on conflict (slug) do nothing;

-- Stories. video_url is NULL: the play control appears the moment you set one.
insert into public.cause_stories (cause_slug, title, blurb, chip_label, chip_accent, poster_url, sort_order, published, published_at)
values
  ('sports-youth','From Underdog to Team Captain','See how your support helped Miguel find confidence and become a leader.','YOUTH EMPOWERMENT',0,'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=840&q=70',0,true,now()),
  ('sports-youth','Stronger Together','A new court. A new team. A new future for these young champions.','GIRLS IN SPORTS',1,'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=840&q=70',1,true,now()),
  ('sports-youth','Building More Than Athletes','How one program is changing lives and strengthening a whole community.','COMMUNITY IMPACT',2,'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=840&q=70',2,true,now())
on conflict (cause_slug, title) do nothing;

-- ⚠️ The design's headline figures, inserted UNPUBLISHED.
-- They come from a mockup, not from this database. The band shows live measured
-- counts until someone with the standing to make the claim publishes them and
-- records a source. Flip them on with:
--   update public.cause_impact_stats set published = true,
--          source_note = 'FY2026 programme report, p.12'
--    where cause_slug = 'sports-youth';
insert into public.cause_impact_stats (cause_slug, value, label, icon, sort_order, published, source_note)
values
  ('sports-youth','125K+','Youth Impacted',0,0,false,'From design mockup — add a real source before publishing'),
  ('sports-youth','68K+','Athletes Supported',1,1,false,'From design mockup — add a real source before publishing'),
  ('sports-youth','1,250+','Programs Funded',2,2,false,'From design mockup — add a real source before publishing'),
  ('sports-youth','250+','Communities Reached',3,3,false,'From design mockup — add a real source before publishing')
on conflict (cause_slug, sort_order) do nothing;
