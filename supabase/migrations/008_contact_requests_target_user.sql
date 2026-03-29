-- Rename contact_requests.target_pro_user_id → target_user_id
-- Allow any advisor/both/admin as target (not only certified pros).
-- Re-apply RLS after rename (policies reference column names).

DROP POLICY IF EXISTS "Target pros can mark forwarded contact requests responded" ON public.contact_requests;
DROP POLICY IF EXISTS "Admins can update all contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Admins can read all contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Target pros can read forwarded contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Users can read own contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Authenticated users can create contact requests" ON public.contact_requests;

ALTER TABLE public.contact_requests RENAME COLUMN target_pro_user_id TO target_user_id;

CREATE POLICY "Authenticated users can create contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_user_id
    AND requester_user_id <> target_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles AS target
      WHERE target.user_id = target_user_id
        AND target.role IN ('advisor', 'both', 'admin')
    )
  );

CREATE POLICY "Users can read own contact requests"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = requester_user_id);

CREATE POLICY "Target pros can read forwarded contact requests"
  ON public.contact_requests FOR SELECT
  USING (
    auth.uid() = target_user_id
    AND status IN ('forwarded', 'responded', 'closed')
  );

CREATE POLICY "Admins can read all contact requests"
  ON public.contact_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all contact requests"
  ON public.contact_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Target pros can mark forwarded contact requests responded"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = target_user_id AND status = 'forwarded')
  WITH CHECK (auth.uid() = target_user_id AND status = 'responded');
