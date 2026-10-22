import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 min-h-[400px]">
          <div className="max-w-xl w-full bg-surface border-2 border-border rounded-tactile shadow-hard p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 border-2 border-amber-500 rounded-tactile text-amber-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-mono font-bold text-foreground">
                  {this.props.fallbackTitle || "Something went wrong in this module"}
                </h2>
                <p className="text-xs text-foreground-muted font-sans leading-relaxed">
                  The application shell trapped an unexpected runtime error. Your navigation, sidebar, and session remain active.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3.5 bg-[#FAF7ED] border border-border rounded font-mono text-xs text-foreground overflow-auto max-h-48 space-y-1">
                <div className="font-bold text-rose-600">{this.state.error.name}: {this.state.error.message}</div>
                {this.state.error.stack && (
                  <pre className="text-[11px] text-foreground-muted whitespace-pre-wrap font-mono mt-2">
                    {this.state.error.stack.split("\n").slice(0, 5).join("\n")}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono font-bold text-xs rounded-tactile border-2 border-border shadow-hard-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Module
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-muted font-mono font-medium text-xs rounded-tactile border-2 border-border shadow-hard-sm transition-all"
              >
                Reload Window
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-muted font-mono font-medium text-xs rounded-tactile border-2 border-border shadow-hard-sm transition-all text-foreground ml-auto"
              >
                <Home className="w-3.5 h-3.5" />
                Return to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
