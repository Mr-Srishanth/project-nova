import React, { useState } from "react";
import {
  Bot,
  Send,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { Project } from "@/types/project";
import type { ProjectMemory } from "@/types/memory";
import type { AssistQueryOutput } from "@/lib/ai/types";
import { aiClient } from "@/lib/ai/client";
import { assembleProjectContext } from "@/lib/ai/contextAssembly";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";

interface ProjectAIAssistantProps {
  project: Project;
  memories: ProjectMemory[];
}

interface MessageHistory {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  details?: AssistQueryOutput;
}

export const ProjectAIAssistant: React.FC<ProjectAIAssistantProps> = ({ project, memories }) => {
  const [messages, setMessages] = useState<MessageHistory[]>([
    {
      id: "init",
      role: "assistant",
      text: `Hello! I am your ProjectNova Architectural Assistant for **${project.name}**. I am grounded strictly in your project objectives, confirmed brain memories, and current blueprint. How can I assist your build today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setQuery("");
    setError(null);

    const userMsg: MessageHistory = {
      id: `usr_${Date.now()}`,
      role: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Assemble strictly scoped project context
      const { text: contextText } = assembleProjectContext(project, memories);

      const res = await aiClient.queryAssistant({
        projectId: project.id,
        question: userText,
        contextText,
      });

      const assistantMsg: MessageHistory = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        details: res,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || "Failed to communicate with AI gateway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-surface border-2 border-border shadow-hard flex flex-col h-[650px] p-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-[#FAF7ED] border-b-2 border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-tactile-sm bg-primary border border-border flex items-center justify-center text-foreground font-bold text-xs shadow-hard-sm">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-foreground">Project Intelligence Assistant</h3>
            <span className="text-[10px] font-mono text-foreground-muted block">
              Grounded in {project.name} Context ({memories.length} memories active)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="blue">Gateway Active</Badge>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono text-foreground-muted">
              <span>{m.role === "user" ? "You" : "ProjectNova AI"}</span>
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>

            <div
              className={`max-w-[85%] rounded-tactile p-3.5 text-xs font-sans leading-relaxed border-2 ${
                m.role === "user"
                  ? "bg-primary/20 border-border text-foreground shadow-hard-sm"
                  : "bg-surface border-border text-foreground shadow-hard-sm"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {/* Code Snippets if returned */}
              {m.details?.codeSnippets && m.details.codeSnippets.length > 0 && (
                <div className="mt-3 space-y-2">
                  {m.details.codeSnippets.map((c, i) => (
                    <div key={i} className="border border-border rounded-tactile overflow-hidden">
                      <div className="flex items-center justify-between px-2.5 py-1 bg-[#FAF7ED] border-b border-border/20 text-[10px] font-mono">
                        <span>{c.filename || `${c.language} snippet`}</span>
                        <CopyButton text={c.code} />
                      </div>
                      <pre className="p-2.5 bg-[#FAF7ED] text-[11px] font-mono overflow-x-auto text-foreground">
                        <code>{c.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested Action */}
              {m.details?.suggestedAction && (
                <div className="mt-2.5 pt-2 border-t border-border/10 flex items-start gap-1.5 text-[11px] font-mono text-accent-blue-strong">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Recommendation: {m.details.suggestedAction}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-[#FAF7ED] border border-border rounded-tactile max-w-[60%] animate-pulse">
            <Bot className="w-4 h-4 text-foreground-muted" />
            <span className="text-xs font-mono text-foreground-muted">Consulting Project Brain & Blueprint…</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-danger/10 border-2 border-danger rounded-tactile text-xs font-mono text-danger font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input Row */}
      <form onSubmit={handleSend} className="p-3 bg-[#FAF7ED] border-t-2 border-border flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask about architectural choices, missing requirements, or technology trade-offs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
          className="flex-1 bg-surface border-2 border-border rounded-tactile px-3.5 py-2 text-xs text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-1 focus:ring-foreground shadow-hard-sm"
        />
        <Button size="sm" type="submit" disabled={loading || !query.trim()} icon={<Send className="w-3.5 h-3.5" />}>
          Send
        </Button>
      </form>
    </Card>
  );
};
