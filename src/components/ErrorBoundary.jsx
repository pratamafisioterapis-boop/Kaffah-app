import React from 'react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("CRITICAL APP ERROR:", error, errorInfo);
    this.setState({ errorInfo });

    // Stale JS chunk after a new deploy: the currently open tab still
    // references old hashed filenames that no longer exist on the server.
    // Reload once (sessionStorage guard prevents a reload loop) instead of
    // showing the error screen.
    const isStaleChunkError = /dynamically imported module|loading chunk .* failed|failed to fetch dynamically/i.test(error?.message || '');
    if (isStaleChunkError && !sessionStorage.getItem('stale-chunk-reloaded')) {
      sessionStorage.setItem('stale-chunk-reloaded', '1');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-red-50 p-6 z-50 fixed inset-0">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-red-500">
            <div className="bg-red-600 px-6 py-4">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Application Error
              </h1>
            </div>
            
            <div className="p-6">
              <p className="text-slate-700 font-medium mb-4">
                Something went wrong while rendering this page.
              </p>
              
              <div className="bg-slate-900 rounded-lg p-4 mb-6 overflow-auto max-h-64 shadow-inner">
                <p className="text-red-400 font-mono text-sm font-bold mb-2">
                  {this.state.error && this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-slate-400 font-mono text-xs whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
              
              <div className="flex gap-4">
                <Button 
                  onClick={() => window.location.reload()} 
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Reload Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="border-slate-300 hover:bg-slate-50"
                >
                  Go to Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;