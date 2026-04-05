import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

function BrokenComponent(): JSX.Element {
  throw new Error('Componente quebrou')
}

function WorkingComponent() {
  return <div>Conteúdo funcionando</div>
}

describe('ErrorBoundary', () => {
  // Suprimir console.error do React para erros esperados nos testes
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it('deve renderizar children quando não há erro', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Conteúdo funcionando')).toBeInTheDocument()
  })

  it('deve mostrar fallback padrão quando filho lança erro', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
  })

  it('deve mostrar fallback customizado quando fornecido', () => {
    render(
      <ErrorBoundary fallback={<div>Erro customizado</div>}>
        <BrokenComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Erro customizado')).toBeInTheDocument()
  })

  it('deve chamar onError quando erro é capturado', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <BrokenComponent />
      </ErrorBoundary>
    )
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('deve resetar ao clicar em "Tentar novamente"', () => {
    let shouldThrow = true

    function ConditionallyBroken() {
      if (shouldThrow) throw new Error('Erro condicional')
      return <div>Recuperado com sucesso</div>
    }

    render(
      <ErrorBoundary>
        <ConditionallyBroken />
      </ErrorBoundary>
    )

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()

    // Corrigir a condição antes de resetar
    shouldThrow = false
    fireEvent.click(screen.getByText('Tentar novamente'))

    expect(screen.getByText('Recuperado com sucesso')).toBeInTheDocument()
  })

  it('deve mostrar detalhes do erro quando expandido', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )

    const details = screen.getByText('Detalhes do erro')
    expect(details).toBeInTheDocument()
    fireEvent.click(details)
    expect(screen.getByText('Componente quebrou')).toBeInTheDocument()
  })
})
