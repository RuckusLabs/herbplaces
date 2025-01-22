import supabase from './supabase';

const CACHE_KEY = 'places_cache';
const CACHE_DURATION = 72 * 60 * 60 * 1000; // 72 hours in milliseconds

const fetchPlaces = async () => {
  // Try to get cached data from localStorage
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    // Check if cache is still valid
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .order('id');

    if (error) {
      console.error('Error fetching places:', error.message);
      throw error;
    }

    // Store in localStorage with timestamp
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: data ?? [],
      timestamp: Date.now()
    }));

    return data ?? [];
  } catch (err) {
    console.error('Error fetching places:', err.message);
    throw err;
  }
};

export default fetchPlaces;