import { useEffect, useRef, useState } from "react";

export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isInView) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || typeof window.IntersectionObserver !== "function") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsInView(true);
      observer.disconnect();
    }, { threshold });

    const showWithoutMotion = () => {
      if (!preference.matches) return;
      setIsInView(true);
      observer.disconnect();
    };
    preference.addEventListener("change", showWithoutMotion);
    setCanAnimate(true);
    observer.observe(element);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", showWithoutMotion);
    };
  }, [isInView, threshold]);

  return { ref, isInView, canAnimate };
}
