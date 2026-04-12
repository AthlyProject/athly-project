import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { ProblemSection } from "./components/ProblemSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
// import { FeaturesSection } from "./components/FeaturesSection";
import { TechSection } from "./components/TechSection";
import { WaitlistSection } from "./components/WaitlistSection";
import { FooterSection } from "./components/FooterSection";
import mascotSrc from "@/assets/icons/athly-shield.png";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background-dark)] text-[var(--color-text-primary)]">
      <Navbar />
      <main>
        <HeroSection mascotSrc={mascotSrc} />
        <ProblemSection />
        <HowItWorksSection />
        {/* <FeaturesSection /> */}
        <TechSection />
        <WaitlistSection />
      </main>
      <FooterSection />
    </div>
  );
}
