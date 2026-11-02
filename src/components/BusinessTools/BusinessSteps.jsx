import PropTypes from 'prop-types';
import styles from './growth.module.scss';

export default function BusinessSteps({ current = 0 }) {
  const steps = ['Find Your Business', 'Verify Ownership', 'Choose Bloom', 'Publish Your Profile'];
  return <nav className={styles.steps} aria-label="Business setup progress"><ol>{steps.map((label, index) => <li key={label} aria-current={index === current ? 'step' : undefined}><span aria-hidden="true">{index < current ? '✓' : index + 1}</span>{label}</li>)}</ol><p>Claiming and essential corrections are free. Bloom is optional; ownership approval comes before payment.</p></nav>;
}
BusinessSteps.propTypes = { current: PropTypes.number };
