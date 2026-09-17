import { HeroSection }     from './sections/HeroSection'
import { FeaturesSection } from './sections/FeaturesSection'
import { HowItWorksSection } from './sections/HowItWorksSection'
import { PricingSection }  from './sections/PricingSection'
import { FAQSection }      from './sections/FAQSection'
import { CTASection }      from './sections/CTASection'

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  )
}
