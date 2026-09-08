import { Component, ErrorInfo, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MapErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Log without polluting console
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 bg-ink-950 flex flex-col items-center justify-center p-8 text-center text-paper-200">
          <div className="w-12 h-12 rounded-full bg-silt-900/60 border border-silt-600 flex items-center justify-center text-silt-300 mb-4">
            <TriangleAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-paper-50 mb-2">
            GIS Renderer Initialization Notice
          </h2>
          <p className="text-xs text-paper-300 max-w-md mb-6 leading-relaxed">
            WebGL map rendering encountered a context issue or is disabled in your browser environment. Corridor telemetry and
            decision-support panels remain fully operational.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-xs font-semibold bg-lichen-500 hover:bg-lichen-400 text-ink-950 rounded transition cursor-pointer"
          >
            Attempt Map Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
