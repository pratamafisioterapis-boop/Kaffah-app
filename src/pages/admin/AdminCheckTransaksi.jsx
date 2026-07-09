import React from 'react';

class ErrorCatcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 12, margin: 16 }}>
          <h2 style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 8 }}>❌ Error di AdminCheckTransaksi</h2>
          <pre style={{ color: '#7f1d1d', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const BSIMutasiLazy = React.lazy(() =>
  import('@/pages/owner/BSIMutasiReconciliation').catch(err => {
    return {
      default: () => (
        <div style={{ padding: 24, background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 12, margin: 16 }}>
          <h2 style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 8 }}>❌ Gagal Load Module BSIMutasiReconciliation</h2>
          <pre style={{ color: '#7f1d1d', fontSize: 13, whiteSpace: 'pre-wrap' }}>{err?.toString()}{'\n'}{err?.stack}</pre>
        </div>
      )
    };
  })
);

const AdminCheckTransaksi = () => {
  return (
    <ErrorCatcher>
      <React.Suspense fallback={<div style={{ padding: 24 }}>⏳ Memuat Check Transaksi...</div>}>
        <BSIMutasiLazy readOnly={true} />
      </React.Suspense>
    </ErrorCatcher>
  );
};

export default AdminCheckTransaksi;