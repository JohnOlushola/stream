import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { StreamEditor } from './StreamEditor'

describe('StreamEditor', () => {
  const noop = () => {}

  it('renders a container with stream-editor class', () => {
    const { container } = render(
      <StreamEditor
        onFeed={noop}
        entities={[]}
        className="test-editor"
      />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.classList.contains('stream-editor')).toBe(true)
    expect(wrapper.classList.contains('test-editor')).toBe(true)
  })

  it('calls onFeed with initial text after mount', () => {
    const onFeed = vi.fn()
    render(
      <StreamEditor
        initialText="hello"
        onFeed={onFeed}
        entities={[]}
      />
    )
    expect(onFeed).toHaveBeenCalled()
    expect(onFeed.mock.calls[0][0]).toMatchObject({ text: 'hello' })
  })
})
