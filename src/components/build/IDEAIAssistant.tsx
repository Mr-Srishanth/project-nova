import React, { useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { aiClient } from "@/lib/ai/client";
import type { BuildArtifact } from "@/types/artifact";

interface IDEAIAssistantProps {
  projectId: string;
  projectName: string;
  selectedFile: BuildArtifact | null;
  onApplyCodeSnippet: (code: string) => void;
  onClose?: () => void;
}

export const IDEAIAssistant: React.FC<IDEAIAssistantProps> = ({
  projectId,
  projectName,
  selectedFile,
  onApplyCodeSnippet,
  onClose,
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string; code?: string }[]>([
    {
      role: "ai",
      text: `Hello! I'm your ProjectNova AI Pair Programmer for ${projectName}. I can explain code, generate features, diagnose build errors, or refactor selected files.`,
    },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsg = prompt.trim();
    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const fileContext = selectedFile
        ? `Currently active file: ${selectedFile.path}\n\`\`\`${selectedFile.language || "typescript"}\n${selectedFile.content.slice(0, 3000)}\n\`\`\``
        : "No active file selected.";

      const res = await aiClient.queryAssistant({
        projectId,
        question: userMsg,
        contextText: `Project: ${projectName}\n${fileContext}`,
      });

      const responseText = res.answer || "I processed your request.";
      // Extract code block if present
      const codeMatch = responseText.match(/```(?:\w+)?\n([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : undefined;

      setMessages((prev) => [...prev, { role: "ai", text: responseText, code }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `Error calling AI Assistant: ${err.message || "Failed to contact gateway."}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#2d2d2d] text-[#cccccc] text-xs">
      {/* Header */}
      <div className="p-2.5 border-b border-[#2d2d2d] bg-[#252526] flex items-center justify-between select-none">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="font-bold uppercase tracking-wider text-[11px] text-white">
            AI Assistant
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-2.5 rounded-lg text-xs leading-relaxed ${
              m.role === "user"
                ? "bg-[#007acc]/20 border border-[#007acc]/40 text-blue-100 ml-4"
                : "bg-[#252526] border border-[#333] text-gray-200 mr-2"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.text}</p>

            {m.code && (
              <div className="mt-2 pt-2 border-t border-[#333]">
                <div className="flex items-center justify-between mb-1 text-[10px] text-gray-400 font-mono">
                  <span>Suggested Code:</span>
                  <button
                    onClick={() => onApplyCodeSnippet(m.code!)}
                    className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Insert in Editor
                  </button>
                </div>
                <pre className="p-2 bg-[#181818] rounded overflow-x-auto text-[11px] font-mono text-emerald-300">
                  {m.code}
                </pre>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-2 text-gray-400 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>AI Reasoning & synthesizing solution…</span>
          </div>
        )}
      </div>

      {/* Prompt Form */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-[#2d2d2d] bg-[#252526] flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI (e.g. explain obstacle collision logic)..."
          disabled={loading}
          className="flex-1 bg-[#181818] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#007acc]"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="p-1.5 bg-[#007acc] hover:bg-[#0062a3] text-white rounded font-bold disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
