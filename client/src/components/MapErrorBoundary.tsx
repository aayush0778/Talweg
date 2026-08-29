import { Component, ErrorInfo, ReactNode } from 'react';

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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[MapErrorBoundary] WebGL / MapLibre Error caught:', error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-slate-300">
          <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-600/60 flex items-center justify-center text-amber-400 font-bold text-xl mb-4">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">GIS Map Initialization Notice</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            WebGL map rendering encountered an issue or is disabled in your browser environment. Risk zone telemetry and
            decision-support panels remain fully operational on the right.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition cursor-pointer"
          >
            Attempt Map Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
