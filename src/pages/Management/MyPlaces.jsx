import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { bloomAvailable, managementAction, openBillingUrl } from '../../utilities/managementApi';
import { bloomOffer } from '../../../supabase/functions/_shared/billingCatalog.js';
import { getSubscriptionLabel, subscriptionAllowsEditing } from '../../../supabase/functions/_shared/entitlements.js';
import ListingRequestCards from '../../components/PlaceManagement/ListingRequestCards';
import { getMyPlacesView } from '../../utilities/myPlaces';
import Icon from '../../components/Icons/Icon';
import BusinessTools from '../../components/BusinessTools/BusinessTools';
import styles from '../../components/PlaceManagement/management.module.scss';

export default function MyPlaces() {
  const { user, loading: authLoading } = useAuth();
  const management = useManagement();
  const refresh = management.refresh;
  const listingRequests = management.listingRequests;
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const synced = useRef('');
  const returnedPlace = params.get('billing') === 'returned' ? params.get('place') : '';
  useEffect(() => {
    if (!returnedPlace || !user || synced.current === returnedPlace) return;
    synced.current = returnedPlace;
    managementAction('sync-billing', returnedPlace).then(() => {
      setNotice('Billing status refreshed. Payment confirmation can take a moment.'); refresh();
    }).catch(failure => setError(failure.message));
  }, [returnedPlace, user, refresh]);
  const billing = async (action, placeId) => {
    setBusy(String(placeId)); setError(''); setNotice('');
    try {
      const response = await managementAction(action, placeId);
      if (response.url) openBillingUrl(response.url);
      else { await management.refresh(); setNotice('Billing status refreshed.'); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(''); }
  };
  if (authLoading) return <main id="main-content" className={styles.page}><p role="status">Gathering your places…</p></main>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/my-places${params.size ? `?${params}` : ''}`)}`} replace />;
  if (!management.loading && !listingRequests.loading && !management.error && !listingRequests.error && !management.hasOwnerActivity) return <Navigate to="/favorites" replace />;
  const returnedMembership = management.memberships.find(item => String(item.place_id) === returnedPlace);
  const activated = returnedMembership && subscriptionAllowsEditing(returnedMembership.subscription);
  const { pendingClaims, activeRequests, pastClaims, pastRequests } = getMyPlacesView(management.memberships, management.claims, listingRequests.requests);
  const historyCount = pastClaims.length + pastRequests.length;
  const hasPlaces = !!management.memberships.length;
  const claimsList = (claims, history = false) => <ul className={styles.requestCards} role="list">{claims.map(claim => <li key={claim.id}><article className={`${styles.requestCard} ${history ? styles.requestDeclined : styles.requestPending}`}>
    <div className={styles.requestCardTop}><Icon name={history ? 'leaf' : 'brand-clock'} size={32} /><span className={styles.requestBadge}>{history ? claim.status === 'approved' ? 'Previously approved' : 'Not approved' : 'Pending review'}</span></div>
    <h3 className={styles.claimCardTitle}><Link to={`/place/${claim.urlSlug}`}>{claim.name}</Link></h3>
    {claim.review_note && <div className={styles.requestReviewNote}><strong>From our team</strong><p>{claim.review_note}</p></div>}
    {!history && <p className={styles.requestExplanation}>We’re reviewing your connection to this place. No payment is needed yet.</p>}
    {claim.status === 'rejected' && <p className={styles.requestExplanation}>You can <Link to={`/place/${claim.urlSlug}?claim=1`}>return to the listing to submit updated details</Link>, or <a href="mailto:help@littleherbplaces.com">contact us for help</a>.</p>}
    {history && claim.status === 'approved' && <p className={styles.requestExplanation}>This claim was previously approved. <a href="mailto:help@littleherbplaces.com">Contact us</a> if you need management access again.</p>}
  </article></li>)}</ul>;
  return <main id="main-content" aria-labelledby="my-places-title" className={`${styles.page} ${styles.ownerPage}`}>
    <Helmet><title>My Places | Little Herb Places</title><meta name="robots" content="noindex" /></Helmet>
    <header className={styles.ownerHeader}><div><h1 id="my-places-title">My Places</h1><p>{hasPlaces ? 'A little home for the place you care for.' : 'Your place, and what comes next.'}</p></div><button className={styles.ownerTextButton} disabled={management.loading || listingRequests.loading} onClick={() => { management.refresh(); listingRequests.refresh(); }}>Refresh Access</button></header>
    {management.loading && <p role="status">Refreshing your places…</p>}
    {(management.error || error) && <p role="alert" className={styles.error}>{error || management.error}</p>}
    {listingRequests.error && <p role="alert" className={styles.error}>{listingRequests.error} Use Refresh Access to try again.</p>}
    {activated ? <p role="status" className={styles.notice}>Bloom is active for {returnedMembership.place.name}. You’re ready to update your listing. <Link to={`/place/${returnedMembership.place.urlSlug}`}>Edit Your Place</Link></p>
      : returnedPlace && !error ? <p role="status" className={styles.notice}>We’re checking your payment. If it hasn’t updated yet, open Membership Details below and refresh your billing status. You don’t need to pay again.</p>
        : notice && <p role="status" className={styles.notice}>{notice}</p>}
    {params.get('billing') === 'canceled' && management.memberships.some(item => item.is_billing_contact && !subscriptionAllowsEditing(item.subscription)) && <div role="status" className={`${styles.notice} ${styles.ownerCheckoutNotice}`}><span>Checkout wasn’t completed. You can continue below when you’re ready.</span><button className={styles.ownerTextButton} onClick={() => { const next = new URLSearchParams(params); next.delete('billing'); setParams(next, { replace: true }); }}>Dismiss</button></div>}
    <div className={`${styles.ownerPlaces} ${management.memberships.length === 1 ? styles.singlePlace : ''}`}>{management.memberships.map(membership => {
      const subscription = membership.subscription;
      const canEdit = management.is_admin || membership.can_edit || subscriptionAllowsEditing(subscription);
      const activeBilling = subscription && !['none', 'canceled', 'incomplete_expired'].includes(subscription.status);
      const canSubscribe = membership.is_billing_contact && !activeBilling;
      return <article aria-labelledby={`managed-place-${membership.place_id}`} className={styles.ownerPlaceCard} key={membership.place_id}>
        <div className={styles.ownerPlaceTop}><span className={styles.ownerApproved}><Icon name="shop" size={30} /> Ownership approved</span><span className={styles.status}>{(!subscription || subscription.status === 'none') && !canEdit ? 'Ready for Bloom' : getSubscriptionLabel(subscription)}</span></div>
        <h2 id={`managed-place-${membership.place_id}`}>{membership.place.name}</h2>
        {[membership.place.address, membership.place.city, membership.place.state].some(Boolean) && <p className={styles.requestLocation}><Icon name="pin" size={17} /><span>{[membership.place.address, membership.place.city, membership.place.state].filter(Boolean).join(', ')}</span></p>}
        <p className={styles.ownerNextStep}>{canEdit ? 'Keep your story, photos, and place details up to date.' : canSubscribe ? bloomAvailable ? 'Your place is approved. Add Bloom to edit your story, photos, and place details.' : 'Your ownership is approved. Bloom subscriptions are coming soon; return here when they open. No payment is needed now.' : membership.is_billing_contact ? 'Your listing stays visible. Open Manage Billing with Stripe to restore editing.' : 'Your listing is visible. Your billing contact can manage membership and editing access.'}</p>
        {subscription?.status === 'past_due' && subscription.grace_ends_at && <p className={styles.small}>Payment grace period ends {new Date(subscription.grace_ends_at).toLocaleString()}. Open Manage Billing with Stripe to resolve your payment.</p>}
        {subscription?.status === 'incomplete' && <p>Payment is incomplete. Open Manage Billing with Stripe to check your invoice or finish payment, then refresh your billing status.</p>}
        {subscription?.cancel_at_period_end && subscription.paid_until && <p className={styles.small}>Editing remains available through {new Date(subscription.paid_until).toLocaleDateString()}.</p>}
        <div className={styles.ownerPrimaryActions}>
          {canSubscribe && <button className="button" disabled={!!busy || !bloomAvailable} onClick={() => billing('checkout', membership.place_id)}>{busy === String(membership.place_id) ? 'Please Wait…' : bloomAvailable ? `Subscribe to Bloom · $${bloomOffer.amount / 100}/month` : 'Bloom Coming Soon'}</button>}
          {canEdit && <Link className="button" to={`/place/${membership.place.urlSlug}`}>View & Edit Place <Icon name="arrow" size={16} /></Link>}
          {!canEdit && activeBilling && membership.is_billing_contact && <button className="button" disabled={!!busy} onClick={() => billing('portal', membership.place_id)}>Manage Billing with Stripe</button>}
          {!canEdit && <Link to={`/place/${membership.place.urlSlug}`}>View Place <Icon name="arrow" size={16} /></Link>}
          {membership.is_billing_contact && subscription && subscription.status !== 'none' && (canEdit || !activeBilling) && <button className={styles.ownerTextButton} disabled={!!busy} onClick={() => billing('portal', membership.place_id)}>Manage Billing with Stripe</button>}
        </div>
        <BusinessTools place={membership.place} onChanged={management.refresh} />
        <details className={styles.ownerMembership}><summary><span>Membership Details</span><svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary><div className={styles.membershipPanel}>
          <div className={styles.membershipPlan}><Icon name="sun" size={40} /><div><h3>Bloom</h3><p>{bloomOffer.label}</p></div><span className={styles.membershipStatus}>{!subscription || subscription.status === 'none' ? 'Not subscribed' : getSubscriptionLabel(subscription)}</span></div>
          <p className={styles.membershipIncludes}>Listing edits · Up to 10 photos · All approved managers</p>
          <dl className={styles.membershipFacts}><div><dt>Your role</dt><dd>{membership.is_billing_contact ? 'Billing contact' : 'Place manager'}</dd></div><div><dt>Editing access</dt><dd>{canEdit ? 'Available' : activeBilling ? 'Paused' : 'Not active'}</dd></div>{subscription?.paid_until && <div><dt>Paid through</dt><dd>{new Date(subscription.paid_until).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</dd></div>}</dl>
          <div className={styles.membershipFooter}><div><p>{membership.is_billing_contact ? 'Payments and cancellations are managed securely with Stripe.' : 'Your billing contact manages payments and renewals.'}</p><p>Published content stays visible if editing access ends. <Link to="/membership-terms">Membership terms</Link></p></div>{membership.is_billing_contact && <button className={styles.membershipRefresh} disabled={!!busy} onClick={() => billing('sync-billing', membership.place_id)}><Icon name="brand-clock" size={22} />Refresh Billing Status</button>}</div>
        </div></details>
      </article>;
    })}</div>
    {!!activeRequests.length && <section className={styles.ownerPending} aria-labelledby="my-listing-requests-title"><h2 id="my-listing-requests-title">{hasPlaces ? 'Other places in progress' : 'Your Listing Requests'}</h2><ListingRequestCards requests={activeRequests} management={management} headingLevel="h3" /></section>}
    {!!pendingClaims.length && <section className={styles.ownerPending} aria-labelledby="my-claims-title"><h2 id="my-claims-title">{hasPlaces ? 'Ownership reviews in progress' : 'Your Claim Requests'}</h2>{claimsList(pendingClaims)}</section>}
    {!management.loading && !listingRequests.loading && !hasPlaces && !activeRequests.length && !pendingClaims.length && !management.error && !listingRequests.error && <p className={styles.ownerEmpty}>No places to manage yet. <Link to="/the-little-garden/start?plan=bloom">Find your place to get started</Link>.{historyCount > 0 && ' Your earlier decisions are saved in Past requests below.'}</p>}
    {!!historyCount && <details className={styles.ownerHistory}><summary>Past requests <span>{historyCount}</span></summary><p>Earlier decisions stay here for reference. They don’t affect your current place.</p>{claimsList(pastClaims, true)}{!!pastRequests.length && <ListingRequestCards requests={pastRequests} management={management} headingLevel="h3" />}</details>}
    {!user.email_confirmed_at && <p><Link to="/auth/resend-confirmation?next=%2Fmy-places">Send a Confirmation Email</Link></p>}
    <footer className={styles.ownerFooter}><Link to="/request-place">Request a Listing</Link><Link to="/request-place#listing-requests">All Listing Requests</Link><Link to="/help">Need a Hand?</Link>{management.is_admin && <Link to="/admin">Open Admin</Link>}</footer>
  </main>;
}
