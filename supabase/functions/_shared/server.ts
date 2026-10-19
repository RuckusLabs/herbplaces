import { createClient } from 'npm:@supabase/supabase-js@2.47.14';
import Stripe from 'npm:stripe@18.5.0';

export function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Server configuration missing: ${name}`);
  return value;
}

export function serviceClient() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}

export function stripeClient() {
  return new Stripe(required('STRIPE_SECRET_KEY'), { httpClient: Stripe.createFetchHttpClient() });
}

export function allowedOrigin(req: Request) {
  const origin = req.headers.get('Origin');
  const origins = (Deno.env.get('ALLOWED_ORIGINS') || required('SITE_URL')).split(',').map(item => item.trim());
  return origin && origins.includes(origin) ? origin : '';
}

export function corsHeaders(req: Request) {
  return { 'Access-Control-Allow-Origin': allowedOrigin(req), 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}

export function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

export async function checked<T>(result: { data: T; error: { message: string } | null }): Promise<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function authenticated(req: Request, db = serviceClient()) {
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Sign in to continue.');
  const { data: { user }, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !user?.email_confirmed_at) throw new Error('Sign in with a confirmed email to continue.');
  return user;
}
