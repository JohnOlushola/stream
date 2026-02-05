import { createRecognizer, plugins } from 'streamsense'

// DOM Elements
const input = document.getElementById('input')
const backdrop = document.getElementById('backdrop')
const entitiesList = document.getElementById('entities-list')
const eventsList = document.getElementById('events-list')
const metricChars = document.getElementById('metric-chars')
const metricEntities = document.getElementById('metric-entities')
const metricConfirmed = document.getElementById('metric-confirmed')
const metricEvents = document.getElementById('metric-events')

// State
let entities = {}
let events = []
let eventCount = 0

// Create recognizer
const recognizer = createRecognizer({
  plugins: [
    plugins.quantity(),
    plugins.email(),
    plugins.datetime(),
    plugins.url(),
    plugins.phone(),
  ],
  schedule: {
    realtimeMs: 100,
    commitAfterMs: 600,
  },
})

// Event handlers
recognizer.on('entity', (e) => {
  entities[e.entity.id] = e.entity
  logEvent('entity', e.isUpdate ? 'update' : 'add', e.entity)
  render()
})

recognizer.on('remove', (e) => {
  const entity = entities[e.id]
  delete entities[e.id]
  logEvent('remove', 'remove', entity)
  render()
})

recognizer.on('diagnostic', (e) => {
  if (e.severity !== 'info') {
    logEvent('diagnostic', e.severity, { message: e.message })
  }
})

function logEvent(type, action, data) {
  eventCount++
  const time = new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 2
  })
  
  events.unshift({ type, action, data, time })
  if (events.length > 100) events.pop()
  
  renderEvents()
  updateMetrics()
}

function render() {
  renderHighlights()
  renderEntities()
  updateMetrics()
}

function renderHighlights() {
  const text = input.value
  if (!text) {
    backdrop.innerHTML = ''
    return
  }

  const entityList = Object.values(entities).sort((a, b) => a.span.start - b.span.start)

  if (entityList.length === 0) {
    backdrop.textContent = text
    return
  }

  let html = ''
  let lastIndex = 0

  for (const entity of entityList) {
    if (entity.span.start > lastIndex) {
      html += escapeHtml(text.slice(lastIndex, entity.span.start))
    }
    html += `<span class="highlight ${entity.kind}">${escapeHtml(entity.text)}</span>`
    lastIndex = entity.span.end
  }

  if (lastIndex < text.length) {
    html += escapeHtml(text.slice(lastIndex))
  }

  backdrop.innerHTML = html
}

function renderEntities() {
  const entityList = Object.values(entities).sort((a, b) => a.span.start - b.span.start)

  if (entityList.length === 0) {
    entitiesList.innerHTML = '<p class="empty">No entities detected</p>'
    return
  }

  entitiesList.innerHTML = entityList.map(entity => `
    <div class="entity-item">
      <span class="entity-kind ${entity.kind}">${entity.kind}</span>
      <span class="entity-text">${escapeHtml(entity.text)}</span>
      <span class="entity-confidence">${Math.round(entity.confidence * 100)}%</span>
    </div>
  `).join('')
}

function renderEvents() {
  eventsList.innerHTML = events.map(event => {
    let detail = ''
    if (event.data) {
      if (event.data.text) {
        detail = event.data.text
      } else if (event.data.message) {
        detail = event.data.message
      }
    }

    return `
      <div class="event-item">
        <span class="event-time">${event.time}</span>
        <span class="event-type ${event.type}">${event.action}</span>
        <span class="event-detail">${escapeHtml(detail)}</span>
      </div>
    `
  }).join('')
}

function updateMetrics() {
  const entityList = Object.values(entities)
  metricChars.textContent = input.value.length
  metricEntities.textContent = entityList.length
  metricConfirmed.textContent = entityList.filter(e => e.status === 'confirmed').length
  metricEvents.textContent = eventCount
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
  updateMetrics()
})

input.addEventListener('scroll', () => {
  backdrop.scrollTop = input.scrollTop
})

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    recognizer.commit('enter')
  }
})

// Initial render
render()

window.addEventListener('beforeunload', () => recognizer.destroy())
