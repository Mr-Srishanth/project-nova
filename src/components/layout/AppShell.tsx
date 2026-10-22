import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useActiveProject } from "@/lib/context/ActiveProjectContext";
import {
  LayoutDashboard,
  FolderKanban,
  Hammer,
  ShieldCheck,
  Rocket,
  Settings,
  Menu,
  X,
  Sparkles,
  MonitorPlay,
  FileCode2,
  GitFork,
  Cpu,
  Activity,
  Brain,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: string;
  description: string;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { activeProject } = useActiveProject();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // The 6 Primary Navigation Destinations
  const primaryNavItems: NavItem[] = [
    {
      name: "Home",
      href: "/",
      icon: <LayoutDashboard className="w-4 h-4" />,
      active: location.pathname === "/",
      description: "Project dashboard & AI next steps",
    },
    {
      name: "Projects",
      href: "/projects",
      icon: <FolderKanban className="w-4 h-4" />,
      active:
        location.pathname.startsWith("/projects") ||
        location.pathname.startsWith("/discover") ||
        location.pathname.startsWith("/blueprint") ||
        location.pathname.startsWith("/flow"),
      description: "Ideas, specs, blueprints & roadmap",
    },
    {
      name: "Build Studio",
      href: "/build",
      icon: <Hammer className="w-4 h-4" />,
      active:
        location.pathname.startsWith("/build") ||
        location.pathname.startsWith("/repository") ||
        location.pathname.startsWith("/code-review"),
      description: "Source code, IDE workspace & tests",
    },
    {
      name: "UI Studio",
      href: "/ui-studio",
      icon: <MonitorPlay className="w-4 h-4 text-amber-500" />,
      active: location.pathname.startsWith("/ui-studio"),
      description: "Visual design, inspector & live preview",
    },
    {
      name: "Test & Fix",
      href: "/testing",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
      active:
        location.pathname.startsWith("/testing") ||
        location.pathname.startsWith("/quality"),
      description: "Automated tests & AI repairs",
    },
    {
      name: "Deploy & Monitor",
      href: "/deployments",
      icon: <Rocket className="w-4 h-4 text-[#70C84B]" />,
      active:
        location.pathname.startsWith("/deployments") ||
        location.pathname.startsWith("/release") ||
        location.pathname.startsWith("/monitoring"),
      description: "Hosting, preflight & runtime health",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: <Settings className="w-4 h-4 text-[#70C84B]" />,
      active: location.pathname.startsWith("/settings"),
      description: "Credentials, Gemini, Supabase & OS",
    },
  ];

  // Secondary / Advanced Engineering Tools (Accessible without cluttering primary flow)
  const advancedNavItems = [
    { name: "Blueprint Studio", href: "/blueprint", icon: <FileCode2 className="w-3.5 h-3.5" /> },
    { name: "Project Flow", href: "/flow", icon: <GitFork className="w-3.5 h-3.5" /> },
    { name: "Orchestrator", href: "/orchestrator", icon: <Sparkles className="w-3.5 h-3.5 text-primary" /> },
    { name: "Execution Center", href: "/execution", icon: <Cpu className="w-3.5 h-3.5" /> },
    { name: "System Health", href: "/health", icon: <Activity className="w-3.5 h-3.5 text-emerald-600" /> },
    { name: "Project Brain", href: "/memory", icon: <Brain className="w-3.5 h-3.5 text-purple-600" /> },
    { name: "Visual Workflows", href: "/workflows", icon: <GitFork className="w-3.5 h-3.5 text-[#70C84B]" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b-2 border-border sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-tactile-sm bg-primary border-2 border-border flex items-center justify-center font-display font-bold text-foreground shadow-hard-sm">
            N
          </div>
          <span className="font-display font-bold text-lg text-foreground tracking-tight">ProjectNova AI</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 border-2 border-border rounded-tactile-sm bg-surface text-foreground shadow-hard-sm"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar for Desktop */}
      <aside
        className={cn(
          "w-64 bg-surface border-r-2 border-border flex flex-col shrink-0 md:sticky md:top-0 md:h-screen z-40",
          mobileMenuOpen ? "block fixed inset-0 top-14 bg-surface" : "hidden md:flex"
        )}
      >
        {/* Logo and Brand */}
        <div className="p-5 border-b-2 border-border hidden md:flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-tactile bg-primary border-2 border-border flex items-center justify-center font-display font-bold text-lg text-foreground shadow-hard-sm">
              N
            </div>
            <div>
              <span className="font-display font-bold text-lg text-foreground block leading-tight">
                ProjectNova
              </span>
              <span className="text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-wider block">
                Autonomous Project OS
              </span>
            </div>
          </Link>
        </div>

        {/* 6 Primary Navigation Links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] font-mono font-semibold text-foreground-muted uppercase tracking-wider">
            Primary Navigation
          </div>
          {primaryNavItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "group flex items-center justify-between px-3 py-2.5 rounded-tactile text-xs font-display font-semibold transition-all border-2",
                item.active
                  ? "bg-primary text-foreground border-border shadow-hard-sm"
                  : "text-foreground-muted border-transparent hover:text-foreground hover:bg-[#FAF7ED] hover:border-border/30"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className={item.active ? "text-foreground" : "text-foreground-muted group-hover:text-foreground"}>
                  {item.icon}
                </span>
                <div className="text-left">
                  <div className="leading-tight">{item.name}</div>
                  <div className="text-[10px] font-sans font-normal text-foreground-muted leading-tight mt-0.5">
                    {item.description}
                  </div>
                </div>
              </div>
              {item.badge && (
                <span className="text-[9px] font-mono uppercase bg-surface border border-border px-1.5 py-0.5 rounded text-foreground font-semibold">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}

          {/* Contextual / Advanced Engineering Panel */}
          <div className="pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-foreground-muted hover:text-foreground rounded transition-colors"
            >
              <span className="uppercase tracking-wider font-semibold">Advanced Modules</span>
              {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="mt-1 space-y-0.5 pl-1">
                {advancedNavItems.map((adv) => (
                  <Link
                    key={adv.name}
                    to={adv.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px] font-sans transition-colors",
                      location.pathname.startsWith(adv.href)
                        ? "bg-muted font-semibold text-foreground"
                        : "text-foreground-muted hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {adv.icon}
                    <span>{adv.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* System Info Footnote */}
        <div className="p-3.5 m-3 bg-[#FAF7ED] border-2 border-border rounded-tactile shadow-hard-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-foreground" />
              <span className="text-[11px] font-mono font-bold text-foreground uppercase">AI Project OS</span>
            </div>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[11px] font-sans text-foreground-muted leading-tight">
            Unified workspace. Session & artifacts synchronized.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-surface border-b-2 border-border">
          <div className="flex items-center gap-3 text-xs font-mono text-foreground-muted">
            <div className="flex items-center gap-2">
              <Link to="/" className="hover:text-foreground transition-colors">OS</Link>
              <span>/</span>
              <span className="text-foreground font-semibold">
                {location.pathname === "/"
                  ? "Home"
                  : location.pathname.startsWith("/projects")
                  ? "Projects"
                  : location.pathname.startsWith("/build") || location.pathname.startsWith("/ui-studio")
                  ? "Build Studio"
                  : location.pathname.startsWith("/testing") || location.pathname.startsWith("/quality")
                  ? "Test & Fix"
                  : location.pathname.startsWith("/deployments") || location.pathname.startsWith("/release")
                  ? "Deploy & Monitor"
                  : location.pathname.startsWith("/settings")
                  ? "Settings"
                  : location.pathname.substring(1)}
              </span>
            </div>

            {/* Global Compact Active Project Pill */}
            {activeProject ? (
              <div className="flex items-center gap-2 pl-3 border-l-2 border-border/60">
                <span className="text-[10px] uppercase font-bold text-foreground-muted/80">Active:</span>
                <Link
                  to={`/?project=${activeProject.id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-tactile hover:bg-muted text-foreground transition-colors shadow-hard-xs max-w-[200px]"
                  title={`Active Project: ${activeProject.name} (Click to manage on Home)`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-display font-bold text-[11px] truncate">{activeProject.name}</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-3 border-l-2 border-border/60">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-tactile text-amber-700 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                >
                  <span>No Active Project</span>
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary border border-border" />
            <span className="text-xs font-mono font-medium text-foreground">Local Session Active</span>
          </div>
        </header>

        <div
          className={cn(
            "flex-1 w-full",
            location.pathname.startsWith("/ui-studio")
              ? "p-0 max-w-none h-[calc(100vh-49px)] overflow-hidden flex flex-col"
              : "p-4 md:p-8 max-w-7xl mx-auto"
          )}
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
