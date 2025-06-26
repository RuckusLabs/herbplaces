import { useState, useEffect } from 'react';
import supabase from '/src/utilities/supabase';

const LOCAL_KEY = 'guest_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const isLoggedIn = !!user;

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user || null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      // Load from localStorage for guests
      const local = localStorage.getItem(LOCAL_KEY);
      setFavorites(local ? JSON.parse(local) : []);
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFavorites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  // For guests, store IDs as strings
  const updateGuestFavorites = (itemId) => {
    const id = String(itemId);
    let updated;
    if (favorites.includes(id)) {
      updated = favorites.filter(fav => fav !== id);
    } else {
      updated = [...favorites, id];
    }
    setFavorites(updated);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  };

  const addFavorite = async (itemId, itemType = null) => {
    if (!user) {
      updateGuestFavorites(itemId);
      return;
    }
    const itemIdString = String(itemId);
    try {
      const { data, error } = await supabase
        .from('favorites')
        .insert([{
          user_id: user.id,
          item_id: itemIdString,
          item_type: itemType
        }])
        .select()
        .single();
      if (error) throw error;
      setFavorites(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw error;
    }
  };

  const removeFavorite = async (itemId) => {
    if (!user) {
      updateGuestFavorites(itemId);
      return;
    }
    const itemIdString = String(itemId);
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', itemIdString);
      if (error) throw error;
      setFavorites(prev => prev.filter(fav => fav.item_id !== itemIdString));
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  };

  const isFavorited = (itemId) => {
    if (!itemId) return false;
    const id = String(itemId);
    if (user) {
      return favorites.some(fav => fav.item_id === id);
    } else {
      return favorites.includes(id);
    }
  };

  const toggleFavorite = async (itemId, itemType = null) => {
    if (isFavorited(itemId)) {
      await removeFavorite(itemId);
    } else {
      await addFavorite(itemId, itemType);
    }
  };

  // For syncing after login
  const getGuestFavorites = () => {
    const local = localStorage.getItem(LOCAL_KEY);
    return local ? JSON.parse(local) : [];
  };
  const clearGuestFavorites = () => {
    localStorage.removeItem(LOCAL_KEY);
  };

  return {
    favorites,
    isFavorited,
    toggleFavorite,
    isLoggedIn,
    getGuestFavorites,
    clearGuestFavorites,
    loading,
  };
}