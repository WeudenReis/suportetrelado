import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback) {
      return this.props.fallback
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight: '200px',
        background: '#22272b',
        borderRadius: '12px',
        border: '1px solid rgba(166, 197, 226, 0.16)',
        color: '#b6c2cf',
        textAlign: 'center',
        gap: '1rem',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'rgba(239, 92, 72, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
        }}>
          !
        </div>

        <h3 style={{
          fontFamily: "'Paytone One', sans-serif",
          fontSize: '1.1rem',
          color: '#b6c2cf',
          margin: 0,
        }}>
          Algo deu errado
        </h3>

        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.85rem',
          color: '#596773',
          margin: 0,
          maxWidth: '320px',
        }}>
          Ocorreu um erro inesperado nesta seção. Tente novamente ou recarregue a página.
        </p>

        {this.state.error && (
          <details style={{ fontSize: '0.75rem', color: '#596773', maxWidth: '400px', wordBreak: 'break-word' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Detalhes do erro</summary>
            <code style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</code>
          </details>
        )}

        <button
          onClick={this.handleReset}
          style={{
            padding: '0.5rem 1.25rem',
            background: '#25D066',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1BAD53')}
          onMouseLeave={e => (e.currentTarget.style.background = '#25D066')}
        >
          Tentar novamente
        </button>
      </div>
    )
  }
}
