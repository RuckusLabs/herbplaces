import supabase, { configurationMessage } from './supabase';
import { createPlaceLoader } from './placeCache';

export default createPlaceLoader({
  request: async () => {
    if (!supabase) throw new Error(configurationMessage);
    const { data, error } = await supabase.from('places').select('*').order('city', { ascending: true });
    if (error) throw error;
    return data;
  },
});
