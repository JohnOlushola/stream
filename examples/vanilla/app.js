import { createRecognizer, plugins } from 'streamsense'

// DOM Elements
const input = document.getElementById('input')
const commitBtn = document.getElementById('commit-btn')
const clearBtn = document.getElementById('clear-btn')
const entitiesEl = document.getElementById('entities')
const eventsEl = document.getElementById('events')
const highlightedEl = document.getElementById('highlighted')

// State
let entities = {}
let eventLog = []
const MAX_EVENTS = 50

// Create recognizer with all plugins
const recognizer = createRecognizer({
  plugins: [
    plugins.quantity(),
    plugins.email(),
    plugins.datetime(),
    plugins.url(),
    plugins.phone(),
  ],
  schedule: {
    realtimeMs: 150,
    commitAfterMs: 800,
  },
})

// Event handlers
recognizer.on('entity', (event) => {
  entities[event.entity.id] = event.entity
  logEvent('entity', event.isUpdate ? 'update' : 'add', event.entity.text)
  render()
})

recognizer.on('remove', (event) => {
  const entity = entities[event.id]
  if (entity) {
    logEvent('remove', 'remove', entity.text)
    delete entities[event.id]
    render()
  }
})

recognizer.on('diagnostic', (event) => {
  logEvent('diagnostic', event.severity, event.message)
})

// Helper functions
function logEvent(type, action, detail) {
  const timestamp = new Date().toLocaleTimeString()
  eventLog.unshift({ type, action, detail, timestamp })
  if (eventLog.length > MAX_EVENTS) {
    eventLog.pop()
  }
  renderEvents()
}

function render() {
  renderEntities()
  renderHighlighted()
}

function renderEntities() {
  const entityList = Object.values(entities)
  
  if (entityList.length === 0) {
    entitiesEl.innerHTML = '<p class="empty-state">Start typing to detect entities...</p>'
    return
  }

  // Sort by position
  entityList.sort((a, b) => a.span.start - b.span.start)

  entitiesEl.innerHTML = entityList.map(entity => `
    <div class="entity-item">
      <span class="entity-badge ${entity.kind}">${entity.kind}</span>
      <div class="entity-content">
        <div class="entity-text">${escapeHtml(entity.text)}</div>
        <div class="entity-meta">
          ${formatValue(entity.value)}
          <span class="entity-status ${entity.status}">${entity.status}</span>
          <span style="opacity: 0.6">${Math.round(entity.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  `).join('')
}

function renderEvents() {
  eventsEl.innerHTML = eventLog.map(event => `
    <div class="event-item">
      <span class="event-type ${event.type}">[${event.type}]</span>
      <span>${event.action}</span>
      <span style="opacity: 0.7">${escapeHtml(event.detail)}</span>
      <span style="opacity: 0.5; float: right">${event.timestamp}</span>
    </div>
  `).join('')
}

function renderHighlighted() {
  const text = input.value
  if (!text) {
    highlightedEl.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">Highlighted text will appear here...</span>'
    return
  }

  const entityList = Object.values(entities)
  if (entityList.length === 0) {
    highlightedEl.textContent = text
    return
  }

  // Sort entities by start position
  entityList.sort((a, b) => a.span.start - b.span.start)

  // Build highlighted HTML
  let html = ''
  let lastIndex = 0

  for (const entity of entityList) {
    // Add text before this entity
    if (entity.span.start > lastIndex) {
      html += escapeHtml(text.slice(lastIndex, entity.span.start))
    }

    // Add highlighted entity
    html += `<span class="highlight ${entity.kind}" title="${entity.kind}: ${escapeHtml(JSON.stringify(entity.value))}">${escapeHtml(entity.text)}</span>`
    lastIndex = entity.span.end
  }

  // Add remaining text
  if (lastIndex < text.length) {
    html += escapeHtml(text.slice(lastIndex))
  }

  highlightedEl.innerHTML = html
}

function formatValue(value) {
  if (typeof value !== 'object' || value === null) {
    return String(value)
  }
  
  // Format based on common value shapes
  if ('amount' in value && 'unit' in value) {
    return `${value.amount} ${value.unit}`
  }
  if ('email' in value) {
    return value.email
  }
  if ('url' in value) {
    return value.domain
  }
  if ('phone' in value) {
    return value.digits
  }
  if ('type' in value) {
    return value.type
  }
  
  return JSON.stringify(value)
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Input handlers
input.addEventListener('input', () => {
  recognizer.feed({
    text: input.value,
    cursor: input.selectionStart,
  })
})

input.addEventListener('compositionstart', () => {
  recognizer.feed({
    text: input.value,
    cursor: input.selectionStart,
    meta: { composing: true },
  })
})

input.addEventListener('compositionend', () => {
  recognizer.feed({
    text: input.value,
    cursor: input.selectionStart,
    meta: { composing: false },
  })
})

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    recognizer.commit('enter')
  }
})

// Button handlers
commitBtn.addEventListener('click', () => {
  recognizer.commit('manual')
})

clearBtn.addEventListener('click', () => {
  input.value = ''
  entities = {}
  eventLog = []
  recognizer.feed({ text: '', cursor: 0 })
  render()
  renderEvents()
})

// Initial render
render()
renderEvents()

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  recognizer.destroy()
})
