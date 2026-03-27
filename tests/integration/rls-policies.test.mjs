import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const CONSULTER_EMAIL = process.env.TEST_CONSULTER_EMAIL;
const CONSULTER_PASSWORD = process.env.TEST_CONSULTER_PASSWORD;
const ADVISOR_EMAIL = process.env.TEST_ADVISOR_EMAIL;
const ADVISOR_PASSWORD = process.env.TEST_ADVISOR_PASSWORD;

const hasBase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const hasRoleCreds = !!(
  CONSULTER_EMAIL && CONSULTER_PASSWORD && ADVISOR_EMAIL && ADVISOR_PASSWORD
);

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loginClient(email, password) {
  const c = anonClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Login failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  return c;
}

async function samplePhaseAndConcern(client) {
  const { data: phaseRows, error: pErr } = await client
    .from('phases')
    .select('id')
    .limit(1);
  if (pErr || !phaseRows?.[0]?.id) throw new Error(`phase fetch failed: ${pErr?.message}`);
  const phaseId = phaseRows[0].id;

  const { data: concernRows, error: cErr } = await client
    .from('concerns')
    .select('id')
    .eq('phase_id', phaseId)
    .limit(1);
  if (cErr || !concernRows?.[0]?.id) throw new Error(`concern fetch failed: ${cErr?.message}`);

  return { phaseId, concernId: concernRows[0].id };
}

test('RLS: unauthenticated can read published consultations', { skip: !hasBase }, async () => {
  const c = anonClient();
  const { data, error } = await c
    .from('consultations')
    .select('id,status')
    .eq('status', 'published')
    .limit(5);

  assert.equal(error, null, error?.message);
  assert.ok(Array.isArray(data));
});

test('RLS: consulter can create consultation via rpc', { skip: !(hasBase && hasRoleCreds) }, async () => {
  const c = await loginClient(CONSULTER_EMAIL, CONSULTER_PASSWORD);
  const { phaseId, concernId } = await samplePhaseAndConcern(c);

  const title = `RLS QA consulter ${Date.now()}`;
  const body = 'RLS integration test post by consulter.';

  const { data: id, error } = await c.rpc('create_consultation_post', {
    p_phase_id: phaseId,
    p_title: title,
    p_body: body,
    p_concern_ids: [concernId],
  });

  assert.equal(error, null, error?.message);
  assert.ok(id, 'Expected created consultation id');
});

test('RLS: advisor cannot create consultation via rpc', { skip: !(hasBase && hasRoleCreds) }, async () => {
  const c = await loginClient(ADVISOR_EMAIL, ADVISOR_PASSWORD);
  const { phaseId, concernId } = await samplePhaseAndConcern(c);

  const { error } = await c.rpc('create_consultation_post', {
    p_phase_id: phaseId,
    p_title: `RLS QA advisor ${Date.now()}`,
    p_body: 'Advisor should not be able to create consultation.',
    p_concern_ids: [concernId],
  });

  assert.notEqual(error, null, 'Advisor should be rejected by RLS/policy');
});
