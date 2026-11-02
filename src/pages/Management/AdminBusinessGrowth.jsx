import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { managementRpc } from '../../utilities/managementApi';
import { readableReportRange } from '../../utilities/activityAdvice';
import { businessJourneyEnabled } from '../../utilities/businessJourney';
import usePlaces from '../../hooks/usePlaces';
import styles from '../../components/BusinessTools/growth.module.scss';
import pageStyles from '../Browse/browse.module.scss';

const names = { plan_view: 'Plan page viewed', plan_cta: 'Plan action selected', business_selected: 'Existing business selected', listing_request_started: 'Missing listing started', claim_submitted: 'Ownership claim submitted', claim_approved: 'Ownership approved', checkout_started: 'Checkout created', subscription_active: 'Paid subscription activated', first_profile_published: 'First owner publish', paid_period_extended: 'Paid period extended' };

export default function AdminBusinessGrowth() {
  const { user, loading: authLoading } = useAuth(); const management = useManagement();
  const allowed = !!user && management.is_admin;
  const { places } = usePlaces(allowed);
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!allowed || !businessJourneyEnabled) { setData(null); return; }
    let active = true; setData(null); setError('');
    managementRpc('admin_business_overview').then(result => { if (active) setData(result); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [allowed, attempt]);
  return <main id="main-content" className={pageStyles.page}>
    <Helmet><title>Business Growth | Admin | Little Herb Places</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <Link to="/admin">← Directory Admin</Link><h1>Business Growth</h1>
    {authLoading || management.loading ? <p role="status">Checking admin access…</p> : !allowed ? <p>Administrator access is required. <Link to="/login?next=%2Fadmin%2Fbusiness-growth">Sign in</Link>.</p> : <>
      <p>Review business interest, recorded subscription stages, and listing completeness.</p><button className="button" onClick={() => setAttempt(value => value + 1)}>Refresh Business Growth</button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {!businessJourneyEnabled && <p>Business measurement is not enabled yet.</p>}
      {businessJourneyEnabled && !data && !error && <p role="status">Gathering business activity…</p>}
      {data && <>
        <section aria-labelledby="business-interest-title"><h2 id="business-interest-title">Business interest · last 30 days</h2><p>{readableReportRange(data.from?.slice(0,10), data.through?.slice(0,10))} · UTC</p><p>Anonymous tab sessions, grouped by plan, device, and entry. These counts cannot identify people or be joined reliably to ownership claims.</p>
          {!data.interest?.length ? <p>No recorded browser interest in this period.</p> : <ul>{data.interest.map(row => <li key={`${row.kind}-${row.plan}-${row.entry}-${row.device}`}><strong>{names[row.kind]}: {row.sessions}</strong> · {row.plan} · {row.device} · {row.entry === 'missing' ? 'missing listing' : 'existing listing'}</li>)}</ul>}
        </section>
        <section aria-labelledby="business-milestones-title"><h2 id="business-milestones-title">Recorded business stages · last 30 days</h2><p>Distinct places reaching each stage during this period. These are stage totals, not a joined cohort or a conversion rate. Existing customers may appear in publishing and period-extension counts. Collection starts when the migration is applied; earlier events are not reconstructed.</p><div className={styles.metrics}>{Object.entries(names).filter(([kind]) => !['plan_view','plan_cta','business_selected','listing_request_started'].includes(kind)).map(([kind, label]) => <article key={kind}><h3>{label}</h3><strong>{Number(data.milestones?.find(row => row.kind === kind)?.places || 0)}</strong><p>places</p></article>)}</div><p className={styles.hint}>Paid-period extension is a billing-state signal, not a verified first-renewal cohort. Measure retention using fully observed customer cohorts before drawing conclusions.</p></section>

      </>}
      <section aria-labelledby="listing-quality-title"><h2 id="listing-quality-title">Listing Details to Check</h2><p>Start with missing visit information. Verify details with the business before publishing; a recent edit is not proof of verification.</p><ul>{places.filter(place => !place.hours?.trim() || !place.phone?.trim() || !place.description?.trim()).slice(0, 20).map(place => <li key={place.id}><Link to={`/place/${place.urlSlug}`}>{place.name}</Link> · {[place.city, place.state].filter(Boolean).join(', ')} · Missing: {[!place.hours?.trim() && 'hours', !place.phone?.trim() && 'phone', !place.description?.trim() && 'description'].filter(Boolean).join(', ')}</li>)}</ul></section>
    </>}
  </main>;
}
