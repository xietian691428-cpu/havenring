import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { LandingStorySection } from "./LandingStorySection";
import { LandingPromisesPoster } from "./LandingPromisesPoster";
import { LandingHowItWorksLux } from "./LandingHowItWorksLux";
import { LandingRealMoments } from "./LandingRealMoments";
import { LandingTheRing } from "./LandingTheRing";
import { LandingTrustPrivacy } from "./LandingTrustPrivacy";
import { LandingFinalCtaFooter } from "./LandingFinalCtaFooter";

export function LandingPage() {
  return (
    <>
      <LandingNav />
      <main className="landing-marketing min-h-screen scroll-smooth bg-[#0A0A0A] text-[#F5F5F5]">
        <HeroSection />
        <LandingStorySection />
        <LandingPromisesPoster />
        <LandingHowItWorksLux />
        <LandingRealMoments />
        <LandingTheRing />
        <LandingTrustPrivacy />
        <LandingFinalCtaFooter />
      </main>
    </>
  );
}
