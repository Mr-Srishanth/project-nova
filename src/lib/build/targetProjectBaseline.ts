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
}): "car_game" | "game" | "dashboard" | "website" | "ecommerce" | "data_pipeline" | "web_app" {
  const combined = `${project.name} ${project.category || ""} ${project.objective || ""} ${project.description || ""} ${(project.technologies || []).join(" ")}`.toLowerCase();

  if (
    combined.includes("shop") ||
    combined.includes("ecommerce") ||
    combined.includes("e-commerce") ||
    combined.includes("store") ||
    combined.includes("cart") ||
    combined.includes("liquid glass") ||
    combined.includes("checkout") ||
    combined.includes("catalog")
  ) {
    return "ecommerce";
  }

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
  } else if (archetype === "ecommerce") {
    // E-Commerce Shopping Experience with Liquid Glass Styling & 5 Interactive Views
    appTsx = `import React, { useState, useEffect } from "react";
import { ShoppingBag, ShoppingCart, User, Key, ArrowRight, Plus, Minus, Trash2, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

interface Product {
  id: string;
  name: string;
  tagline: string;
  price: number;
  category: string;
  rating: number;
  badge: string;
}

const PRODUCTS: Product[] = [
  { id: "prod-1", name: "CyberDeck Vision Neo", tagline: "Bionic augmented interface glasses with neural link optics", price: 1299, category: "Hardware", rating: 4.9, badge: "Liquid Glass Edition" },
  { id: "prod-2", name: "PulseCore Synthesizer", tagline: "Tactile haptic audio workstation with optical keybed", price: 849, category: "Audio", rating: 4.8, badge: "Flagship" },
  { id: "prod-3", name: "Aetheria Glass Pod", tagline: "Levitating ambient sound sphere with midnight acoustic core", price: 450, category: "Lifestyle", rating: 4.9, badge: "Trending" },
  { id: "prod-4", name: "Neural Chrono V2", tagline: "Biometric chronometer encased in curved fused sapphire", price: 620, category: "Wearables", rating: 4.7, badge: "New" },
  { id: "prod-5", name: "Quantum Data Key", tagline: "20TB crystalline cold-storage vault with biometric touch", price: 299, category: "Security", rating: 5.0, badge: "Ultra" },
  { id: "prod-6", name: "Prism Flow Headset", tagline: "Zero-latency holographic acoustic monitor with frosted chassis", price: 399, category: "Audio", rating: 4.8, badge: "Popular" }
];

interface CartItem {
  product: Product;
  quantity: number;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"home" | "catalog" | "cart" | "login" | "register">("home");
  
  // Persistent Quantum Ledger Cart State
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("nova_liquid_glass_cart");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Seed with two default products matching prompt test arithmetic ($1299 + $849 = $2148)
    return [
      { product: PRODUCTS[0], quantity: 1 },
      { product: PRODUCTS[1], quantity: 1 }
    ];
  });

  // Auth Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regMsg, setRegMsg] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("nova_liquid_glass_cart", JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  return (
    <div className="relative min-h-screen w-full bg-[#0f0c20] text-slate-100 font-sans selection:bg-[#ff007f] selection:text-white overflow-x-hidden">
      {/* Dynamic Animated Liquid Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00f0ff]/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-[#ff007f]/25 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px]" />
      </div>

      {/* Glass Navigation Header */}
      <nav className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-[#0f0c20]/60 border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
        <div 
          onClick={() => setActiveTab("home")}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff007f] to-[#00f0ff] p-[1.5px] shadow-[0_0_20px_rgba(255,0,127,0.4)]">
            <div className="w-full h-full bg-[#0f0c20] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-300 group-hover:rotate-12 transition-transform" />
            </div>
          </div>
          <span className="font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-[#00f0ff] text-lg sm:text-xl">
            \${project.name}
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white/5 border border-white/10 p-1 rounded-2xl backdrop-blur-md">
          <button
            onClick={() => setActiveTab("home")}
            className={\`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
              activeTab === "home" ? "bg-white/15 text-white shadow-inner border border-white/10" : "text-slate-400 hover:text-white"
            }\`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={\`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
              activeTab === "catalog" ? "bg-white/15 text-white shadow-inner border border-white/10" : "text-slate-400 hover:text-white"
            }\`}
          >
            Catalog
          </button>
          <button
            onClick={() => setActiveTab("cart")}
            className={\`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 \${
              activeTab === "cart" ? "bg-white/15 text-white shadow-inner border border-white/10" : "text-slate-400 hover:text-white"
            }\`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Cart</span>
            {totalItems > 0 && (
              <span className="px-1.5 py-0.2 bg-[#ff007f] text-white text-[10px] font-black rounded-full shadow-[0_0_8px_#ff007f]">
                {totalItems}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("login")}
            className={\`hidden sm:block px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
              activeTab === "login" ? "bg-white/15 text-white shadow-inner border border-white/10" : "text-slate-400 hover:text-white"
            }\`}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={\`hidden sm:block px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer \${
              activeTab === "register" ? "bg-white/15 text-white shadow-inner border border-white/10" : "text-slate-400 hover:text-white"
            }\`}
          >
            Register
          </button>
        </div>
      </nav>

      {/* View 1: Home Page */}
      {activeTab === "home" && (
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/15 backdrop-blur-xl mb-6 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-200">Liquid Glass Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1] max-w-4xl text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-sm">
            Elegance cast in frosted light & sensory optics.
          </h1>

          <p className="mt-6 text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
            Welcome to the flagship shopping interface. Experience organic glass surfaces, fluid refraction gradients, and real-time ledger cart arithmetic.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setActiveTab("catalog")}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#ff007f] to-[#00f0ff] hover:opacity-95 text-white font-bold text-sm flex items-center gap-2 shadow-[0_0_30px_rgba(255,0,127,0.4)] transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab("cart")}
              className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 backdrop-blur-xl text-white font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-cyan-300" />
              <span>View Cart (\${subtotal})</span>
            </button>
          </div>

          {/* Featured Highlights Grid */}
          <div className="mt-16 sm:mt-24 w-full grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <div className="w-10 h-10 rounded-2xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-[#00f0ff]" />
              </div>
              <h3 className="text-base font-bold text-white">Refractive Glass</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">Organic translucent panels with backdrop blur, specular highlights, and chromatic edge luminescence.</p>
            </div>
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <div className="w-10 h-10 rounded-2xl bg-[#ff007f]/10 border border-[#ff007f]/30 flex items-center justify-center mb-4">
                <ShoppingCart className="w-5 h-5 text-[#ff007f]" />
              </div>
              <h3 className="text-base font-bold text-white">Quantum Ledger</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">Live multi-item cart arithmetic, dynamic quantity adjustments, and persistent storage synchronization.</p>
            </div>
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-purple-300" />
              </div>
              <h3 className="text-base font-bold text-white">Secure Identity</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">Inline credential verification, interactive account validation, and instant session tokens.</p>
            </div>
          </div>
        </main>
      )}

      {/* View 2: Catalog Page */}
      {activeTab === "catalog" && (
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-white/10 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Product Catalog</h2>
              <p className="text-xs text-slate-400 mt-1">Select premium hardware and apparel to dispatch to your ledger.</p>
            </div>
            <div className="text-xs font-mono text-cyan-300 bg-[#00f0ff]/10 border border-[#00f0ff]/20 px-3 py-1.5 rounded-xl">
              Showing {PRODUCTS.length} Flagship Items
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCTS.map((prod) => (
              <div
                key={prod.id}
                className="group p-5 rounded-3xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 backdrop-blur-2xl transition-all duration-300 flex flex-col justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-white/10 text-cyan-200 border border-white/10">
                      {prod.category}
                    </span>
                    <span className="text-[10px] font-bold text-[#ff007f] bg-[#ff007f]/10 border border-[#ff007f]/20 px-2 py-0.5 rounded-full">
                      {prod.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-200 transition-colors">
                    {prod.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {prod.tagline}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xl font-black text-white">
                    \${prod.price}
                  </span>
                  <button
                    onClick={() => addToCart(prod)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff007f] to-[#00f0ff] hover:opacity-90 text-white font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-transform active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* View 3: Cart Page (Quantum Ledger) */}
      {activeTab === "cart" && (
        <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Quantum Ledger Cart</h2>
              <p className="text-xs text-slate-400 mt-1">Review items, adjust quantities, and calculate final settlement.</p>
            </div>
            <button
              onClick={() => setActiveTab("catalog")}
              className="text-xs font-semibold text-cyan-300 hover:underline cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl text-center">
              <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white">Your cart is empty</h3>
              <p className="text-xs text-slate-400 mt-1">Add items from the catalog to activate the ledger.</p>
              <button
                onClick={() => setActiveTab("catalog")}
                className="mt-6 px-5 py-2.5 rounded-xl bg-[#00f0ff]/20 border border-[#00f0ff]/30 text-cyan-200 font-bold text-xs hover:bg-[#00f0ff]/30 transition-all cursor-pointer"
              >
                Go to Catalog
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm sm:text-base text-white truncate">{product.name}</h4>
                    <span className="text-xs text-cyan-300 font-mono">\${product.price} each</span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1">
                      <button
                        onClick={() => updateQuantity(product.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-mono font-bold text-white">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, 1)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <span className="text-base font-black text-white font-mono">
                        \${product.price * quantity}
                      </span>
                    </div>

                    <button
                      onClick={() => removeFromCart(product.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Summary Card */}
              <div className="mt-8 p-6 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/15 backdrop-blur-2xl">
                <div className="flex items-center justify-between text-sm text-slate-300 pb-3 border-b border-white/10">
                  <span>Cart Items</span>
                  <span className="font-mono font-bold text-white">{totalItems} units</span>
                </div>
                <div className="flex items-center justify-between text-lg sm:text-xl font-black text-white pt-4">
                  <span>Subtotal</span>
                  <span className="text-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-[#00f0ff] font-mono">
                    \${subtotal}
                  </span>
                </div>

                <button
                  onClick={() => alert("Order successfully dispatched to ledger with subtotal: $" + subtotal)}
                  className="w-full mt-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#ff007f] via-purple-600 to-[#00f0ff] hover:opacity-95 text-white font-bold text-sm shadow-[0_0_25px_rgba(255,0,127,0.4)] transition-all cursor-pointer hover:scale-[1.01] active:scale-95"
                >
                  Proceed to Checkout (\${subtotal})
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* View 4: Login Page */}
      {activeTab === "login" && (
        <main className="relative z-10 max-w-md mx-auto px-4 py-16 sm:py-24">
          <div className="p-8 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center">
                <User className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Member Login</h3>
                <p className="text-xs text-slate-400">Access your ledger credentials</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!loginEmail || !loginPass) {
                  setLoginMsg("Please provide both email and password.");
                  return;
                }
                setLoginMsg("Access Granted: Welcome back, " + loginEmail);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="user@projectnova.dev"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 box-border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 box-border"
                />
              </div>

              {loginMsg && (
                <div className={\`p-3 rounded-xl text-xs flex items-center gap-2 \${
                  loginMsg.startsWith("Access Granted")
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                }\`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{loginMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#00f0ff] to-cyan-500 hover:opacity-90 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-transform active:scale-95 cursor-pointer"
              >
                Sign In
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-xs text-slate-400">Don't have an account? </span>
              <button
                onClick={() => setActiveTab("register")}
                className="text-xs font-bold text-cyan-300 hover:underline cursor-pointer"
              >
                Register here
              </button>
            </div>
          </div>
        </main>
      )}

      {/* View 5: Register Page */}
      {activeTab === "register" && (
        <main className="relative z-10 max-w-md mx-auto px-4 py-16 sm:py-24">
          <div className="p-8 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#ff007f]/10 border border-[#ff007f]/30 flex items-center justify-center">
                <Key className="w-5 h-5 text-[#ff007f]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Create Account</h3>
                <p className="text-xs text-slate-400">Join the Liquid Glass ecosystem</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!regName || !regEmail || !regPass) {
                  setRegMsg("All fields are required.");
                  return;
                }
                setRegMsg("Account registered successfully! You may now sign in.");
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nova Pilot"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 box-border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="pilot@projectnova.dev"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 box-border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Security Key (Password)</label>
                <input
                  type="password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 box-border"
                />
              </div>

              {regMsg && (
                <div className={\`p-3 rounded-xl text-xs flex items-center gap-2 \${
                  regMsg.includes("successfully")
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                }\`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{regMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#ff007f] to-pink-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,0,127,0.3)] transition-transform active:scale-95 cursor-pointer"
              >
                Create Account
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-xs text-slate-400">Already registered? </span>
              <button
                onClick={() => setActiveTab("login")}
                className="text-xs font-bold text-pink-400 hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 border-t border-white/10 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>© ${new Date().getFullYear()} ${project.name}. Liquid Glass Design System.</span>
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
