import { useEffect, useState } from 'react';
import { getGrowthProfiles, growthEnabled } from '../utilities/growthApi';

export default function useGrowthProfiles() {
  const [state, setState] = useState({ profiles: [], loading: growthEnabled, error: '' });
  const [attempt, retry] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!growthEnabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    if (!growthEnabled) return;
    getGrowthProfiles().then(profiles => { if (active) setState({ profiles, loading: false, error: '' }); })
      .catch(() => { if (active) setState(previous => ({ ...previous, loading: false, error: 'Offerings and highlights could not load. Please try again.' })); });
    return () => { active = false; };
  }, [attempt]);
  return { ...state, now, refresh: () => retry(value => value + 1) };
}
