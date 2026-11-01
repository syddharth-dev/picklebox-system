import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export function RouteScrollReset() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== "POP" && !hash && !pathname.startsWith("/admin")) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, hash, navigationType]);
  return null;
}
