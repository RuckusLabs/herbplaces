import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import styles from '../Auth/auth.module.scss';

export default function ReportUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const [result, setResult] = useState({ token, status: '', error: '' });
  const { status, error } = result.token === token ? result : { status: '', error: '' };
  const stop = async () => {
    if (!valid || status === 'saving') return;
    setResult({ token, status: 'saving', error: '' });
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      if (!base) throw new Error('Reports are temporarily unavailable. Please try again later.');
      const url = new URL('/functions/v1/activity-report-unsubscribe', base);
      url.searchParams.set('token', token);
      const response = await fetch(url, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('We couldn’t stop the reports. Please try again.');
      setResult({ token, status: 'stopped', error: '' });
    } catch (failure) { setResult({ token, status: '', error: failure.message || 'We couldn’t stop the reports. Please try again.' }); }
  };
  return <main id="main-content" className={styles.authSection}>
    <Helmet><title>Monthly Business Reports | Little Herb Places</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Helmet>
    <section className={styles.card}>
      <h1>{status === 'stopped' ? 'Monthly reports stopped.' : 'Stop monthly reports?'}</h1>
      {!valid ? <p role="alert">This report link is not valid. Use the link in your report email, or manage reports in My Places.</p> : status === 'stopped' ? <div role="status"><p>You will not receive future monthly business reports for the place linked to this email. You can turn reports back on in My Places.</p></div> : <>
        <p>This stops optional monthly business reports for the place linked to this email.</p>
        <p>Your business subscription and community newsletter preferences stay the same. A report already being sent may still arrive.</p>
        {error && <p role="alert" className={styles.messageError}>{error}</p>}
        <button type="button" className="button" disabled={status === 'saving'} aria-busy={status === 'saving'} onClick={stop}>{status === 'saving' ? 'Stopping Reports…' : 'Stop Monthly Reports'}</button>
      </>}
      <p><Link to="/my-places">Go to My Places</Link></p>
    </section>
  </main>;
}
