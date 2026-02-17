import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('renders main editor and sidebar', () => {
    render(<App />)
    expect(document.querySelector('main')).toBeInTheDocument()
    expect(document.querySelector('aside')).toBeInTheDocument()
  })

  it('shows Settings with Regex / LLM / All toggle when sidebar is open', () => {
    render(<App />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /regex only/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /llm only/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^all$/i })).toBeInTheDocument()
  })

  it('shows Metrics when sidebar is open', () => {
    render(<App />)
    expect(screen.getByText('Metrics')).toBeInTheDocument()
    expect(screen.getByText('Characters')).toBeInTheDocument()
    expect(screen.getByText('Entities')).toBeInTheDocument()
  })

  it('can change recognizer mode via toggle', async () => {
    const user = userEvent.setup()
    render(<App />)
    const llmRadio = screen.getByRole('radio', { name: /llm only/i })
    await user.click(llmRadio)
    expect(screen.getByText(/LLM on pause\/Enter/)).toBeInTheDocument()
  })

  it('can collapse and expand sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i })
    await user.click(collapseButton)
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    const expandButton = screen.getByRole('button', { name: /expand sidebar/i })
    await user.click(expandButton)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })
})
