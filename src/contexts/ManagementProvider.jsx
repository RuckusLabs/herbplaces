import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useListingRequests from '../hooks/useListingRequests';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import { ManagementContext } from './ManagementContext';
import { managementRpc } from '../utilities/managementApi';

const empty = { is_admin: false, memberships: [], claims: [] };

export default function ManagementProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const listingRequests = useListingRequests();
  const [state, setState] = useState({ owner: null, data: empty, loading: false, error: '' });
  const generation = useRef(0);
  const userId = user?.id;
  const confirmedAt = user?.email_confirmed_at;
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!confirmedAt) {
      setState({ owner: userId || null, data: empty, loading: false, error: userId ? 'Confirm your email before managing a place.' : '' });
      return;
    }
    setState(previous => ({ owner: userId, data: previous.owner === userId ? previous.data : empty, loading: true, error: '' }));
    try {
      await managementRpc('activate_place_invitations');
      const data = await managementRpc('get_management_context');
      if (request === generation.current) setState({ owner: userId, data, loading: false, error: '' });
    } catch (error) {
      if (request === generation.current) setState(previous => ({ owner: userId, data: previous.owner === userId ? previous.data : empty, loading: false, error: error.message || 'Unable to load place access.' }));
    }
  }, [userId, confirmedAt]);
  useEffect(() => {
    const requestCounter = generation;
    if (!authLoading) refresh();
    return () => { requestCounter.current++; };
  }, [authLoading, refresh, pathname]);
  useEffect(() => {
    if (!userId) return;
    const focus = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(focus, 60 * 1000);
    return () => { window.removeEventListener('focus', focus); window.clearInterval(timer); };
  }, [userId, refresh]);
  const current = state.owner === (userId || null);
  return <ManagementContext.Provider value={{ ...(current ? state.data : empty),
    listingRequests, hasOwnerActivity: current && (state.data.is_admin || !!state.data.memberships.length || !!state.data.claims.length || !!listingRequests.requests.length),
    loading: authLoading || !current || state.loading, error: current ? state.error : '', refresh }}>
    {children}
  </ManagementContext.Provider>;
}
ManagementProvider.propTypes = { children: PropTypes.node.isRequired };
