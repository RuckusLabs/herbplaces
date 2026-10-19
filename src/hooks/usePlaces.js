import { useCallback, useEffect, useState } from 'react';
import fetchPlaces from '../utilities/fetchPlaces';

export default function usePlaces(enabled = true) {
  const [state, setState] = useState({ places: [], loading: enabled, error: '' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    fetchPlaces({ force: attempt > 0 }).then(places => {
      if (active) setState({ places, loading: false, error: '' });
    }).catch(() => {
      if (active) setState({ places: [], loading: false, error: 'We couldn’t load the places right now. Give it another try in a moment.' });
    });
    return () => { active = false; };
  }, [enabled, attempt]);
  return { ...state, retry };
}
