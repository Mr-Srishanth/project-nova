import React, { useState, useEffect } from 'react';
import { StudentProfile, ProjectIdea } from './types/domain';
import { StorageService } from './lib/storage/storageService';
import { NavigationHeader, NavTab } from './components/NavigationHeader';
import { StudentProfileModule } from './modules/student/StudentProfileModule';
import { ProjectGeneratorModule } from './modules/generator/ProjectGeneratorModule';
import { RecommendationEngineModule } from './modules/recommendations/RecommendationEngineModule';
import { SkillGapModule } from './modules/skillGap/SkillGapModule';
import { NoveltyRadarModule } from './modules/novelty/NoveltyRadarModule';
import { IdeaEvolutionModule } from './modules/evolution/IdeaEvolutionModule';
import { FeasibilityModule } from './modules/feasibility/FeasibilityModule';
import { BlueprintStudioModule } from './modules/blueprint/BlueprintStudioModule';
import { AdaptiveRoadmapModule } from './modules/roadmap/AdaptiveRoadmapModule';
import { ProjectWorkspaceModule } from './modules/workspace/ProjectWorkspaceModule';
import { AIGenerationService } from './lib/intelligence/aiGenerationService';
import { Bookmark, BookmarkCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('student');
  const [currentStudent, setCurrentStudent] = useState<StudentProfile>(StorageService.getCurrentStudent());
  const [candidateProjects, setCandidateProjects] = useState<ProjectIdea[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectIdea | undefined>();
  const [savedProjects, setSavedProjects] = useState<ProjectIdea[]>(StorageService.getSavedProjects());

  useEffect(() => {
    const defaultIdeas = AIGenerationService.synthesizeDomainIdeas(currentStudent);
    setCandidateProjects(defaultIdeas);
    setSelectedProject(defaultIdeas[0]);
  }, [currentStudent.id]);

  const handleUpdateStudent = (updated: StudentProfile) => {
    setCurrentStudent(updated);
    StorageService.saveStudent(updated);
  };

  const handleIdeasGenerated = (ideas: ProjectIdea[], _source: string) => {
    setCandidateProjects(ideas);
    if (ideas.length > 0) {
      setSelectedProject(ideas[0]);
      setActiveTab('recommendations');
    }
  };

  const handleSelectProject = (project: ProjectIdea) => {
    setSelectedProject(project);
  };

  const handleSaveProject = (project: ProjectIdea) => {
    StorageService.saveProject(project);
    setSavedProjects(StorageService.getSavedProjects());
  };

  const handleRemoveProject = (projectId: string) => {
    StorageService.removeSavedProject(projectId);
    setSavedProjects(StorageService.getSavedProjects());
  };

  const handleProjectEvolved = (evolved: ProjectIdea) => {
    setCandidateProjects(prev => [evolved, ...prev]);
    setSelectedProject(evolved);
  };

  const isCurrentProjectSaved = selectedProject ? savedProjects.some(p => p.id === selectedProject.id) : false;

  return (
    <div className="min-h-screen bg-[#101713] text-[#F5F7F5] flex flex-col font-sans selection:bg-[#10B981] selection:text-[#101713]">
      {/* Top Main Navigation */}
      <NavigationHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        studentName={currentStudent.name}
        savedCount={savedProjects.length}
      />

      {/* Quick Action Ribbon for Active Selected Project */}
      {selectedProject && (
        <section aria-label="Active Project Ribbon" className="bg-[#1C2420] border-b border-[#303A34] py-2.5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-[#A5B0A8] font-medium">Active Selected Project:</span>
              <strong className="text-[#F5F7F5] font-semibold truncate max-w-[280px] sm:max-w-md">
                {selectedProject.title}
              </strong>
              {selectedProject.isEvolved && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40">
                  EVOLVED
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleSaveProject(selectedProject)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                  isCurrentProjectSaved
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40'
                    : 'bg-[#101713] text-[#F5F7F5] border-[#303A34] hover:border-[#10B981]'
                }`}
              >
                {isCurrentProjectSaved ? (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Saved in Portfolio</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5 text-[#A5B0A8]" />
                    <span>Save to Portfolio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Module Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'student' && (
          <StudentProfileModule
            currentStudent={currentStudent}
            onUpdateStudent={handleUpdateStudent}
            onProceedToGenerate={() => setActiveTab('generator')}
          />
        )}

        {activeTab === 'generator' && (
          <ProjectGeneratorModule
            currentStudent={currentStudent}
            generatedIdeas={candidateProjects}
            onIdeasGenerated={handleIdeasGenerated}
            onSelectProject={handleSelectProject}
            selectedProjectId={selectedProject?.id}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationEngineModule
            currentStudent={currentStudent}
            candidateProjects={candidateProjects}
            selectedProjectId={selectedProject?.id}
            onSelectProject={handleSelectProject}
            onProceedToSkillGap={() => setActiveTab('skill-gap')}
          />
        )}

        {activeTab === 'skill-gap' && (
          <SkillGapModule
            currentStudent={currentStudent}
            selectedProject={selectedProject}
            onProceedToNovelty={() => setActiveTab('novelty')}
          />
        )}

        {activeTab === 'novelty' && (
          <NoveltyRadarModule
            selectedProject={selectedProject}
            onProceedToEvolution={() => setActiveTab('evolution')}
          />
        )}

        {activeTab === 'evolution' && (
          <IdeaEvolutionModule
            currentStudent={currentStudent}
            selectedProject={selectedProject}
            onProjectEvolved={handleProjectEvolved}
            onProceedToFeasibility={() => setActiveTab('feasibility')}
          />
        )}

        {activeTab === 'feasibility' && (
          <FeasibilityModule
            currentStudent={currentStudent}
            selectedProject={selectedProject}
            onProceedToBlueprint={() => setActiveTab('blueprint')}
          />
        )}

        {activeTab === 'blueprint' && (
          <BlueprintStudioModule
            selectedProject={selectedProject}
            onProceedToRoadmap={() => setActiveTab('roadmap')}
          />
        )}

        {activeTab === 'roadmap' && (
          <AdaptiveRoadmapModule
            currentStudent={currentStudent}
            selectedProject={selectedProject}
            onProceedToWorkspace={() => setActiveTab('workspace')}
          />
        )}

        {activeTab === 'workspace' && (
          <ProjectWorkspaceModule
            currentStudent={currentStudent}
            savedProjects={savedProjects}
            onSelectProject={(p) => {
              setSelectedProject(p);
              setActiveTab('blueprint');
            }}
            onRemoveProject={handleRemoveProject}
          />
        )}
      </main>

      {/* Application Footer */}
      <footer className="border-t border-[#303A34] py-6 bg-[#101713] text-xs text-[#A5B0A8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-[#F5F7F5]">ProjectNova AI</span> — An AI-Based Personalized Project Idea Generation and Recommendation System.
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px] text-[#A5B0A8]">
            <span>10 Connected Modules</span>
            <span>•</span>
            <span>Constraint-Aware Scoring</span>
            <span>•</span>
            <span>Reproducible Baselines</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
