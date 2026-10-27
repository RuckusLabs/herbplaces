import { createPlaceActivityHandler } from '../_shared/placeActivity.js';
import { serviceClient } from '../_shared/server.ts';

Deno.serve(createPlaceActivityHandler({
  origins: (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('SITE_URL') || '').split(',').map(value => value.trim()),
  secret: Deno.env.get('ACTIVITY_HASH_SECRET'),
  record: async params => {
    const { error } = await serviceClient().rpc('record_place_activity', params);
    if (error) throw error;
  },
}));
