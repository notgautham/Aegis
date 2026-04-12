import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import TrustStrip from '@/components/landing/TrustStrip';
import ProblemSection from '@/components/landing/ProblemSection';
import MathematicalCoreSection from '@/components/landing/MathematicalCoreSection';
import PipelineSection from '@/components/landing/PipelineSection';
import CapabilitiesGrid from '@/components/landing/CapabilitiesGrid';
import DashboardPreview from '@/components/landing/DashboardPreview';
import NistStandards from '@/components/landing/NistStandards';
import FinalCTA from '@/components/landing/FinalCTA';
import Footer from '@/components/landing/Footer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <TrustStrip />
      <ProblemSection />
      <MathematicalCoreSection />
      <PipelineSection />
      <CapabilitiesGrid />
      <DashboardPreview />
      <NistStandards />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
