import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useDemoMode } from "@/lib/demo/demoMode";
import {
  DEMO_LIVE_URL,
  DEMO_PROJECTS,
  DEMO_TEST_CASES,
  demoCartCount,
  demoCartTotal,
  type CartQuantities,
  type DemoProject,
} from "@/lib/demo/demoData";

/**
 * Demo Mode page — predefined jury/demo presentation only.
 *
 * No AI generation, no gateway request, no Supabase read/write and no
 * real-project change happens here. Menus, carts, test results and
 * deploy status are all predefined local data. Turning Demo Mode OFF
 * (or leaving this page) returns the user to normal mode untouched.
 */
export const DemoModePage: React.FC = () => {
  const { demoOn, setDemoOn } = useDemoMode();
  const [projectId, setProjectId] = useState<string>(DEMO_PROJECTS[0].id);
  const [quantities, setQuantities] = useState<CartQuantities>({});
  const [testRun, setTestRun] = useState<number>(0);
  const [fixApplied, setFixApplied] = useState<boolean>(false);
  const [selectedFailId, setSelectedFailId] = useState<string | null>(null);

  const project: DemoProject =
    DEMO_PROJECTS.find((p) => p.id === projectId) ?? DEMO_PROJECTS[0];

  const cartCount = demoCartCount(quantities);
  const cartTotal = demoCartTotal(project, quantities);

  const results = useMemo(() => {
    if (testRun === 0) return null;
    // First run: predefined passes and fails. After the fix step is
    // applied and tests are re-run, every case shows as passing.
    return DEMO_TEST_CASES.map((c) => ({
      ...c,
      status: fixApplied ? ("pass" as const) : c.firstRun,
    }));
  }, [testRun, fixApplied]);

  const failing = results?.filter((r) => r.status === "fail") ?? [];
  const selectedFail = failing.find((r) => r.id === selectedFailId) ?? failing[0] ?? null;

  const selectProject = (id: string) => {
    setProjectId(id);
    setQuantities({});
  };

  const addToCart = (name: string) => {
    setQuantities((prev) => ({ ...prev, [name]: (prev[name] ?? 0) + 1 }));
  };

  const runTests = () => {
    setTestRun((n) => n + 1);
    setSelectedFailId(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-tactile border-2 border-amber-500 bg-amber-50 p-4">
        <p className="font-display font-bold text-foreground">
          🎬 Demo Mode {demoOn ? "ON" : "— predefined demo"}
        </p>
        <p className="text-sm text-foreground-muted mt-1">
          This page shows predefined demo projects, test results and deploy status. It does not
          generate with AI, does not call the AI Gateway, and does not change your real projects.
          Turn Demo Mode OFF to return to normal mode.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDemoOn(!demoOn)}>
            {demoOn ? "Turn Demo Mode OFF" : "Turn Demo Mode ON"}
          </Button>
          <Link to="/projects">
            <Button size="sm" variant="secondary">
              Back to real projects
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">Demo Mode — Predefined Projects</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Pick a demo project. Its menu and cart work instantly — no generation wait, no build wait.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEMO_PROJECTS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={p.id === project.id ? "primary" : "secondary"}
            onClick={() => selectProject(p.id)}
          >
            {p.name}
          </Button>
        ))}
      </div>

      <Card>
        <h2 className="font-display font-bold text-xl text-foreground">{project.name}</h2>
        <p className="text-sm text-foreground-muted mt-1">{project.tagline}</p>
        <p className="text-sm font-semibold mt-3">
          Cart: {cartCount} item{cartCount === 1 ? "" : "s"} — ${cartTotal.toFixed(2)}
        </p>
        <div className="grid gap-3 mt-4 md:grid-cols-2">
          {project.menu.map((item) => (
            <div key={item.name} className="border-2 border-border rounded-tactile p-3 bg-surface">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-foreground">{item.name}</span>
                <span className="text-sm font-mono text-foreground">${item.price.toFixed(2)}</span>
              </div>
              <p className="text-xs text-foreground-muted mt-1">{item.note}</p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" onClick={() => addToCart(item.name)}>
                  Add to Cart
                </Button>
                {(quantities[item.name] ?? 0) > 0 && (
                  <span className="text-xs font-semibold">In cart: {quantities[item.name]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display font-bold text-xl text-foreground">Demo Test &amp; Fix</h2>
        <p className="text-sm text-foreground-muted mt-1">
          Predefined test run: some tests pass, some fail on purpose. A failing test shows, in
          simple words, why it failed and what to do next. Apply the fix step, re-run, and it passes.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" onClick={runTests}>
            {testRun === 0 ? "Run demo tests" : "Re-run demo tests"}
          </Button>
          {failing.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFixApplied(true);
                setSelectedFailId(null);
              }}
            >
              Apply fix step
            </Button>
          )}
          {fixApplied && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFixApplied(false);
                setTestRun(0);
              }}
            >
              Reset demo tests
            </Button>
          )}
        </div>

        {results && (
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-2 text-sm border-2 border-border rounded-tactile-sm p-2"
              >
                <span>{r.status === "pass" ? "✅" : "❌"}</span>
                <span className="flex-1 text-foreground">{r.name}</span>
                <span className="font-semibold">{r.status === "pass" ? "PASS" : "FAIL"}</span>
                {r.status === "fail" && (
                  <button
                    type="button"
                    className="text-xs font-semibold underline"
                    onClick={() => setSelectedFailId(r.id)}
                  >
                    Why?
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {selectedFail && (
          <div className="mt-4 border-2 border-border rounded-tactile p-3 bg-[#FAF7ED]">
            <p className="font-semibold text-sm text-foreground">Why this test failed</p>
            <p className="text-sm text-foreground-muted mt-1">{selectedFail.whyItFailed}</p>
            <p className="font-semibold text-sm text-foreground mt-3">What to do next</p>
            <p className="text-sm text-foreground-muted mt-1">{selectedFail.whatToDoNext}</p>
          </div>
        )}

        {results && failing.length === 0 && (
          <p className="text-sm font-semibold text-emerald-700 mt-4">
            All demo tests pass after the fix step. ✅
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-display font-bold text-xl text-foreground">Demo Deploy &amp; Monitor</h2>
        <p className="text-sm text-foreground-muted mt-1">
          Predefined deploy status for presentation. This does not change real monitoring data.
        </p>
        <ul className="text-sm mt-3 space-y-1 text-foreground">
          <li>
            Live URL:{" "}
            <a className="underline font-mono" href={DEMO_LIVE_URL}>
              {DEMO_LIVE_URL}
            </a>
          </li>
          <li>Vercel deployment: READY ✅</li>
          <li>Monitoring target (ProjectNova App): HEALTHY ✅</li>
          <li>AI Gateway: shown as a predefined status only — no gateway request is made in Demo Mode.</li>
        </ul>
      </Card>
    </div>
  );
};

export default DemoModePage;
