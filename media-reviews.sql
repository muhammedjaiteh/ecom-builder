ALTER TABLE reviews
ADD COLUMN is_external BOOLEAN DEFAULT false,
ADD COLUMN external_author TEXT,
ADD COLUMN media_urls TEXT[] DEFAULT '{}';

insert into storage.buckets (id, name, public) values ('review-media', 'review-media', true)
ON CONFLICT (id) DO NOTHING;

create policy "Anyone can read review media"
on storage.objects for select
using (bucket_id = 'review-media');

create policy "Authenticated users can upload review media"
on storage.objects for insert
with check (bucket_id = 'review-media' and auth.role() = 'authenticated');
