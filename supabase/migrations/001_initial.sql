-- Run in Supabase SQL Editor in order (or use supabase db push).
-- Adds RLS for phases/concerns and profile INSERT policy beyond the implementation spec.

-- ENUMs
CREATE TYPE user_role AS ENUM ('consulter', 'advisor', 'both', 'moderator', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'withdrawn');
CREATE TYPE content_status AS ENUM ('published', 'hidden', 'deleted');
CREATE TYPE report_reason AS ENUM ('defamation', 'solicitation', 'crisis', 'personal_info', 'illegal', 'misinformation', 'legal_advice', 'advisor_solicitation', 'spam', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE moderation_action_type AS ENUM ('hide', 'delete', 'warn', 'suspend', 'ban', 'no_action');
CREATE TYPE reaction_target AS ENUM ('consultation', 'reply');
CREATE TYPE notification_type AS ENUM ('reply_to_consultation', 'reply_to_reply', 'report_resolved', 'account_warning', 'welcome', 'password_reset', 'withdrawal');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE post_handling AS ENUM ('anonymize', 'delete');
CREATE TYPE support_category AS ENUM ('public', 'legal', 'financial', 'mental', 'other');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'consulter',
  status user_status NOT NULL DEFAULT 'active',
  nickname VARCHAR(20) UNIQUE NOT NULL,
  bio TEXT,
  experience_phases TEXT[],
  notification_on_reply BOOLEAN DEFAULT true,
  notification_on_reaction BOOLEAN DEFAULT false,
  notification_digest BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,
  icon VARCHAR,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES public.phases(id) NOT NULL,
  label VARCHAR NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  triggers_crisis BOOLEAN DEFAULT false
);

CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES public.phases(id) NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  status content_status NOT NULL DEFAULT 'published',
  crisis_flag BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.consultation_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  concern_id UUID REFERENCES public.concerns(id) NOT NULL,
  UNIQUE(consultation_id, concern_id)
);

CREATE TABLE public.replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_reply_id UUID REFERENCES public.replies(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 2),
  status content_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE public.reaction_type AS ENUM ('empathy');

CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_type reaction_target NOT NULL,
  target_id UUID NOT NULL,
  reaction_type reaction_type NOT NULL DEFAULT 'empathy',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id, reaction_type)
);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES auth.users(id) NOT NULL,
  target_type reaction_target NOT NULL,
  target_id UUID NOT NULL,
  reason report_reason NOT NULL,
  detail TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_user_id UUID REFERENCES auth.users(id) NOT NULL,
  report_id UUID REFERENCES public.reports(id),
  target_type VARCHAR NOT NULL CHECK (target_type IN ('consultation', 'reply', 'user')),
  target_id UUID NOT NULL,
  action moderation_action_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.support_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  category support_category NOT NULL,
  description TEXT,
  url VARCHAR NOT NULL,
  phone_number VARCHAR,
  is_paid_listing BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type notification_type NOT NULL,
  payload JSONB,
  status notification_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.consultation_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES auth.users(id),
  ip_hash VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(consultation_id, ip_hash)
);

CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ip_address VARCHAR NOT NULL,
  user_agent VARCHAR,
  action VARCHAR,
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.withdrawal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  post_handling post_handling NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consultations_phase ON consultations(phase_id, status, created_at DESC);
CREATE INDEX idx_consultations_user ON consultations(user_id) WHERE status = 'published';
CREATE INDEX idx_consultations_crisis ON consultations(crisis_flag) WHERE crisis_flag = true;
CREATE INDEX idx_consultation_concerns_cid ON consultation_concerns(consultation_id);
CREATE INDEX idx_consultation_concerns_concern ON consultation_concerns(concern_id);
CREATE INDEX idx_replies_consultation ON replies(consultation_id, status, created_at);
CREATE INDEX idx_replies_parent ON replies(parent_reply_id) WHERE parent_reply_id IS NOT NULL;
CREATE INDEX idx_replies_user ON replies(user_id);
CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_email_notifications_pending ON email_notifications(status) WHERE status = 'pending';
CREATE INDEX idx_consultation_views_cid ON consultation_views(consultation_id);
CREATE INDEX idx_access_logs_user ON access_logs(user_id, created_at);
CREATE INDEX idx_access_logs_ip ON access_logs(ip_address, created_at);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active phases" ON phases FOR SELECT USING (is_active = true);

ALTER TABLE concerns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active concerns" ON concerns FOR SELECT USING (is_active = true);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published consultations" ON consultations FOR SELECT USING (status = 'published');
CREATE POLICY "Consulters and both can create consultations" ON consultations FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('consulter', 'both', 'admin')
  )
);
CREATE POLICY "Users can update own consultations" ON consultations FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published replies" ON replies FOR SELECT USING (status = 'published');
CREATE POLICY "Advisors and both can create replies" ON replies FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (
    (parent_reply_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('advisor', 'both', 'moderator', 'admin')
    ))
    OR (parent_reply_id IS NOT NULL)
  )
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone logged in can read reactions" ON reactions FOR SELECT USING (true);
CREATE POLICY "Logged in users can create reactions" ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON reactions FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logged in users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);
CREATE POLICY "Admins and moderators can read reports" ON reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('moderator', 'admin')
  )
);

-- Seed data (phases, concerns, support_links) — same as implementation spec
INSERT INTO phases (name, slug, icon, description, sort_order) VALUES
  ('資金繰り', 'shikin-guri', '💰', '運転資金・返済・キャッシュフローの悩み', 1),
  ('税金', 'zeikin', '🏛️', '税金の支払い・滞納・延納の悩み', 2),
  ('係争', 'keisou', '⚖️', '取引先・従業員・金融機関とのトラブル', 3),
  ('再生', 'saisei', '🔄', '事業の立て直し・民事再生・事業承継', 4),
  ('破産', 'hasan', '📉', '自己破産・法人破産の検討', 5),
  ('清算', 'seisan', '📋', '廃業・会社清算・事業譲渡', 6),
  ('メンタル・孤独', 'mental', '🧠', '精神的な辛さ・孤立感', 7),
  ('その他', 'other', '💬', '上記に当てはまらない相談', 8);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '運転資金が足りない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '銀行借入の返済が厳しい', 2, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), 'リスケジュール（返済条件変更）を検討中', 3, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '追加融資を断られた', 4, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '取引先への支払いが遅れている', 5, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '給与の支払いが厳しい', 6, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), 'ゼロゼロ融資の返済が始まった', 7, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), '資金調達の方法がわからない', 8, false),
  ((SELECT id FROM phases WHERE slug = 'shikin-guri'), 'その他', 9, false);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '消費税を納められない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '法人税・所得税が払えない', 2, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '社会保険料を滞納している', 3, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '税務署から督促が来ている', 4, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '延納・分割納付を相談したい', 5, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), '税理士に相談すべきかわからない', 6, false),
  ((SELECT id FROM phases WHERE slug = 'zeikin'), 'その他', 7, false);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'keisou'), '取引先との契約トラブル', 1, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '従業員との労務トラブル', 2, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '金融機関との交渉がうまくいかない', 3, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '訴訟を起こされた / 起こしたい', 4, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '債権回収ができない', 5, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), '弁護士に相談すべきかわからない', 6, false),
  ((SELECT id FROM phases WHERE slug = 'keisou'), 'その他', 7, false);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'saisei'), '民事再生の手続きがわからない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), '再生計画を作りたいがどうすればいいか', 2, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), '事業承継を検討中', 3, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), 'M&Aで事業を引き継ぎたい', 4, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), 'スポンサー（支援者）を探している', 5, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), '再生した人の経験を聞きたい', 6, false),
  ((SELECT id FROM phases WHERE slug = 'saisei'), 'その他', 7, false);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'hasan'), '自己破産すべきか迷っている', 1, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '法人破産の手続きがわからない', 2, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '連帯保証の影響が知りたい', 3, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '破産後の生活が不安', 4, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '家族への影響が心配', 5, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), '破産を経験した人の話を聞きたい', 6, false),
  ((SELECT id FROM phases WHERE slug = 'hasan'), 'その他', 7, false);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'seisan'), '廃業の手続きがわからない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '従業員の解雇・退職の対応', 2, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '事業の畳み方がわからない', 3, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '在庫・設備の処分方法', 4, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '取引先への通知の仕方', 5, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), '廃業後のキャリアが不安', 6, false),
  ((SELECT id FROM phases WHERE slug = 'seisan'), 'その他', 7, false);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'mental'), '誰にも相談できない', 1, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '眠れない・体調が悪い', 2, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '経営者としての孤独感', 3, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '家族との関係が悪化している', 4, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '自分を責めてしまう', 5, false),
  ((SELECT id FROM phases WHERE slug = 'mental'), '死にたい気持ちがある', 6, true),
  ((SELECT id FROM phases WHERE slug = 'mental'), 'その他', 7, false);

INSERT INTO concerns (phase_id, label, sort_order, triggers_crisis) VALUES
  ((SELECT id FROM phases WHERE slug = 'other'), '何に困っているかわからないがとにかく辛い', 1, false),
  ((SELECT id FROM phases WHERE slug = 'other'), '誰かに話を聞いてほしい', 2, false),
  ((SELECT id FROM phases WHERE slug = 'other'), 'その他', 3, false);

INSERT INTO support_links (name, category, description, url, phone_number, sort_order) VALUES
  ('法テラス（日本司法支援センター）', 'legal', '法的トラブルの総合相談窓口。無料法律相談あり。', 'https://www.houterasu.or.jp/', '0570-078374', 1),
  ('よろず支援拠点', 'public', '中小企業・小規模事業者の経営相談窓口。無料。', 'https://yorozu.smrj.go.jp/', NULL, 2),
  ('中小企業再生支援協議会', 'financial', '事業再生の専門的支援。各都道府県に設置。', 'https://www.smrj.go.jp/sme/enhancement/succession/', NULL, 3),
  ('いのちの電話', 'mental', '24時間対応の電話相談。', 'https://www.inochinodenwa.org/', '0120-783-556', 4),
  ('よりそいホットライン', 'mental', '24時間無料の電話相談。', 'https://www.since2011.net/yorisoi/', '0120-279-338', 5),
  ('日本弁護士連合会', 'legal', '弁護士会の相談窓口検索。', 'https://www.nichibenren.or.jp/', NULL, 6),
  ('日本政策金融公庫', 'financial', '中小企業向け融資の相談。', 'https://www.jfc.go.jp/', NULL, 7),
  ('事業承継・引継ぎ支援センター', 'public', 'M&A・事業承継の無料相談。', 'https://shoukei.smrj.go.jp/', NULL, 8);
