import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import supabase from '../utilities/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GUEST_FAVORITES_KEY, getGuestFavorites, toggleGuestFavorite, clearSyncedGuestFavorites, createAccountFavoritesLoader } from '../utilities/favorites';

const FavoritesContext = createContext(null);
const loadAccountFavorites = createAccountFavoritesLoader(supabase);

export function FavoritesProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const owner = user?.id || null;
  const [state, setState] = useState(() => ({ owner: null, favorites: getGuestFavorites(), ready: false, error: '' }));
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const favorites = state.owner === owner ? state.favorites : [];

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    if (!owner) {
      setState({ owner: null, favorites: getGuestFavorites(), ready: true, error: '' });
      return;
    }
    setState(previous => ({ ...previous, ready: false, error: '' }));
    loadAccountFavorites(owner).then(({ favorites: saved, syncedIds }) => {
      if (!active) return;
      clearSyncedGuestFavorites(syncedIds);
      setState({ owner, favorites: saved, ready: true, error: '' });
    }).catch(() => {
      if (active) setState({ owner, favorites: [], ready: true, error: 'We couldn’t sync your saved places. Your device’s saves are still here. Please try again.' });
    });
    return () => { active = false; };
  }, [owner, authLoading, attempt]);

  useEffect(() => {
    const sync = event => {
      if (event.key !== GUEST_FAVORITES_KEY && event.key !== null) return;
      if (owner) { if (getGuestFavorites().length) retry(); }
      else setState({ owner: null, favorites: getGuestFavorites(), ready: true, error: '' });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [owner, retry]);

  const isFavorited = itemId => favorites.some(favorite => String(typeof favorite === 'string' ? favorite : favorite.item_id) === String(itemId));
  const toggleFavorite = async (itemId, itemType = 'place') => {
    if (authLoading) throw new Error('Please wait for your account to finish loading.');
    if (!owner) {
      const result = toggleGuestFavorite(itemId);
      setState({ owner: null, favorites: result.favorites, ready: true, error: '' });
      return result.saved;
    }
    const id = String(itemId);
    const saved = isFavorited(id);
    const query = saved
      ? supabase.from('favorites').delete().eq('user_id', owner).eq('item_id', id)
      : supabase.from('favorites').insert([{ user_id: owner, item_id: id, item_type: itemType }]).select().single();
    const { data, error } = await query;
    if (error) throw error;
    if (!saved && !data) throw new Error('The saved place could not be confirmed.');
    setState(previous => previous.owner !== owner ? previous : {
      ...previous,
      favorites: saved ? previous.favorites.filter(favorite => String(favorite.item_id) !== id) : [data, ...previous.favorites],
    });
    return !saved;
  };

  return <FavoritesContext.Provider value={{ favorites, error: state.owner === owner ? state.error : '', retry, loading: authLoading || !state.ready || state.owner !== owner, isFavorited, toggleFavorite, isLoggedIn: !!owner }}>{children}</FavoritesContext.Provider>;
}
FavoritesProvider.propTypes = { children: PropTypes.node.isRequired };
export function useFavorites() { return useContext(FavoritesContext); }
