import supabase, { configurationMessage } from './supabase';
import { createPlaceLoader } from './placeCache';

export const legacyPublicFields = 'id,name,urlSlug,tagline,description,website,address,city,state,zip,coverPhoto,photos,isFeatured,isVerified,latitude,longitude';
export const publicFields = `${legacyPublicFields},phone,hours,social_links,category_ids,photo_alt,content_version,geocode_status,updated_at,category,type,categories,is_claimed`;

export default createPlaceLoader({
  request: async () => {
    if (!supabase) throw new Error(configurationMessage);
    let response = await supabase.from('public_places').select(publicFields).order('city', { ascending: true });
    // Keep discovery working while the additive management migration is being installed.
    if (['PGRST205', '42P01'].includes(response.error?.code)) response = await supabase.from('places').select(legacyPublicFields).order('city', { ascending: true });
    if (response.error) throw response.error;
    return response.data;
  },
});
