import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import TenderUploadPage from './pages/TenderUploadPage';
import BidderUploadPage from './pages/BidderUploadPage';
import EvaluationPage from './pages/EvaluationPage';
import DecisionSummaryPage from './pages/DecisionSummaryPage';
import ReportPage from './pages/ReportPage';
import ReviewPage from './pages/ReviewPage';
import SmartEligibilityRadarPage from './pages/SmartEligibilityRadarPage';
import RiskHeatmapPage from './pages/RiskHeatmapPage';
import WorkflowPreviewPage from './pages/WorkflowPreviewPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tender-upload" element={<TenderUploadPage />} />
          <Route path="/bidder-upload" element={<BidderUploadPage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/decision-summary" element={<DecisionSummaryPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/smart-eligibility-radar" element={<SmartEligibilityRadarPage />} />
          <Route path="/risk-heatmap" element={<RiskHeatmapPage />} />
          <Route path="/workflow-preview" element={<WorkflowPreviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
