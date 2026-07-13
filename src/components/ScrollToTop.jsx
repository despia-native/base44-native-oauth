import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        // scrollIntoView scrolls the page's own .scroll-container (body scroll
        // is disabled app-wide — see index.css), so no window.scrollTo here.
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }
    // No hash: nothing to do — pages remount at the top on forward navigation,
    // and ScrollMemory handles position restoration on back/swipe.
  }, [pathname, hash, navigationType]);

  return null;
}