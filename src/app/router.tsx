import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ActiveProjectProvider } from "@/lib/context/ActiveProjectContext";
import { AppShell } from "@/components/layout/AppShell";
import { OverviewPage } from "@/modules/overview/OverviewPage";
import { DiscoveryPage } from "@/modules/discovery/DiscoveryPage";
import { ProjectsListPage } from "@/modules/projects/ProjectsListPage";
import { ProjectWorkspacePage } from "@/modules/projects/ProjectWorkspacePage";
import { BlueprintStudioPage } from "@/modules/blueprint/BlueprintStudioPage";
import { VisualFlowPage } from "@/modules/flow/VisualFlowPage";
import { BuildStudioPage } from "@/modules/build/BuildStudioPage";
import { UIStudioPage } from "@/modules/uiStudio/UIStudioPage";
import { QualityEnginePage } from "@/modules/quality/QualityEnginePage";
import { ReleaseCenterPage } from "@/modules/release/ReleaseCenterPage";
import { DocsStudioPage } from "@/modules/docs/DocsStudioPage";
import { OrchestratorDashboardPage } from "@/modules/orchestrator/OrchestratorDashboardPage";
import { ExecutionCenterPage } from "@/modules/execution/ExecutionCenterPage";
import { SystemHealthPage } from "@/modules/health/SystemHealthPage";
import { ProjectMemoryPage } from "@/modules/memory/ProjectMemoryPage";
import { RepositoryPage } from "@/modules/repository/RepositoryPage";
import { CodeReviewPage } from "@/modules/review/CodeReviewPage";
import { TestAutomationPage } from "@/modules/testing/TestAutomationPage";
import { DeploymentCenterPage } from "@/modules/deployment/DeploymentCenterPage";
import { MonitoringCenterPage } from "@/modules/monitoring/MonitoringCenterPage";
import { VisualWorkflowBuilderPage } from "@/modules/workflow/VisualWorkflowBuilderPage";
import { TeamWorkspacePage } from "@/modules/team/TeamWorkspacePage";
import { SettingsPage } from "@/modules/settings/SettingsPage";

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <ActiveProjectProvider>
        <AppShell>
          <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
          <Route path="/blueprint" element={<BlueprintStudioPage />} />
          <Route path="/flow" element={<VisualFlowPage />} />
          <Route path="/build" element={<BuildStudioPage />} />
          <Route path="/ui-studio" element={<UIStudioPage />} />
          <Route path="/quality" element={<QualityEnginePage />} />
          <Route path="/release" element={<ReleaseCenterPage />} />
          <Route path="/docs" element={<DocsStudioPage />} />
          <Route path="/orchestrator" element={<OrchestratorDashboardPage />} />
          <Route path="/execution" element={<ExecutionCenterPage />} />
          <Route path="/health" element={<SystemHealthPage />} />
          <Route path="/memory" element={<ProjectMemoryPage />} />
          <Route path="/repository" element={<RepositoryPage />} />
          <Route path="/code-review" element={<CodeReviewPage />} />
          <Route path="/testing" element={<TestAutomationPage />} />
          <Route path="/deployments" element={<DeploymentCenterPage />} />
          <Route path="/monitoring" element={<MonitoringCenterPage />} />
          <Route path="/workflows" element={<VisualWorkflowBuilderPage />} />
          <Route path="/team" element={<TeamWorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="/deploy" element={<Navigate to="/deployments" replace />} />
          <Route path="/test" element={<Navigate to="/testing" replace />} />
          <Route path="/test-and-fix" element={<Navigate to="/testing" replace />} />
          <Route path="/deploy-and-monitor" element={<Navigate to="/deployments" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </ActiveProjectProvider>
  </BrowserRouter>
  );
};
