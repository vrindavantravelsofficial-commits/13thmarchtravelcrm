function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatInlineToHtml(str = '') {
  return escapeHtml(str)
    // **text** => <strong>text</strong>
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // *Text* => <strong>Text</strong> (avoid bullet markers by requiring letters)
    .replace(/\*([A-Za-z][^*\-\n]+?)\*/g, '<strong>$1</strong>')
}

export function formatInlineToWhatsApp(str = '') {
  return String(str)
    .replace(/\r/g, '')
    // **text** => *text* (WhatsApp bold)
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .trim()
}

function splitDashSections(str = '') {
  return String(str)
    .replace(/\r/g, '')
    // Split on explicit " - " separators or line breaks.
    // Keep hyphenated words (e.g. pick-up) intact by requiring surrounding whitespace.
    .split(/\n+|\s+-\s+/)
    .map(s => s.trim())
    .filter(s => s && s !== '-' && s !== '–' && s !== '—')
}

function parseStarBullets(str = '') {
  if (!/\*\s+\S/.test(str)) return null
  const parts = str
    .split(/\*\s+/)
    .map(s => s.replace(/[\*\s]+$/g, '').replace(/\n/g, ' ').trim())
    .filter(s => s && s !== '-' && s !== '–' && s !== '—')
  return parts.length ? parts : null
}

export function parseRichTextToBulletTree(text = '') {
  const sections = splitDashSections(text)
  const nodes = []
  let lastNode = null

  for (const section of sections) {
    const bulletItems = parseStarBullets(section)
    if (bulletItems) {
      if (lastNode) {
        lastNode.children.push(...bulletItems)
      } else {
        for (const item of bulletItems) nodes.push({ text: item, children: [] })
      }
      continue
    }

    const cleaned = section.replace(/^-+\s*/, '').trim()
    if (!cleaned || cleaned === '-' || cleaned === '–' || cleaned === '—') continue
    const node = { text: cleaned, children: [] }
    nodes.push(node)
    lastNode = node
  }

  return nodes
}

export function formatRichTextToHtml(text = '') {
  const nodes = parseRichTextToBulletTree(text)
  if (!nodes.length) return ''

  const renderChildren = (children) => {
    if (!children?.length) return ''
    return `<ul class="rt-bullets">${children.map(c => `<li>${formatInlineToHtml(c)}</li>`).join('')}</ul>`
  }

  return `<div class="rt-block">${nodes
    .map(n => `<div class="rt-line">${formatInlineToHtml(n.text)}</div>${renderChildren(n.children)}`)
    .join('')}</div>`
}

export function formatRichTextToWhatsAppLines(text = '', { baseIndent = '', bullet = '•' } = {}) {
  const nodes = parseRichTextToBulletTree(text)
  if (!nodes.length) return []

  const lines = []
  for (const node of nodes) {
    lines.push(`${baseIndent}${formatInlineToWhatsApp(node.text)}`)
    for (const child of node.children) {
      lines.push(`${baseIndent}${bullet} ${formatInlineToWhatsApp(child)}`)
    }
  }
  return lines
}

export function splitActivityTitleAndDetails(name = '', description = '') {
  const desc = (description || '').trim()
  const nm = (name || '').trim()
  if (desc) return { title: nm, details: desc }

  const splitIdx = nm.indexOf(' - ')
  if (splitIdx === -1) return { title: nm, details: '' }

  const title = nm.slice(0, splitIdx).trim()
  const rest = nm.slice(splitIdx + 3).trim()
  const looksStructured = rest.includes('**') || /\*\s+\S/.test(rest) || rest.includes('\n')

  if (!rest || !looksStructured) return { title: nm, details: '' }
  return { title, details: rest }
}
