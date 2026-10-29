import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { CourtsPreview } from "@/components/home/CourtsPreview";
import { CTASection } from "@/components/home/CTASection";
import { BookingFlowSection } from "@/components/home/BookingFlowSection";
import { OpenPlayHighlight } from "@/components/home/OpenPlayHighlight";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <CourtsPreview />
        <BookingFlowSection />
        <OpenPlayHighlight />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
