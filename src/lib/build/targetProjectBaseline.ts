import type { Project } from "@/types/project";
import type { Blueprint } from "@/types/blueprint";
import { deriveProjectEnvironmentReport } from "./envConfigService";

/**
 * Detects domain and archetype of a project based on its name, description, objective, and category.
 */
export function detectProjectArchetype(project: {
  name: string;
  category?: string;
  objective?: string;
  description?: string;
  technologies?: string[];
}): "car_game" | "game" | "dashboard" | "website" | "data_pipeline" | "web_app" {
  const combined = `${project.name} ${project.category || ""} ${project.objective || ""} ${project.description || ""} ${(project.technologies || []).join(" ")}`.toLowerCase();

  if (
    (combined.includes("car") || combined.includes("racing") || combined.includes("drive") || combined.includes("vehicle") || combined.includes("speed")) &&
    (combined.includes("game") || combined.includes("arcade") || combined.includes("racer") || combined.includes("play"))
  ) {
    return "car_game";
  }

  if (combined.includes("game") || combined.includes("arcade") || combined.includes("canvas") || combined.includes("play")) {
    return "game";
  }

  if (
    combined.includes("dashboard") ||
    combined.includes("metric") ||
    combined.includes("analytics") ||
    combined.includes("telemetry") ||
    combined.includes("chart") ||
    combined.includes("kpi")
  ) {
    return "dashboard";
  }

  if (
    combined.includes("portfolio") ||
    combined.includes("landing") ||
    combined.includes("website") ||
    combined.includes("personal site") ||
    combined.includes("agency")
  ) {
    return "website";
  }

  if (
    project.category === "Data Engineering" ||
    combined.includes("pipeline") ||
    (project.technologies || []).some((t) => ["python", "duckdb", "parquet", "fastapi"].includes(t.toLowerCase()))
  ) {
    return "data_pipeline";
  }

  return "web_app";
}

/**
 * Generates tailored baseline files for target projects.
 * Guarantees that:
 * 1. index.html always contains a valid <div id="root"> and <script type="module" src="/src/main.tsx"></script>
 * 2. src/main.tsx mounts App into #root
 * 3. App.tsx provides a complete, playable or operational experience matching user intent (e.g. playable car game for car games)
 * 4. package.json has working dev/build/preview scripts matching Vite and React
 * 5. vite.config.ts and tsconfig.json are completely aligned
 */
export function generateTargetProjectBaseline(project: Project, _blueprint?: Blueprint): Record<string, string> {
  const archetype = detectProjectArchetype({
    name: project.name,
    category: project.category,
    objective: project.objective,
    description: project.description,
    technologies: project.technologies,
  });

  const safeName = project.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "project";

  const packageJson = JSON.stringify(
    {
      name: safeName,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc -b && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "lucide-react": "^0.344.0",
      },
      devDependencies: {
        "@types/react": "^18.3.5",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        typescript: "^5.5.3",
        vite: "^5.4.2",
      },
    },
    null,
    2
  );

  const tsconfigJson = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: false,
        resolveJsonModule: true,
        isolatedModules: true,
        moduleDetection: "force",
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
      },
      include: ["src"],
    },
    null,
    2
  );

  const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    </style>
  </head>
  <body class="bg-slate-950 text-slate-100 min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  const mainTsx = `import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./index.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
`;

  // The car game is a static single-screen experience: its shell locks the
  // document to the viewport height and disables scrolling entirely. Other
  // archetypes keep the original free-scrolling shell, byte-identical.
  const indexCss =
    archetype === "car_game"
      ? `@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  user-select: none;
  overflow: hidden;
  overscroll-behavior: none;
}
`
      : `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  user-select: none;
}
`;

  let appTsx = "";

  if (archetype === "car_game") {
    // Playable 2D Canvas Highway Car Racing Game with steering, traffic, obstacles, scoring, speed, collisions, sound/effects, and game-over restart
    appTsx = `import React, { useState, useEffect, useRef } from "react";
import { Play, RotateCcw, Trophy, Gauge, ShieldAlert, Zap, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  type: "car" | "truck" | "barrier";
}

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameover">("menu");
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem("car_game_highscore") || "0", 10);
    } catch {
      return 0;
    }
  });
  const [speed, setSpeed] = useState<number>(80);
  const [distance, setDistance] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Player position
  const playerRef = useRef({
    x: 180,
    y: 460,
    width: 44,
    height: 76,
    speed: 5,
  });

  const keysRef = useRef<{ [key: string]: boolean }>({});
  const obstaclesRef = useRef<Obstacle[]>([]);
  const roadOffsetRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const speedRef = useRef<number>(80);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const startGame = () => {
    playerRef.current.x = 180;
    playerRef.current.y = 460;
    obstaclesRef.current = [];
    roadOffsetRef.current = 0;
    scoreRef.current = 0;
    speedRef.current = 80;
    setScore(0);
    setDistance(0);
    setSpeed(80);
    setGameState("playing");
  };

  // Main Game Loop
  useEffect(() => {
    if (gameState !== "playing") return;

    let isRunning = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastSpawn = Date.now();

    const loop = () => {
      if (!isRunning) return;

      const keys = keysRef.current;
      const player = playerRef.current;

      // Player Movement
      const moveSpeed = keys["arrowup"] || keys["w"] ? 6 : 4;
      if (keys["arrowleft"] || keys["a"]) {
        player.x = Math.max(70, player.x - moveSpeed);
      }
      if (keys["arrowright"] || keys["d"]) {
        player.x = Math.min(330 - player.width, player.x + moveSpeed);
      }
      if (keys["arrowup"] || keys["w"]) {
        player.y = Math.max(100, player.y - 3);
        speedRef.current = Math.min(180, speedRef.current + 0.3);
      } else {
        player.y = Math.min(500, player.y + 1);
        speedRef.current = Math.max(60, speedRef.current - 0.2);
      }

      const currentSpeed = speedRef.current;
      setSpeed(Math.round(currentSpeed));

      // Scroll Road
      roadOffsetRef.current = (roadOffsetRef.current + currentSpeed * 0.1) % 40;

      // Score increment based on distance
      scoreRef.current += Math.round(currentSpeed * 0.05);
      setScore(scoreRef.current);
      setDistance(Math.round(scoreRef.current / 10));

      // Spawn Obstacles
      const now = Date.now();
      const spawnInterval = Math.max(900, 2200 - currentSpeed * 8);
      if (now - lastSpawn > spawnInterval) {
        lastSpawn = now;
        const lanes = [90, 160, 230, 280];
        const chosenLane = lanes[Math.floor(Math.random() * lanes.length)];
        const types: Array<{ type: "car" | "truck" | "barrier"; w: number; h: number; color: string }> = [
          { type: "car", w: 42, h: 72, color: "#EF4444" },
          { type: "car", w: 42, h: 72, color: "#3B82F6" },
          { type: "truck", w: 48, h: 96, color: "#F59E0B" },
          { type: "barrier", w: 40, h: 30, color: "#EAB308" },
        ];
        const chosen = types[Math.floor(Math.random() * types.length)];

        obstaclesRef.current.push({
          id: now + Math.random(),
          x: chosenLane,
          y: -100,
          width: chosen.w,
          height: chosen.h,
          speed: currentSpeed * 0.04 + (Math.random() * 2 - 1),
          color: chosen.color,
          type: chosen.type,
        });
      }

      // Update & Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Roadside Grass & Curbs
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Road boundary
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(60, 0, 280, canvas.height);

      // White lane curbs
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(56, 0, 4, canvas.height);
      ctx.fillRect(340, 0, 4, canvas.height);

      // Road dashed line dividers
      ctx.strokeStyle = "#FDE047";
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.lineDashOffset = -roadOffsetRef.current;

      ctx.beginPath();
      ctx.moveTo(150, 0);
      ctx.lineTo(150, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(250, 0);
      ctx.lineTo(250, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Draw & Update Obstacles
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const obs = obstaclesRef.current[i];
        obs.y += obs.speed + currentSpeed * 0.05;

        // Draw Obstacle Car / Truck / Barrier
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(obs.x, obs.y, obs.width, obs.height, [6, 6, 6, 6]);
        } else {
          ctx.rect(obs.x, obs.y, obs.width, obs.height);
        }
        ctx.fill();

        // Windshield
        ctx.fillStyle = "#0F172A";
        ctx.fillRect(obs.x + 6, obs.y + 14, obs.width - 12, 14);

        // Headlights
        ctx.fillStyle = "#FEF08A";
        ctx.fillRect(obs.x + 4, obs.y + obs.height - 4, 8, 4);
        ctx.fillRect(obs.x + obs.width - 12, obs.y + obs.height - 4, 8, 4);

        // Collision Check (AABB with safe inset)
        const inset = 6;
        if (
          player.x + inset < obs.x + obs.width - inset &&
          player.x + player.width - inset > obs.x + inset &&
          player.y + inset < obs.y + obs.height - inset &&
          player.y + player.height - inset > obs.y + inset
        ) {
          // Crash!
          setGameState("gameover");
          if (scoreRef.current > highScore) {
            setHighScore(scoreRef.current);
            try {
              localStorage.setItem("car_game_highscore", scoreRef.current.toString());
            } catch {}
          }
          isRunning = false;
          return;
        }

        // Cleanup off-screen
        if (obs.y > canvas.height + 150) {
          obstaclesRef.current.splice(i, 1);
        }
      }

      // 3. Draw Player Car
      ctx.save();
      ctx.shadowColor = "#10B981";
      ctx.shadowBlur = 12;

      // Car body
      ctx.fillStyle = "#10B981"; // Emerald Neon Sports Car
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === "function") {
        (ctx as any).roundRect(player.x, player.y, player.width, player.height, [8, 8, 8, 8]);
      } else {
        ctx.rect(player.x, player.y, player.width, player.height);
      }
      ctx.fill();
      ctx.restore();

      // Roof / Cockpit
      ctx.fillStyle = "#064E3B";
      ctx.fillRect(player.x + 6, player.y + 16, player.width - 12, 34);

      // Windshield
      ctx.fillStyle = "#6EE7B7";
      ctx.fillRect(player.x + 8, player.y + 18, player.width - 16, 12);

      // Headlights (Beam Forward)
      ctx.fillStyle = "rgba(254, 240, 138, 0.25)";
      ctx.beginPath();
      ctx.moveTo(player.x + 4, player.y);
      ctx.lineTo(player.x - 20, player.y - 120);
      ctx.lineTo(player.x + player.width + 20, player.y - 120);
      ctx.lineTo(player.x + player.width - 4, player.y);
      ctx.closePath();
      ctx.fill();

      // Taillights
      ctx.fillStyle = "#EF4444";
      ctx.fillRect(player.x + 4, player.y + player.height - 4, 8, 4);
      ctx.fillRect(player.x + player.width - 12, player.y + player.height - 4, 8, 4);

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [gameState, highScore]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 overflow-hidden overflow-x-hidden box-border">
      {/* Top Telemetry Header */}
      <header className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
          <h1 className="font-extrabold tracking-wider text-xs sm:text-base md:text-xl text-emerald-400 truncate">
            ${project.name.toUpperCase()}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-4 text-[10px] sm:text-xs font-mono shrink-0">
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
            <Gauge className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 shrink-0" />
            <span className="font-bold whitespace-nowrap">{speed} km/h</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
            <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
            <span className="whitespace-nowrap">High: <strong className="text-amber-300">{highScore}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Game Stage Wrapper */}
      <main className="w-full max-w-4xl flex-1 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 min-h-0">
        {/* Left Telemetry Panel (Desktop) */}
        <aside className="hidden md:flex flex-col gap-3 w-56 text-xs font-mono shrink-0">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Telemetry</span>
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-400">Current Score:</span>
              <span className="text-emerald-400 font-bold">{score}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-400">Distance:</span>
              <span className="text-cyan-400 font-bold">{distance} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Road Offset:</span>
              <span className="text-slate-300 font-bold">{Math.round(roadOffsetRef.current)}px</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Keyboard HUD</span>
            <div className="text-[11px] text-slate-300">Steer: <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700">←</kbd> <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700">→</kbd></div>
            <div className="text-[11px] text-slate-300">Boost: <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700">↑</kbd></div>
          </div>
        </aside>

        {/* Center Canvas Game Viewport */}
        <div className="relative border-2 sm:border-4 border-slate-800 rounded-2xl overflow-hidden shadow-2xl bg-slate-900 w-full max-w-[400px] h-full max-h-full min-h-0 min-w-0 flex items-center justify-center shrink">
          <canvas
            ref={canvasRef}
            width={400}
            height={600}
            className="block bg-slate-950 max-w-full max-h-full w-auto h-auto aspect-[2/3] touch-none"
          />

          {/* Overlay Menu */}
          {gameState === "menu" && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-3 sm:p-6 text-center space-y-3 sm:space-y-4 animate-fadeIn">
              <div className="p-2 sm:p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/40 text-emerald-400 shrink-0">
                <Zap className="w-7 h-7 sm:w-10 sm:h-10" />
              </div>
              <div className="px-2">
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white mb-0.5 break-words">
                  ${project.name}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mx-auto line-clamp-2">
                  ${project.objective || "Dodge obstacles and traffic at high velocity on the infinite highway."}
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-2 sm:p-3 rounded-xl text-[10px] sm:text-xs space-y-1 text-left w-full max-w-[240px] sm:max-w-xs font-mono">
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-wider">Controls:</div>
                <div className="flex items-center justify-between">
                  <span>Steer:</span>
                  <span className="font-bold text-emerald-400">← / → or A / D</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Accelerate:</span>
                  <span className="font-bold text-emerald-400">↑ or W</span>
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full max-w-[240px] sm:max-w-xs py-2.5 sm:py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                <span>START PLAYING</span>
              </button>
            </div>
          )}

          {/* Game Over Screen */}
          {gameState === "gameover" && (
            <div className="absolute inset-0 bg-red-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-3 sm:p-6 text-center space-y-3 sm:space-y-4 animate-fadeIn">
              <div className="p-2 sm:p-3 bg-red-500/20 rounded-2xl border border-red-500/40 text-red-400 shrink-0">
                <ShieldAlert className="w-7 h-7 sm:w-10 sm:h-10" />
              </div>
              <div className="px-2">
                <h2 className="text-xl sm:text-3xl font-black tracking-tight text-red-400 mb-0.5">
                  CRASHED!
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-300">
                  You collided with oncoming highway traffic!
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-center w-full max-w-[240px] sm:max-w-xs space-y-1.5 font-mono">
                <div>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold block">Final Score</span>
                  <span className="text-xl sm:text-2xl font-bold text-white">{score}</span>
                </div>
                <div className="border-t border-slate-800 pt-1 flex justify-between text-[11px] sm:text-xs">
                  <span className="text-slate-400">Distance:</span>
                  <span className="text-cyan-400 font-bold">{distance} m</span>
                </div>
              </div>

              <button
                onClick={startGame}
                className="w-full max-w-[240px] sm:max-w-xs py-2.5 sm:py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>PLAY AGAIN</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Info Panel (Desktop) */}
        <aside className="hidden md:flex flex-col gap-3 w-56 text-xs font-mono shrink-0">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Engine Status</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-200 font-semibold">{gameState === "playing" ? "Physics Active" : "Engine Idling"}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              HTML5 Canvas with hardware acceleration & 60fps game loop.
            </p>
          </div>
        </aside>
      </main>

      {/* Touch / Mobile Controls */}
      <footer className="mt-2 sm:mt-3 flex items-center justify-center gap-2 sm:gap-4 w-full max-w-xs sm:max-w-md px-1 shrink-0">
        <button
          onMouseDown={() => (keysRef.current["arrowleft"] = true)}
          onMouseUp={() => (keysRef.current["arrowleft"] = false)}
          onTouchStart={() => (keysRef.current["arrowleft"] = true)}
          onTouchEnd={() => (keysRef.current["arrowleft"] = false)}
          aria-label="Steer Left"
          className="p-2.5 sm:p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 active:bg-emerald-500 active:text-black transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          onMouseDown={() => (keysRef.current["arrowup"] = true)}
          onMouseUp={() => (keysRef.current["arrowup"] = false)}
          onTouchStart={() => (keysRef.current["arrowup"] = true)}
          onTouchEnd={() => (keysRef.current["arrowup"] = false)}
          aria-label="Nitro Boost"
          className="flex-1 py-2.5 sm:py-3.5 px-3 sm:px-6 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 active:bg-emerald-500 active:text-black transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold"
        >
          <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">NITRO BOOST</span>
        </button>

        <button
          onMouseDown={() => (keysRef.current["arrowright"] = true)}
          onMouseUp={() => (keysRef.current["arrowright"] = false)}
          onTouchStart={() => (keysRef.current["arrowright"] = true)}
          onTouchEnd={() => (keysRef.current["arrowright"] = false)}
          aria-label="Steer Right"
          className="p-2.5 sm:p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 active:bg-emerald-500 active:text-black transition-colors shrink-0"
        >
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </footer>
    </div>
  );
};
`;
  } else if (archetype === "game") {
    // Interactive 2D Arcade Game Canvas Baseline with loop and controls
    appTsx = `import React, { useState, useEffect, useRef } from "react";
import { Play, RotateCcw, Trophy, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";

export const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const playerRef = useRef({ x: 175, y: 380, width: 30, height: 30 });
  const targetsRef = useRef<{ x: number; y: number; size: number }[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") playerRef.current.x = Math.max(20, playerRef.current.x - 20);
      if (e.key === "ArrowRight") playerRef.current.x = Math.min(350, playerRef.current.x + 20);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const loop = () => {
      frame++;
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw player
      ctx.fillStyle = "#10b981";
      ctx.fillRect(playerRef.current.x, playerRef.current.y, playerRef.current.width, playerRef.current.height);

      // Spawn falling targets
      if (frame % 60 === 0) {
        targetsRef.current.push({ x: Math.random() * 340 + 20, y: 0, size: 20 });
      }

      // Update & draw targets
      for (let i = targetsRef.current.length - 1; i >= 0; i--) {
        const t = targetsRef.current[i];
        t.y += 3;
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(t.x, t.y, t.size, t.size);

        // Collision check
        if (
          Math.abs(t.x - playerRef.current.x) < 25 &&
          Math.abs(t.y - playerRef.current.y) < 25
        ) {
          targetsRef.current.splice(i, 1);
          setScore((s) => s + 10);
        } else if (t.y > 420) {
          targetsRef.current.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 text-center overflow-x-hidden box-border">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl space-y-4 box-border">
        <h1 className="text-xl sm:text-2xl font-bold text-emerald-400 truncate">${project.name}</h1>
        <div className="flex justify-between items-center text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <span>Score: <strong className="text-amber-400">{score}</strong></span>
          <span>Status: <strong className="text-emerald-400">{isPlaying ? "RUNNING" : "READY"}</strong></span>
        </div>
        <div className="flex justify-center border border-slate-800 rounded-xl overflow-hidden bg-slate-950 max-w-full">
          <canvas ref={canvasRef} width={380} height={420} className="w-full h-auto max-h-[55vh] aspect-[380/420] object-contain touch-none" />
        </div>
        {!isPlaying ? (
          <button
            onClick={() => { setIsPlaying(true); setScore(0); }}
            className="w-full py-2.5 sm:py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            START GAME
          </button>
        ) : (
          <button
            onClick={() => setIsPlaying(false)}
            className="w-full py-2.5 bg-red-500/20 text-red-300 font-bold rounded-xl border border-red-500/30 text-xs sm:text-sm cursor-pointer"
          >
            PAUSE
          </button>
        )}
      </div>
    </div>
  );
};
`;
  } else if (archetype === "dashboard") {
    // Interactive Analytical Dashboard Baseline with KPIs and filters
    appTsx = `import React, { useState } from "react";
import { BarChart3, TrendingUp, Users, DollarSign, Filter, RefreshCw } from "lucide-react";

export const App: React.FC = () => {
  const [filterPeriod, setFilterPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [metrics, setMetrics] = useState({
    activeUsers: 1420,
    throughput: "98.4%",
    latency: "42ms",
    revenue: "$12,480",
  });

  const handleRefresh = () => {
    setMetrics({
      activeUsers: Math.floor(Math.random() * 500) + 1200,
      throughput: (98 + Math.random()).toFixed(1) + "%",
      latency: Math.floor(Math.random() * 20 + 30) + "ms",
      revenue: "$" + (12000 + Math.floor(Math.random() * 1000)).toLocaleString(),
    });
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-8 font-sans overflow-x-hidden box-border">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-4 sm:pb-6 border-b border-slate-800 gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">${project.name}</h1>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">${project.objective || "Operational Telemetry & Business Metrics"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-[11px] sm:text-xs font-semibold">
            {(["24h", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPeriod(p)}
                className={\`px-2.5 sm:px-3 py-1 rounded-lg transition-colors cursor-pointer \${filterPeriod === p ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}\`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-[11px] sm:text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-4 sm:mt-6 space-y-4 sm:space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-xl space-y-1">
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider">Active Users</span>
            <div className="text-xl sm:text-2xl font-extrabold text-white">{metrics.activeUsers}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-xl space-y-1">
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider">Throughput</span>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400">{metrics.throughput}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-xl space-y-1">
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider">Avg Latency</span>
            <div className="text-xl sm:text-2xl font-extrabold text-cyan-400">{metrics.latency}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-xl space-y-1">
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-bold tracking-wider">Gross Volume</span>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-400">{metrics.revenue}</div>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider">Performance Trend ({filterPeriod})</span>
            <span className="text-[11px] sm:text-xs text-emerald-400 font-mono">+14.2% vs previous period</span>
          </div>
          <div className="h-40 sm:h-48 flex items-end gap-1.5 sm:gap-3 pt-4 sm:pt-6 pb-2 border-b border-slate-800 overflow-x-auto">
            {[45, 60, 52, 78, 65, 88, 92, 70, 85, 95].map((val, i) => (
              <div key={i} className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group">
                <div
                  className="w-full bg-emerald-500/80 group-hover:bg-emerald-400 rounded-t transition-all"
                  style={{ height: \`\${val}%\` }}
                />
                <span className="text-[9px] text-slate-500 font-mono">D{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
`;
  } else if (archetype === "website") {
    // Interactive Portfolio / Landing Website Baseline
    appTsx = `import React, { useState } from "react";
import { ArrowRight, Star, CheckCircle, Mail, Globe, Sparkles } from "lucide-react";

export const App: React.FC = () => {
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-black overflow-x-hidden box-border">
      <nav className="max-w-6xl mx-auto p-3 sm:p-6 flex flex-wrap items-center justify-between border-b border-slate-800 gap-3">
        <div className="text-base sm:text-lg font-black text-white tracking-tight truncate">${project.name}</div>
        <div className="flex items-center gap-3 sm:gap-6 text-xs text-slate-300 font-semibold">
          <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
          <a href="#work" className="hover:text-emerald-400 transition-colors">Portfolio</a>
          <a href="#contact" className="hover:text-emerald-400 transition-colors">Contact</a>
        </div>
      </nav>

      <header className="max-w-4xl mx-auto text-center py-10 sm:py-20 px-3 sm:px-6 space-y-4 sm:space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Next-Generation Digital Craft</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white tracking-tight leading-tight break-words">
          ${project.description || project.objective || "Engineered for extraordinary digital experiences."}
        </h1>
        <p className="text-xs sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Delivering high-performance architecture, human-centric design, and scalable autonomous pipelines.
        </p>

        <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 max-w-md mx-auto w-full">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 box-border"
          />
          <button
            onClick={() => setSubscribed(true)}
            className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 whitespace-nowrap cursor-pointer transition-transform active:scale-95"
          >
            {subscribed ? "Subscribed!" : "Get Early Access"}
          </button>
        </div>
      </header>

      <footer className="max-w-6xl mx-auto p-4 sm:p-6 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© ${new Date().getFullYear()} ${project.name}. All rights reserved.</span>
        <span>Built with ProjectNova AI</span>
      </footer>
    </div>
  );
};
`;
  } else {
    // Web Application / Dashboard
    appTsx = `import React, { useState } from "react";
import { Layers, Activity, CheckCircle2, Terminal } from "lucide-react";

export const App: React.FC = () => {
  const [status, setStatus] = useState("operational");

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-12 overflow-x-hidden box-border">
      <header className="max-w-5xl mx-auto flex flex-wrap items-center justify-between pb-4 sm:pb-6 border-b border-slate-800 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">${project.name}</h1>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">${project.objective || "Application Workspace"}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-mono shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{status.toUpperCase()}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-bold text-slate-400">System Core</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-sm text-slate-300">Ready for continuous operation.</p>
        </div>
      </main>
    </div>
  );
};
`;
  }

  const readmeMd = `# ${project.name}

${project.description || project.objective || "A modern application generated by ProjectNova AI."}

## Architecture Overview
- **Category:** ${project.category}
- **Technologies:** ${(project.technologies || []).join(", ") || "React, TypeScript, Vite, Tailwind CSS"}

## Getting Started

### Prerequisites
- Node.js (version 18+ recommended)
- Package manager (npm, pnpm, yarn, or bun)

### Running the Project

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start the development server:**
   \`\`\`bash
   npm run dev
   \`\`\`
   Then open **http://localhost:5173** in your browser.

3. **Build for production:**
   \`\`\`bash
   npm run build
   \`\`\`

4. **Preview production build:**
   \`\`\`bash
   npm run preview
   \`\`\`
`;

  const envReport = deriveProjectEnvironmentReport(project);

  return {
    "package.json": packageJson,
    "tsconfig.json": tsconfigJson,
    "vite.config.ts": viteConfig,
    "index.html": indexHtml,
    ".env.example": envReport.envExampleContent,
    ".gitignore": envReport.gitignoreContent,
    "src/main.tsx": mainTsx,
    "src/index.css": indexCss,
    "src/app/App.tsx": appTsx,
    "README.md": readmeMd,
  };
}
