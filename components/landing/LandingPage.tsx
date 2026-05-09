import dynamic from "next/dynamic";
import { LandingNav } from "./LandingNav";
import { LandingHero } from "./LandingHero";

const LandingShowcase = dynamic(() =>
  import("./LandingShowcase").then((m) => ({ default: m.LandingShowcase }))
);

const LandingHowItWorks = dynamic(() =>
  import("./LandingHowItWorks").then((m) => ({ default: m.LandingHowItWorks }))
);

const LandingRitual = dynamic(() =>
  import("./LandingRitual").then((m) => ({ default: m.LandingRitual }))
);

const LandingPrivacy = dynamic(() =>
  import("./LandingPrivacy").then((m) => ({ default: m.LandingPrivacy }))
);

const LandingPricing = dynamic(() =>
  import("./LandingPricing").then((m) => ({ default: m.LandingPricing }))
);

const LandingTestimonials = dynamic(() =>
  import("./LandingTestimonials").then((m) => ({ default: m.LandingTestimonials }))
);

const LandingFooter = dynamic(() =>
  import("./LandingFooter").then((m) => ({ default: m.LandingFooter }))
);

export function LandingPage() {
  return (
    <>
      <LandingNav />
      <main className="landing-marketing min-h-screen scroll-smooth bg-black text-white">
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
