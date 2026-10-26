import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { policyPages } from '../../utilities/policyPages';
import styles from '../../components/PlaceManagement/management.module.scss';

export default function Policies({ mode }) {
  const privacy = mode === 'privacy';
  const content = policyPages[mode];
  return <main id="main-content" className={styles.page}>
    <Helmet><title>{content.title} | Little Herb Places</title></Helmet>
    <h1>{content.title}</h1>
    {content.sections.map(section => <section className={styles.card} key={section.heading}>
      <h2>{section.heading}</h2>
      {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph.map((part, partIndex) => typeof part === 'string' ? part : <a key={partIndex} href={part.href} {...(part.href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{part.text}</a>)}</p>)}
    </section>)}
    <p><Link to="/help">Help & Billing</Link> · <Link to={privacy ? '/membership-terms' : '/privacy'}>{privacy ? 'Membership Terms' : 'Privacy'}</Link></p>
  </main>;
}
Policies.propTypes = { mode: PropTypes.oneOf(['privacy', 'terms']).isRequired };
