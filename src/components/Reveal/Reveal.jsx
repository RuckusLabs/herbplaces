import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './reveal.module.scss';

export default function Reveal({ as: Element = 'section', className = '', children, ...props }) {
  const ref = useRef(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setEntered(true);
        observer.disconnect();
      }
    }, { threshold: .08 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <Element ref={ref} className={`${className} ${entered ? styles.entered : ''}`} {...props}>{children}</Element>;
}
Reveal.propTypes = { as: PropTypes.elementType, className: PropTypes.string, children: PropTypes.node.isRequired };
