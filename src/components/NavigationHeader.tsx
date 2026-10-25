import React from 'react';
import { 
  GraduationCap, 
  Sparkles, 
  Layers, 
  BarChart3, 
  Search, 
  Zap, 
  ShieldCheck, 
  FileCode2, 
  Milestone, 
  FolderGit2,
  Cpu,
  User
} from 'lucide-react';

export type NavTab = 
  | 'student'
  | 'generator'
  | 'recommendations'
  | 'skill-gap'
  | 'novelty'
  | 'evolution'
  | 'feasibility'
  | 'blueprint'
  | 'roadmap'
  | 'workspace';

interface NavigationHeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  studentName: string;
  savedCount: number;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  activeTab,
  onSelectTab,
  studentName,
  savedCount,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'student', label: '1. Student Profile', icon: GraduationCap },
    { id: 'generator', label: '2. AI Generator', icon: Sparkles },
    { id: 'recommendations', label: '3. Ranking Engine', icon: BarChart3 },
    { id: 'skill-gap', label: '4. Skill Gap', icon: Layers },
    { id: 'novelty', label: '5. Novelty Radar', icon: Search },
    { id: 'evolution', label: '6. Idea Evolution', icon: Zap },
    { id: 'feasibility', label: '7. Feasibility', icon: ShieldCheck },
    { id: 'blueprint', label: '8. Blueprint Studio', icon: FileCode2 },
    { id: 'roadmap', label: '9. Adaptive Roadmap', icon: Milestone },
    { id: 'workspace', label: '10. Saved & Evaluation', icon: FolderGit2, badge: savedCount },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#101713]/95 backdrop-blur-md border-b border-[#303A34]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#10B981] flex items-center justify-center text-[#101713] font-bold shadow-sm">
              <Cpu className="w-5 h-5 text-[#101713]" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-[#F5F7F5]">
                ProjectNova AI
              </span>
              <span className="hidden sm:inline-block ml-2.5 text-[11px] font-medium text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-0.5 rounded">
                Personalized Project Recommendation OS
              </span>
            </div>
          </div>

          {/* Active Student Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs text-[#A5B0A8] bg-[#1C2420] border border-[#303A34] px-3 py-1.5 rounded-lg">
              <User className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[#A5B0A8]">Student:</span>
              <strong className="text-[#F5F7F5] font-medium">{studentName}</strong>
            </div>
          </div>
        </div>

        {/* 10 Module Tab Bar */}
        <nav className="flex space-x-1.5 overflow-x-auto py-2 scrollbar-none border-t border-[#1C2420]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#10B981] text-[#101713] font-semibold'
                    : 'text-[#A5B0A8] hover:text-[#F5F7F5] hover:bg-[#1C2420]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#101713]' : 'text-[#A5B0A8]'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-[#101713] text-[#10B981]' : 'bg-[#10B981] text-[#101713]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
