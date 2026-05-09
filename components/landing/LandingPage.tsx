import { LandingNav } from "./LandingNav";
import { LandingHero } from "./LandingHero";
import { LandingShowcase } from "./LandingShowcase";
import { LandingHowItWorks } from "./LandingHowItWorks";
import { LandingRitual } from "./LandingRitual";
import { LandingPrivacy } from "./LandingPrivacy";
import { LandingPricing } from "./LandingPricing";
import { LandingTestimonials } from "./LandingTestimonials";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  return (
    <>
      <LandingNav />
      <main className="min-h-screen bg-black text-white">
        <LandingHero />
        <LandingShowcase />
        <LandingHowItWorks />
        <LandingRitual />
        <LandingPrivacy />
        <LandingPricing />
        <LandingTestimonials />
        <LandingFooter />
      </main>
    </>
  );
}
