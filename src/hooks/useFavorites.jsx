import { useState, useEffect } from 'react';
import supabase from '/src/utilities/supabase';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getCurrentUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [user]);

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

  const addFavorite = async (itemId, itemType = null) => {
    if (!user) {
      throw new Error('Must be logged in to add favorites');
    }

    // Validate itemId
    if (!itemId || itemId === null || itemId === undefined) {
      throw new Error('Item ID is required and cannot be null or undefined');
    }

    // Convert itemId to string to ensure consistency
    const itemIdString = String(itemId);

    try {
      console.log('Adding favorite:', { user_id: user.id, item_id: itemIdString, item_type: itemType });

      const { data, error } = await supabase
        .from('favorites')
        .insert([{
          user_id: user.id,
          item_id: itemIdString,
          item_type: itemType
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      console.log('Favorite added successfully:', data);
      setFavorites(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw error;
    }
  };

  const removeFavorite = async (itemId) => {
    if (!user) return;

    // Validate itemId
    if (!itemId || itemId === null || itemId === undefined) {
      throw new Error('Item ID is required and cannot be null or undefined');
    }

    // Convert itemId to string to ensure consistency
    const itemIdString = String(itemId);

    try {
      console.log('Removing favorite:', { user_id: user.id, item_id: itemIdString });

      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', itemIdString);

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      console.log('Favorite removed successfully');
      setFavorites(prev => prev.filter(fav => fav.item_id !== itemIdString));
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  };

  const isFavorited = (itemId) => {
    if (!itemId) return false;
    const itemIdString = String(itemId);
    return favorites.some(fav => fav.item_id === itemIdString);
  };

  const toggleFavorite = async (itemId, itemType = null) => {
    if (isFavorited(itemId)) {
      await removeFavorite(itemId);
    } else {
      await addFavorite(itemId, itemType);
    }
  };

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    isFavorited,
    toggleFavorite,
    isLoggedIn: !!user
  };
}