import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (previous.current === pathname) return;
    previous.current = pathname;
    // Lazy routes can mount after this effect. Wait for a meaningful heading,
    // without taking focus away from an active dialog or form.
    const focusPage = () => {
      const heading = document.querySelector('#main-content h1');
      if (!heading || !heading.getClientRects().length || document.querySelector('dialog[open]')) return false;
      heading.tabIndex = -1;
      heading.setAttribute('data-route-focus-target', '');
      heading.focus({ preventScroll: true });
      return true;
    };
    if (focusPage()) return;
    const observer = new MutationObserver(() => { if (focusPage()) observer.disconnect(); });
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
};

export default ScrollToTop;
