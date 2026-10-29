import { useEffect, useRef, useState } from "react";

export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isInView) return;

    if (!("IntersectionObserver" in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsInView(true);
      observer.disconnect();
    }, { threshold });

    observer.observe(element);
    return () => observer.disconnect();
  }, [isInView, threshold]);

  return { ref, isInView };
}
