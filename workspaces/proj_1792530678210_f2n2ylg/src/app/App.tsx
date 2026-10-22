import React, { useState, useEffect, useRef } from 'react';

interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  liveUrl?: string;
  githubUrl?: string;
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'PortfolioHub',
    description: 'A delightful, tactile portfolio showcase application featuring gorgeous claymorphism UI design with soft rounded corners, smooth inset shadows, and floating 3D depth.',
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Claymorphism'],
    githubUrl: 'https://github.com',
    liveUrl: 'https://example.com'
  },
  {
    id: '2',
    title: 'CloudSync CLI',
    description: 'Command-line interface tool for seamless cloud asset synchronization and automated backup workflows with advanced telemetry.',
    techStack: ['Node.js', 'TypeScript', 'AWS SDK'],
    liveUrl: 'https://npmjs.com',
    githubUrl: 'https://github.com'
  },
  {
    id: '3',
    title: 'ClayPulse Dashboard',
    description: 'Real-time analytics dashboard with dynamic soft UI cards, organic pastel color palettes, and satisfying tactile feedback.',
    techStack: ['React', 'Chart.js', 'Tailwind CSS', 'Vite'],
    githubUrl: 'https://github.com'
  }
];

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', techStack: '' });
  const [showModal, setShowModal] = useState<boolean>(false);

  // Interactive Red Liquid simulation canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viscosity, setViscosity] = useState<number>(1.5);
  const [liquidColor, setLiquidColor] = useState<string>('#ef4444');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Red liquid interactive wave / fluid simulation effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = 220;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      time += 0.03 * viscosity;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw glowing red liquid wave layers
      const drawWave = (amplitude: number, frequency: number, speedOffset: number, alpha: number, color: string) => {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let x = 0; x <= canvas.width; x += 5) {
          const y = Math.sin(x * frequency + time * speedOffset) * amplitude + canvas.height * 0.5;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      };

      // Background liquid gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, liquidColor);
      gradient.addColorStop(1, '#7f1d1d');

      drawWave(25, 0.008, 1.2, 0.4, gradient);
      drawWave(18, 0.015, -1.0, 0.6, '#dc2626');
      drawWave(30, 0.005, 0.8, 0.8, '#b91c1c');

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [viscosity, liquidColor]);

  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.techStack.some((tech) => tech.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title.trim() || !newProject.description.trim()) return;

    const project: Project = {
      id: Date.now().toString(),
      title: newProject.title,
      description: newProject.description,
      techStack: newProject.techStack.split(',').map((t) => t.trim()).filter(Boolean),
      githubUrl: 'https://github.com',
      liveUrl: 'https://example.com'
    };

    setProjects([project, ...projects]);
    setNewProject({ title: '', description: '', techStack: '' });
    setShowModal(false);
  };

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 font-sans ${
      isDarkMode 
        ? 'bg-[#1e2230] text-slate-100' 
        : 'bg-[#e4ebf5] text-slate-700'
    }`}>
      {/* Ambient Header */}
      <header className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center text-white font-bold text-xl shadow-[6px_6px_12px_#be123c,-6px_-6px_12px_#f87171]">
            💧
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">
              PortfolioHub <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">Red Liquid Edition</span>
            </h1>
            <p className="text-xs opacity-75">Interactive portfolio featuring dynamic fluid dynamics</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-red-500 text-white shadow-[4px_4px_10px_#991b1b,-4px_-4px_10px_#ef4444] hover:shadow-[inset_2px_2px_5px_#991b1b,inset_-2px_-2px_5px_#ef4444] transition-all duration-200"
          >
            + Add Project
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 rounded-xl bg-inherit shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.7)] dark:shadow-[4px_4px_10px_#151824,-4px_-4px_10px_#272c3c] hover:opacity-80 transition-all"
            aria-label="Toggle theme"
          >
            {isDarkMode ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Interactive Red Liquid Simulation Widget */}
      <section className="max-w-6xl mx-auto px-6 mb-10">
        <div className="p-6 rounded-3xl shadow-[8px_8px_20px_rgba(0,0,0,0.08),-8px_-8px_20px_rgba(255,255,255,0.8)] dark:shadow-[8px_8px_20px_#151824,-8px_-8px_20px_#272c3c] bg-inherit relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>🔴</span> Red Liquid Viscosity & Simulation Control
              </h2>
              <p className="text-xs opacity-70">Interact with real-time canvas fluid dynamics reacting to your preferences.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <label className="flex items-center gap-2">
                Viscosity:
                <input 
                  type="range" 
                  min="0.2" 
                  max="3.0" 
                  step="0.1"
                  value={viscosity} 
                  onChange={(e) => setViscosity(parseFloat(e.target.value))}
                  className="accent-red-500 cursor-pointer"
                />
                {viscosity}x
              </label>
              <select 
                value={liquidColor}
                onChange={(e) => setLiquidColor(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-inherit border border-red-500/30 text-xs font-semibold cursor-pointer"
              >
                <option value="#ef4444">Crimson Red</option>
                <option value="#dc2626">Ruby Red</option>
                <option value="#991b1b">Deep Blood</option>
                <option value="#f43f5e">Rose Neon</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-[inset_4px_4px_10px_rgba(0,0,0,0.1),inset_-4px_-4px_10px_rgba(255,255,255,0.7)] dark:shadow-[inset_4px_4px_10px_#151824,inset_-4px_-4px_10px_#272c3c]">
            <canvas ref={canvasRef} className="w-full block" />
          </div>
        </div>
      </section>

      {/* Search & Project Showcase */}
      <main className="max-w-6xl mx-auto px-6 pb-20">
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search projects by title, description, or tech stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-6 py-4 rounded-2xl bg-inherit shadow-[inset_4px_4px_10px_rgba(0,0,0,0.06),inset_-4px_-4px_10px_rgba(255,255,255,0.8)] dark:shadow-[inset_4px_4px_10px_#151824,inset_-4px_-4px_10px_#272c3c] focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <div 
              key={project.id}
              className="p-6 rounded-3xl shadow-[8px_8px_20px_rgba(0,0,0,0.08),-8px_-8px_20px_rgba(255,255,255,0.8)] dark:shadow-[8px_8px_20px_#151824,-8px_-8px_20px_#272c3c] bg-inherit flex flex-col justify-between hover:-translate-y-1 transition-all duration-300"
            >
              <div>
                <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
                  {project.title}
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                </h3>
                <p className="text-sm opacity-80 mb-6 leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {project.techStack.map((tech) => (
                    <span 
                      key={tech}
                      className="px-3 py-1 rounded-xl text-xs font-medium bg-inherit shadow-[3px_3px_6px_rgba(0,0,0,0.05),-3px_-3px_6px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_6px_#151824,-3px_-3px_6px_#272c3c] text-red-600 dark:text-red-400"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-red-500/10">
                  {project.liveUrl && (
                    <a 
                      href={project.liveUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex-1 py-2 text-center rounded-xl text-xs font-bold bg-red-500 text-white shadow-[3px_3px_6px_#991b1b,-3px_-3px_6px_#ef4444] hover:shadow-[inset_2px_2px_4px_#991b1b] transition-all"
                    >
                      Live Demo
                    </a>
                  )}
                  {project.githubUrl && (
                    <a 
                      href={project.githubUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex-1 py-2 text-center rounded-xl text-xs font-bold shadow-[3px_3px_6px_rgba(0,0,0,0.05),-3px_-3px_6px_rgba(255,255,255,0.8)] dark:shadow-[3px_3px_6px_#151824,-3px_-3px_6px_#272c3c] hover:opacity-80 transition-all"
                    >
                      GitHub
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md p-8 rounded-3xl shadow-2xl bg-[#e4ebf5] dark:bg-[#1e2230] border border-red-500/20">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>💧</span> Add New Project
            </h3>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-75">Project Title</label>
                <input
                  type="text"
                  required
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-inherit shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] dark:shadow-[inset_3px_3px_6px_#151824,inset_-3px_-3px_6px_#272c3c] focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. RedFlow Engine"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-75">Description</label>
                <textarea
                  required
                  rows={3}
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-inherit shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] dark:shadow-[inset_3px_3px_6px_#151824,inset_-3px_-3px_6px_#272c3c] focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Describe project mechanics..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-75">Tech Stack (comma separated)</label>
                <input
                  type="text"
                  value={newProject.techStack}
                  onChange={(e) => setNewProject({ ...newProject, techStack: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-inherit shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] dark:shadow-[inset_3px_3px_6px_#151824,inset_-3px_-3px_6px_#272c3c] focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="React, Canvas, TypeScript"
                />
              </div>
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_10px_#151824,-4px_-4px_10px_#272c3c]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-red-500 text-white shadow-[4px_4px_10px_#991b1b,-4px_-4px_10px_#ef4444]"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

/* [INSPECTOR UPDATE]: fontSize: 25px */

/* [INSPECTOR UPDATE]: fontSize: 25px */
