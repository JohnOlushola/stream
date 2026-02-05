import { createRecognizer, plugins } from 'streamsense'

const input = document.getElementById('input')
const backdrop = document.getElementById('backdrop')

let entities = {}

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

recognizer.on('entity', (e) => {
  entities[e.entity.id] = e.entity
  render()
})

recognizer.on('remove', (e) => {
  delete entities[e.id]
  render()
})

function render() {
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

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

input.addEventListener('input', () => {
  recognizer.feed({
    text: input.value,
    cursor: input.selectionStart,
  })
})

input.addEventListener('scroll', () => {
  backdrop.scrollTop = input.scrollTop
})

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    recognizer.commit('enter')
  }
})

window.addEventListener('beforeunload', () => recognizer.destroy())
