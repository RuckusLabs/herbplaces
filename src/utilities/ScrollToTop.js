import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (previous.current === pathname && !hash) return;
    previous.current = pathname;
    // Lazy routes can mount after this effect. Wait for a meaningful heading,
    // without taking focus away from an active dialog or form.
    const focusPage = () => {
      let target;
      try { target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null; } catch { /* Ignore malformed anchors. */ }
      const heading = hash ? target?.querySelector('h1,h2,h3') || target : document.querySelector('#main-content h1');
      if (!heading || !heading.getClientRects().length || document.querySelector('dialog[open]')) return false;
      heading.tabIndex = -1;
      heading.setAttribute('data-route-focus-target', '');
      heading.focus({ preventScroll: true });
      if (hash) target.scrollIntoView({ block: 'start' });
      return true;
    };
    if (focusPage()) return;
    const observer = new MutationObserver(() => { if (focusPage()) observer.disconnect(); });
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
