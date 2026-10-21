import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icons/Icon';
import PlaceClaim from '../../components/PlaceManagement/PlaceClaim';
import RequestPlace from '../Management/RequestPlace';
import usePlaces from '../../hooks/usePlaces';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { bloomAvailable } from '../../utilities/managementApi';
import { filterPlaces } from '../../utilities/placeFilters';
import styles from './startBusiness.module.scss';

export default function StartBusiness() {
  const [params, setParams] = useSearchParams();
  const thrive = params.get('plan') === 'thrive';
  const plan = thrive ? 'thrive' : 'bloom';
  const adding = params.get('new') === '1';
  const selectedSlug = params.get('place') || '';
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(null);
  const { places, loading, error, retry } = usePlaces(!adding);
  const management = useManagement();
  const { user } = useAuth();
  const selected = places.find(place => place.urlSlug === selectedSlug);
  const membership = selected && management.memberships.find(item => String(item.place_id) === String(selected.id));
  const pending = selected && management.claims.find(item => String(item.place_id) === String(selected.id) && item.status === 'pending');
  const statusNotice = notice?.slug === selectedSlug ? notice.message : '';
  const step = membership ? 4 : pending || statusNotice ? 3 : selected ? 2 : 1;
  const matches = query.trim().length >= 2 ? filterPlaces(places, query) : [];
  const choose = place => { setNotice(null); setParams({ plan, place: place.urlSlug, claim: '1' }); };
  const closeClaim = () => setParams({ plan, place: selectedSlug }, { replace: true });
  const returnPath = `/the-little-garden/start?${new URLSearchParams({ plan, place: selectedSlug, claim: '1' })}`;
  return <main id="main-content" className={styles.page}>
    <Helmet><title>Get Started with {thrive ? 'Thrive' : 'Bloom'} | Little Herb Places</title></Helmet>
    <Link className={styles.back} to={`/the-little-garden/${plan}`}>← Back to {thrive ? 'Thrive' : 'Bloom'}</Link>
    <header className={styles.header}><Icon name={thrive ? 'thrive' : 'sun'} size={60} /><p className={styles.eyebrow}>{thrive ? 'Get to know the Thrive pilot' : 'Get started with Bloom'}</p><h1>Let’s start with your place.</h1><p>Find your listing or tell us about a place we haven’t met yet. We’ll guide you through ownership review before any payment.</p></header>
    <ol className={styles.progress} aria-label="Your path to managing a place">{['Your place', 'Ownership details', 'Our review', 'Bloom & editing'].map((label, index) => <li key={label} aria-current={index + 1 === step ? 'step' : undefined}>{index + 1} · {label}</li>)}</ol>
    {thrive && <aside className={styles.note}><strong>Thrive is a planned pilot.</strong><p>You can prepare your listing and claim ownership now. This flow does not subscribe you to Thrive. Its proposed price and features will be confirmed before purchase.</p><a href={`mailto:help@littleherbplaces.com?subject=${encodeURIComponent('Thrive pilot inquiry')}${selected ? `&body=${encodeURIComponent(`I'd like to learn about Thrive for ${selected.name} in ${[selected.city, selected.state].filter(Boolean).join(', ')}.`)}` : ''}`}>Ask About the Thrive Pilot</a></aside>}
    {adding ? <><div className={styles.branchHeading}><button type="button" onClick={() => setParams({ plan })}>← Search existing listings instead</button><p>Step 1 · Request your listing</p></div><RequestPlace embedded /></> : <>
      {statusNotice && <div className={styles.note} role="status"><p>{statusNotice}</p><Link className="button" to="/favorites#my-places">Track My Claim</Link></div>}
      {selected ? <section className={styles.panel} aria-labelledby="selected-title"><p className={styles.eyebrow}>Your selected place</p><h2 id="selected-title">{selected.name}</h2><p>{[selected.city, selected.state].filter(Boolean).join(', ')}</p>
        {management.loading ? <p role="status">Checking your access…</p> : management.error ? <div role="alert"><p>{management.error}</p><button className="button" onClick={management.refresh}>Check Again</button>{user && !user.email_confirmed_at && <Link to={`/auth/resend-confirmation?next=${encodeURIComponent(returnPath)}`}>Confirm your account email</Link>}</div>
          : membership ? <><p>Your ownership is approved. Continue in My Places to {bloomAvailable ? 'manage your Bloom subscription and editing access' : 'see your access; Bloom purchases are coming soon'}.</p><Link className="button" to="/favorites#my-places">Continue to My Places</Link></>
            : pending || statusNotice ? <><p>Your claim is with our review team. No payment is needed while we review it.</p><Link className="button" to="/favorites#my-places">View Claim Status</Link></>
              : selected.is_claimed !== false ? <><p>This place already has a manager. Contact us to confirm access or join the existing team.</p><a className="button" href={`mailto:help@littleherbplaces.com?subject=${encodeURIComponent(`Manager access for ${selected.name}`)}`}>Get Help with Access</a></>
                : <><p>Next, tell us how you’re connected to this place. You can enter your details before signing in or creating a free account.</p><button className="button" onClick={() => setParams({ plan, place: selectedSlug, claim: '1' })}>Continue to Ownership Details <Icon name="arrow" size={18} /></button></>}
        <button className={styles.textButton} onClick={() => { setNotice(null); setParams({ plan }); }}>Choose a Different Place</button>
      </section> : <section className={styles.panel} aria-labelledby="search-title"><h2 id="search-title">Is your place already here?</h2><p>Search by business name or city. Choose your listing to start your ownership claim right here.</p><label className={styles.search}>Business name or city<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. your shop name or Denver" maxLength={200} autoComplete="off" /></label>
        {loading && <p role="status">Finding little places…</p>}
        {error && <div role="alert"><p>We couldn’t load the directory. Try again before requesting a new listing.</p><button className="button" onClick={retry}>Try Again</button></div>}
        {!loading && !error && <div aria-live="polite">{query.trim().length < 2 ? <p className={styles.small}>Enter at least two characters to find your place.</p> : <><p className={styles.small}>{matches.length ? `${matches.length} matching ${matches.length === 1 ? 'place' : 'places'}${matches.length > 6 ? ' · showing the first 6; add more detail to narrow your search' : ''}` : 'No matching listings. You can request yours below.'}</p><ul className={styles.results}>{matches.slice(0, 6).map(place => <li key={place.id}><div><strong>{place.name}</strong><span>{[place.city, place.state].filter(Boolean).join(', ')}</span></div><button className="button" onClick={() => choose(place)} aria-label={`Continue with ${place.name}`}>This Is My Place <Icon name="arrow" size={16} /></button></li>)}</ul></>}</div>}
        <div className={styles.missing}><h3>Not listed yet?</h3><p>Tell us about your business. Once the listing is added, you’ll continue with an ownership claim.</p><button className="button" onClick={() => setParams({ plan, new: '1' })}>Add My Place <Icon name="arrow" size={18} /></button></div>
      </section>}
      {selectedSlug && !selected && !loading && !error && <p role="status">That listing is no longer available. Search again or request a listing.</p>}
    </>}
    <p className={styles.reassurance}>Free to request. Free to claim. {bloomAvailable ? 'Bloom payment comes after approval.' : 'Bloom purchases are coming soon.'} <Link to="/membership-terms">Membership terms</Link></p>
    <p className={styles.small}>Already approved? <Link to="/favorites#my-places">Open My Places</Link> to manage your subscription and listing.</p>
    {selected && params.get('claim') === '1' && !management.loading && !management.error && !membership && !pending && !statusNotice && selected.is_claimed === false && <PlaceClaim key={selected.id} place={selected} returnPath={returnPath} onClose={closeClaim} onSubmitted={message => { setNotice({ slug: selectedSlug, message }); closeClaim(); }} />}
  </main>;
}
