import { createBusinessJourneyHandler } from '../_shared/businessJourney.js';
import { serviceClient } from '../_shared/server.ts';

const rpc = async (name: string, params: Record<string, unknown>) => {
  const { error } = await serviceClient().rpc(name, params);
  if (error) throw error;
};
Deno.serve(createBusinessJourneyHandler({
  origins: (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('SITE_URL') || '').split(',').map(value => value.trim()).filter(Boolean),
  secret: Deno.env.get('ACTIVITY_HASH_SECRET'),
  eventsEnabled: Deno.env.get('BUSINESS_JOURNEY_ENABLED') === 'true',
  recordEvent: params => rpc('record_business_interest', params),
}));
