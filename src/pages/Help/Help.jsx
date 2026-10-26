import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { bloomOffer } from '../../../supabase/functions/_shared/billingCatalog.js';
import { passwordlessEnabled } from '../../utilities/authFeatures';
import styles from '../../components/PlaceManagement/management.module.scss';

const questions = [
  ['How do I claim my place?', <>Find your listing in <Link to="/map">Explore Places</Link> and choose Claim This Place. Add details that let our team verify your connection, create or sign in to a confirmed account, then review and submit your claim. Claiming is free.</>],
  ['My place isn’t listed. What should I do?', <><Link to="/request-place">Request a listing</Link>. Our team reviews suggestions before adding them. Adding a listing and approving management access are separate steps.</>],
  ['Where can I find my claim decision?', <>Open <Link to="/my-places">My Places</Link> for your status and review notes. A rejected claim remains visible so you can review what’s needed and submit updated details. If the place already has a manager, contact us for help.</>],
  ['How do I recover my account?', passwordlessEnabled ? <>Open <Link to="/login">Sign In with Email</Link> and enter the email address on your account. We’ll send a six-digit code; you don’t need a password. Check spam if it doesn’t arrive, and use the newest code. If you no longer have access to that inbox, contact us for help. Signing in does not submit an unfinished ownership claim.</> : <>Use <Link to="/auth/forgot-password">Reset Your Password</Link> or <Link to="/auth/resend-confirmation">Send a Confirmation Email</Link>. Check spam and use the newest email. Confirmation does not submit an unfinished ownership claim.</>],
  ['Can more than one person manage a place?', <>Yes. A place’s subscription covers all approved managers. Only the designated billing contact can open payment details. Contact us to add or change managers or transfer billing responsibility.</>],
  ['What does verified mean?', <>Our team has approved a management relationship or reviewed the listing editorially. Verification is independent of subscription payment. It does not certify medical claims, products, or services. Contact us if ownership or listing details are incorrect.</>],
  ['What photos can I upload?', <>Bloom supports up to 10 photos per place. Use JPEG, PNG, or WebP files up to 10 MB each, and upload only images you have permission to publish. Add descriptions for accessibility. Preview your changes, then publish.</>],
];

export default function Help() {
  return <main id="main-content" className={styles.page}>
    <Helmet><title>Help & Billing | Little Herb Places</title></Helmet>
    <h1>A Little Help Along the Way.</h1>
    <p className={styles.intro}>Questions about your account, ownership claim, or subscription? Start here, or email <a href="mailto:help@littleherbplaces.com">help@littleherbplaces.com</a>.</p>
    {questions.map(([question, answer]) => <section className={styles.card} key={question}><h2>{question}</h2><p>{answer}</p></section>)}
    <section id="billing" className={styles.card}><h2>Billing & Cancellation</h2>
      <p>Bloom’s launch offer is {bloomOffer.label}, billed in USD. Claim approval comes before payment. Purchases remain unavailable until billing is enabled; no subscription starts when you create an account or submit a claim.</p>
      <p>Bloom renews monthly until canceled. The billing contact can open My Places → Manage Billing with Stripe to update payment details, view invoices, and cancel future renewals. Editing continues through the paid period when cancellation is scheduled for period end. Published content remains visible afterward.</p>
      <p>If a renewal fails, eligible subscriptions have a seven-day editing grace period from the first failure. Resolve the payment in Manage Billing with Stripe, then refresh billing status. Renewed payment attempts do not restart that window.</p>
      <p>Already paid but editing is still locked? Choose Refresh Billing Status in My Places. Please don’t purchase another subscription. If it remains locked, contact us with the listing name and payment date.</p>
      <p>For billing corrections or refund requests, email us with the listing name and invoice reference. Don’t send card details or passwords. See <Link to="/membership-terms">membership terms</Link> and our <Link to="/privacy">privacy information</Link>.</p>
    </section>
    <section id="thrive" className={styles.card}><h2>What’s happening with Thrive?</h2><p>Thrive is coming soon at $49/month per place and is not yet available for purchase. Product and service showcases and promotion options are being developed. We’ll confirm exactly what’s included before accepting payment. <a href="mailto:help@littleherbplaces.com?subject=Thrive%20inquiry">Ask us about Thrive</a>.</p></section>
  </main>;
}
