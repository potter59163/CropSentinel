import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error('[CS] view error:', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ borderColor: 'var(--risk)' }}>
          <div className="thai" style={{ color: 'var(--risk)', fontWeight: 700, marginBottom: 6 }}>
            เกิดข้อผิดพลาดในการแสดงผลส่วนนี้
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{this.state.error.message}</div>
          <button className="btn thai" style={{ marginTop: 12 }} onClick={() => this.setState({ error: null })}>
            ลองใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
