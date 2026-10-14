import { createClient } from '@supabase/supabase-js';
import { proSettings } from '../_shared/pro.ts';
import { stripeClient } from '../_shared/stripe.ts';
import { billingHandler } from './handler.ts';
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(billingHandler({ settings: proSettings, admin, stripe: stripeClient }));
