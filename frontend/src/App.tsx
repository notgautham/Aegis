import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScanProvider } from "@/contexts/ScanContext";
import { ScanQueueProvider } from "@/contexts/ScanQueueContext";
import { PinnedPagesProvider } from "@/contexts/PinnedPagesContext";
import { SelectedScanProvider } from "@/contexts/SelectedScanContext";
import Login from "./pages/Login.tsx";
import Index from "./pages/Index.tsx";
import DashboardLayout from "./pages/DashboardLayout.tsx";
import DashboardHome from "./pages/DashboardHome.tsx";
import Scanner from "./pages/Scanner.tsx";
import AssetDiscovery from "./pages/AssetDiscovery.tsx";
import AssetInventory from "./pages/AssetInventory.tsx";
import AssetDetail from "./pages/AssetDetail.tsx";
import CBOMOverview from "./pages/CBOMOverview.tsx";
import CBOMPerAsset from "./pages/CBOMPerAsset.tsx";
import CBOMExport from "./pages/CBOMExport.tsx";
import PQCCompliance from "./pages/PQCCompliance.tsx";
import PQCHndl from "./pages/PQCHndl.tsx";
import PQCQuantumDebt from "./pages/PQCQuantumDebt.tsx";
import CyberRatingEnterprise from "./pages/CyberRatingEnterprise.tsx";
import CyberRatingPerAsset from "./pages/CyberRatingPerAsset.tsx";
import CyberRatingTiers from "./pages/CyberRatingTiers.tsx";
import RemediationActionPlan from "./pages/RemediationActionPlan.tsx";
import RemediationAIPatch from "./pages/RemediationAIPatch.tsx";
import RemediationRoadmap from "./pages/RemediationRoadmap.tsx";
import ReportingExecutive from "./pages/ReportingExecutive.tsx";
import ReportingScheduled from "./pages/ReportingScheduled.tsx";
import ReportingOnDemand from "./pages/ReportingOnDemand.tsx";
import ScanHistory from "./pages/ScanHistory.tsx";
import SettingsLayout from "./pages/SettingsLayout.tsx";
import SettingsScanConfig from "./pages/SettingsScanConfig.tsx";
import SettingsNotifications from "./pages/SettingsNotifications.tsx";
import SettingsIntegrations from "./pages/SettingsIntegrations.tsx";
import ScanReport from "./pages/ScanReport.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = localStorage.getItem('aegis-auth') === 'true';
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScanProvider>
          <ScanQueueProvider>
          <SelectedScanProvider>
          <PinnedPagesProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/landing" element={<Index />} />
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<DashboardHome />} />
              <Route path="discovery" element={<AssetDiscovery />} />
              <Route path="inventory" element={<AssetInventory />} />
              <Route path="assets/:id" element={<AssetDetail />} />
              <Route path="cbom" element={<CBOMOverview />} />
              <Route path="cbom/per-asset" element={<CBOMPerAsset />} />
              <Route path="cbom/export" element={<CBOMExport />} />
              <Route path="pqc/compliance" element={<PQCCompliance />} />
              <Route path="pqc/hndl" element={<PQCHndl />} />
              <Route path="pqc/quantum-debt" element={<PQCQuantumDebt />} />
              <Route path="rating/enterprise" element={<CyberRatingEnterprise />} />
              <Route path="rating/per-asset" element={<CyberRatingPerAsset />} />
              <Route path="rating/tiers" element={<Navigate to="/dashboard/rating/enterprise" replace />} />
              <Route path="remediation/action-plan" element={<RemediationActionPlan />} />
              <Route path="remediation/ai-patch" element={<RemediationAIPatch />} />
              <Route path="remediation/roadmap" element={<RemediationRoadmap />} />
              <Route path="reporting/executive" element={<ReportingExecutive />} />
              <Route path="reporting/scheduled" element={<ReportingScheduled />} />
              <Route path="reporting/on-demand" element={<ReportingOnDemand />} />
              <Route path="history" element={<ScanHistory />} />
              <Route path="scans/:scanId" element={<ScanReport />} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<SettingsScanConfig />} />
                <Route path="scan-config" element={<SettingsScanConfig />} />
                <Route path="notifications" element={<SettingsNotifications />} />
                <Route path="integrations" element={<SettingsIntegrations />} />
              </Route>
            </Route>
            <Route path="/scanner" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Scanner />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PinnedPagesProvider>
          </SelectedScanProvider>
          </ScanQueueProvider>
        </ScanProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
