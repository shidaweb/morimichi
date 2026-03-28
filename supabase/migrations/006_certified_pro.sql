-- Certified Pro (公認再生プロ): enums, tables, profiles columns, RLS, seed

-- ---------------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE pro_specialty AS ENUM (
    'restructuring',
    'lawyer',
    'accountant',
    'sponsor',
    'fund',
    'other_expert'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pro_application_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE article_status AS ENUM (
    'draft',
    'published',
    'hidden',
    'deleted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contact_request_status AS ENUM (
    'pending',
    'forwarded',
    'responded',
    'closed',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_certified_pro BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_specialty pro_specialty;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_certified_at TIMESTAMPTZ;

-- Admins can update any profile (e.g. certify pro, moderation)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS admin_self
      WHERE admin_self.user_id = auth.uid()
        AND admin_self.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- pro_specialties (master)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pro_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  icon VARCHAR,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.pro_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read specialties" ON public.pro_specialties;
CREATE POLICY "Anyone can read specialties"
  ON public.pro_specialties FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- pro_applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pro_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  specialty pro_specialty NOT NULL,
  application_text TEXT NOT NULL,
  status pro_application_status NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_applications_active
  ON public.pro_applications(user_id)
  WHERE (status IN ('pending', 'approved'));

ALTER TABLE public.pro_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own applications" ON public.pro_applications;
CREATE POLICY "Users can read own applications"
  ON public.pro_applications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and moderators can read all applications" ON public.pro_applications;
CREATE POLICY "Admins and moderators can read all applications"
  ON public.pro_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Advisors can create applications" ON public.pro_applications;
CREATE POLICY "Advisors can create applications"
  ON public.pro_applications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('advisor', 'both', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update applications" ON public.pro_applications;
CREATE POLICY "Admins can update applications"
  ON public.pro_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can delete own pending applications" ON public.pro_applications;
CREATE POLICY "Users can delete own pending applications"
  ON public.pro_applications FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- ---------------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  summary VARCHAR(200),
  cover_image_url TEXT,
  tags TEXT[],
  status article_status NOT NULL DEFAULT 'draft',
  view_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_author
  ON public.articles(author_user_id, status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_articles_published
  ON public.articles(status, published_at DESC NULLS LAST)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_articles_tags ON public.articles USING GIN (tags);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published articles" ON public.articles;
CREATE POLICY "Anyone can read published articles"
  ON public.articles FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Authors can read own articles" ON public.articles;
CREATE POLICY "Authors can read own articles"
  ON public.articles FOR SELECT
  USING (auth.uid() = author_user_id);

DROP POLICY IF EXISTS "Admins and moderators can read all articles" ON public.articles;
CREATE POLICY "Admins and moderators can read all articles"
  ON public.articles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Certified pros can create articles" ON public.articles;
CREATE POLICY "Certified pros can create articles"
  ON public.articles FOR INSERT
  WITH CHECK (
    auth.uid() = author_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.is_certified_pro = true
    )
  );

DROP POLICY IF EXISTS "Authors can update own articles" ON public.articles;
CREATE POLICY "Authors can update own articles"
  ON public.articles FOR UPDATE
  USING (auth.uid() = author_user_id);

DROP POLICY IF EXISTS "Admins can update all articles" ON public.articles;
CREATE POLICY "Admins can update all articles"
  ON public.articles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authors can delete own articles" ON public.articles;
CREATE POLICY "Authors can delete own articles"
  ON public.articles FOR DELETE
  USING (auth.uid() = author_user_id);

DROP POLICY IF EXISTS "Admins can delete all articles" ON public.articles;
CREATE POLICY "Admins can delete all articles"
  ON public.articles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- article_views
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES auth.users(id),
  ip_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (article_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_article_views_article ON public.article_views(article_id);

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert article views" ON public.article_views;
CREATE POLICY "Anyone can insert article views"
  ON public.article_views FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read article views" ON public.article_views;
CREATE POLICY "Anyone can read article views"
  ON public.article_views FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- contact_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_pro_user_id UUID REFERENCES auth.users(id) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  status contact_request_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  forwarded_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_requester
  ON public.contact_requests(requester_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_requests_target
  ON public.contact_requests(target_pro_user_id, status);

CREATE INDEX IF NOT EXISTS idx_profiles_certified_pro
  ON public.profiles(is_certified_pro, pro_specialty)
  WHERE is_certified_pro = true;

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can create contact requests" ON public.contact_requests;
CREATE POLICY "Authenticated users can create contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_user_id
    AND requester_user_id <> target_pro_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles AS target
      WHERE target.user_id = target_pro_user_id
        AND target.is_certified_pro = true
    )
  );

DROP POLICY IF EXISTS "Users can read own contact requests" ON public.contact_requests;
CREATE POLICY "Users can read own contact requests"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = requester_user_id);

DROP POLICY IF EXISTS "Target pros can read forwarded contact requests" ON public.contact_requests;
CREATE POLICY "Target pros can read forwarded contact requests"
  ON public.contact_requests FOR SELECT
  USING (
    auth.uid() = target_pro_user_id
    AND status IN ('forwarded', 'responded', 'closed')
  );

DROP POLICY IF EXISTS "Admins can read all contact requests" ON public.contact_requests;
CREATE POLICY "Admins can read all contact requests"
  ON public.contact_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all contact requests" ON public.contact_requests;
CREATE POLICY "Admins can update all contact requests"
  ON public.contact_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: pro_specialties (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.pro_specialties (slug, name, icon, description, sort_order) VALUES
  ('restructuring', '事業再生', '🔄', '事業再建・ターンアラウンドの実務経験者', 1),
  ('lawyer', '弁護士', '⚖️', '倒産法・民事再生・破産に詳しい弁護士', 2),
  ('accountant', '会計士', '📊', '財務・税務・監査の専門家', 3),
  ('sponsor', 'スポンサー', '🤝', '事業承継・M&A・出資の意思ある企業/個人', 4),
  ('fund', 'ファンド', '💼', '再生ファンド・VC・事業投資ファンド', 5),
  ('other_expert', 'その他専門家', '🎯', '社労士、中小企業診断士、不動産鑑定士等', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
