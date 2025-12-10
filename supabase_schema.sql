create table orders (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  script text,
  language text,
  voice text,
  photo_url text,
  avatar_id text,
  video_id text,
  video_url text,
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
