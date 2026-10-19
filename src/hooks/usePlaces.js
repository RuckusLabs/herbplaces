import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { getPlacesSnapshot, subscribeToPlaces, refreshPlaces } from '../utilities/placesStore';

export default function usePlaces(enabled = true) {
  const state = useSyncExternalStore(subscribeToPlaces, getPlacesSnapshot);
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (enabled) refreshPlaces();
  }, [enabled, pathname, search]);
  useEffect(() => {
    if (!enabled) return;
    const focus = () => refreshPlaces();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [enabled]);
  return { ...(enabled ? state : { places: [], loading: false, error: '' }), retry: refreshPlaces };
}
