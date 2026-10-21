import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { useManagement } from '../../contexts/ManagementContext';
import { bloomAvailable, managementRpc } from '../../utilities/managementApi';
import { bloomOffer } from '../../../supabase/functions/_shared/billingCatalog.js';
import { claimEvidence, clearClaimDraft, readClaimDraft, saveClaimDraft } from '../../utilities/placeClaim';
import Modal from '../Modal/Modal';
import styles from './management.module.scss';

export default function PlaceClaim({ place, onClose, onSubmitted }) {
  const { user } = useAuth();
  const management = useManagement();
  const navigate = useNavigate();
  const id = useId();
  const [draft, setDraft] = useState(() => readClaimDraft(place.id, user?.email));
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef(null);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest('dialog')?.scrollTo(0, 0);
  }, [reviewing]);
  const update = key => event => setDraft(previous => ({ ...previous, [key]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (!reviewing) {
      if (!draft.name.trim() || draft.evidence.trim().length < 40) { setError('Add your name and at least 40 characters about how we can verify your connection.'); return; }
      setReviewing(true); return;
    }
    if (!user) {
      try { saveClaimDraft(place.id, draft); }
      catch { setError('Your browser couldn’t keep this draft for sign-in. Allow this site to save data, then try again.'); return; }
      navigate(`/login?next=${encodeURIComponent(`/place/${place.urlSlug}?claim=1`)}`);
      return;
    }
    if (busy || management.loading || management.error || !user.email_confirmed_at || !confirmed) return;
    setBusy(true);
    try {
      await managementRpc('request_place_claim', {
        p_place_id: String(place.id), p_relationship: draft.relationship, p_evidence: claimEvidence(draft),
      });
      clearClaimDraft(place.id);
      onSubmitted('Your claim has been sent for review. We’ll check your ownership details. You can follow its status in My Places on your Saved Places page.');
      await management.refresh();
    } catch (failure) { setError(failure.message || 'We couldn’t send your claim. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal open onClose={() => { if (!busy) onClose(); }} labelledBy={`${id}-title`} describedBy={`${id}-intro`} closeLabel="Close claim request" className={styles.claimDialog} contentClassName={styles.claimBody}>
    <p className={styles.claimStep}>Step {reviewing ? '2' : '1'} of 2 · {reviewing ? 'Review your request' : 'Ownership details'}</p>
    <h2 id={`${id}-title`} className={styles.editorHeading} ref={heading} tabIndex={-1}>{reviewing ? 'A Little Check Before You Send.' : `Claim ${place.name}`}</h2>
    <p id={`${id}-intro`}>{reviewing ? `Check your details for ${place.name}. Our team reviews every claim before granting access.` : 'Help us confirm that you own this place or are authorized to manage it. Share a few details our team can check.'}</p>
    <form className={styles.form} onSubmit={submit}>
      {!reviewing ? <>
        <fieldset><legend>Your connection to this place</legend>
          <div className={styles.formRow}>
            <label>Your full name<input autoComplete="name" value={draft.name} onChange={update('name')} required pattern=".*\S.*" maxLength={120} /></label>
            <label>Your role<select value={draft.relationship} onChange={update('relationship')} required><option value="">Choose your role</option><option>Owner</option><option>Co-owner</option><option>Authorized manager</option></select></label>
          </div>
          <div className={styles.formRow}>
            <label>Business email<input type="email" autoComplete="email" value={draft.email} onChange={update('email')} required maxLength={254} /></label>
            <label>Business phone (optional)<input type="tel" autoComplete="tel" value={draft.phone} onChange={update('phone')} maxLength={50} /></label>
          </div>
          <p className={styles.small}>Use an email associated with the business, if you have one. We may use these details to confirm your connection.</p>
        </fieldset>
        <fieldset><legend>Help us verify ownership</legend>
          <label>Verification link (optional)<input type="url" pattern="https?://.+" title="Enter a full website address starting with https:// or http://." value={draft.verificationUrl} onChange={update('verificationUrl')} maxLength={500} placeholder="https://your-business.com/about" aria-describedby={`${id}-link-help`} /></label>
          <p id={`${id}-link-help`} className={styles.small}>A business website, team page, or official social profile that connects you to this place.</p>
          <label>Ownership details<textarea value={draft.evidence} onChange={update('evidence')} required minLength={40} maxLength={1600} aria-describedby={`${id}-evidence-help`} placeholder="Tell us how you’re connected to the business and how we can confirm it." /></label>
          <p id={`${id}-evidence-help`} className={styles.small}>For example, tell us where you’re named as an owner, how your business email matches the website, or who at the business can confirm your role. No public link? Explain another way we can verify you. Please don’t include passwords, ID numbers, or payment details.</p>
        </fieldset>
        <p className={styles.small}>These details go to the Little Herb Places review team and won’t appear on your public listing. When you continue to sign in, a draft is saved on this browser for up to 24 hours. On another device, return to this listing to enter your details again.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}><button className="button" type="submit">Review Claim</button><button className="button" type="button" onClick={onClose}>Cancel</button></div>
      </> : <>
        <dl className={styles.claimSummary}>
          <div><dt>Place</dt><dd>{place.name}</dd></div>
          <div><dt>Your name & role</dt><dd>{draft.name} · {draft.relationship}</dd></div>
          <div><dt>Business email</dt><dd>{draft.email}</dd></div>
          {draft.phone.trim() && <div><dt>Business phone</dt><dd>{draft.phone}</dd></div>}
          {draft.verificationUrl.trim() && <div><dt>Verification link</dt><dd>{draft.verificationUrl}</dd></div>}
          <div><dt>Ownership details</dt><dd>{draft.evidence}</dd></div>
        </dl>
        <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required disabled={busy} />I own this business or am authorized to manage its listing, and these details are accurate.</label>
        <div className={styles.notice}><strong>What happens next?</strong><p>{user ? 'Send your claim and our team will review your ownership details. You can check the decision and any notes in My Places.' : 'Sign in or create a free account, then review and submit your claim. Your details will be kept in this browser for up to 24 hours.'}</p><p>Claiming is free. After approval, an active Bloom subscription enables editing and photo uploads. {bloomAvailable ? `Bloom is ${bloomOffer.label}. ` : 'Bloom purchases are not available yet. '}No payment is taken with this request.</p></div>
        {user && management.error && <div className={styles.error} role="alert"><p>{management.error}</p><button className="button" type="button" onClick={management.refresh} disabled={management.loading}>Check Again</button></div>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button className="button" type="submit" disabled={busy || !!user && (management.loading || !!management.error || !user.email_confirmed_at)}>{busy ? 'Sending…' : user ? 'Submit Claim' : 'Sign In to Send Claim'}</button>
          <button className="button" type="button" disabled={busy} onClick={() => { setReviewing(false); setError(''); }}>Edit Details</button>
        </div>
      </>}
    </form>
  </Modal>;
}
PlaceClaim.propTypes = { place: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired, onSubmitted: PropTypes.func.isRequired };
