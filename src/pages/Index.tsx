import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { CTASection } from "@/components/home/CTASection";
import { BookingFlowSection } from "@/components/home/BookingFlowSection";
import { OpenPlayHighlight } from "@/components/home/OpenPlayHighlight";
import { PlayOptionsSection } from "@/components/home/PlayOptionsSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <PlayOptionsSection />
        <OpenPlayHighlight />
        <BookingFlowSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
