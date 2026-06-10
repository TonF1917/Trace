import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui', color: '#333' }}>
          <h1 style={{ color: '#e53e3e' }}>Something went wrong.</h1>
          <p>A fatal error occurred during rendering.</p>
          <div style={{ background: '#f7fafc', padding: '1rem', borderRadius: '8px', marginTop: '1rem', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>{this.state.error && this.state.error.toString()}</h3>
            <pre style={{ margin: 0, fontSize: '0.875rem', color: '#4a5568' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Clear Local Storage & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

