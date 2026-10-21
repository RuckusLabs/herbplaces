import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { managementRpc } from '../utilities/managementApi';

export default function useListingRequests() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id;
  const confirmedAt = user?.email_confirmed_at;
  const generation = useRef(0);
  const [state, setState] = useState({ owner: null, requests: [], loading: false, error: '' });
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!confirmedAt) {
      setState({ owner: userId || null, requests: [], loading: false, error: '' });
      return;
    }
    setState(previous => ({ owner: userId, requests: previous.owner === userId ? previous.requests : [], loading: true, error: '' }));
    try {
      const requests = await managementRpc('get_listing_requests');
      if (request === generation.current) setState({ owner: userId, requests: requests || [], loading: false, error: '' });
    } catch (failure) {
      if (request === generation.current) setState(previous => ({ ...previous, loading: false, error: failure.message || 'Unable to load listing requests.' }));
    }
  }, [userId, confirmedAt]);
  useEffect(() => {
    const counter = generation;
    refresh();
    const focus = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener('focus', focus);
    return () => { counter.current++; window.removeEventListener('focus', focus); };
  }, [refresh, pathname]);
  const current = state.owner === (userId || null);
  return { requests: current ? state.requests : [], loading: !current || state.loading, error: current ? state.error : '', refresh };
}
