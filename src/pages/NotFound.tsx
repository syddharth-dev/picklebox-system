import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="main-content" className="site-container min-h-[70dvh] pb-20 pt-40">
        <p className="font-display text-8xl leading-none text-muted-foreground/50 sm:text-[10rem]">404</p>
        <h1 className="page-title mt-6">That page is out of play.</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">We couldn't find the page you requested. Head back to the club, or choose a court for your next game.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link to="/">Back to home</Link></Button>
          <Button asChild variant="outline"><Link to="/courts">Book a court</Link></Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
