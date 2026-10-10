'use client'

import React from 'react'

/**
 * Minimal renderer for the AI explanation's shape: `## heading`, `- bullet`,
 * and `**bold**`. Deliberately NOT a markdown library — the prompt fixes the
 * format, and model text is untrusted, so this renders plain strings only and
 * can never emit HTML.
 */
function bold(text: string, key: number): React.ReactNode {
  // Split on **…** and bold the odd segments.
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: 'var(--text)' }}>{p}</strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </React.Fragment>
  )
}

export function AiExplainText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []

  const flush = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul
        key={`ul${blocks.length}`}
        style={{ margin: '0 0 10px', paddingInlineStart: 18, fontSize: 13, lineHeight: 1.85, color: 'var(--text-2)' }}
      >
        {bullets.map((b, i) => (
          <li key={i}>{bold(b, i)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const raw of text.split('\n')) {
    const l = raw.trim()
    if (!l) continue
    if (l.startsWith('#')) {
      flush()
      blocks.push(
        <div
          key={`h${blocks.length}`}
          style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: '12px 0 5px' }}
        >
          {l.replace(/^#+\s*/, '')}
        </div>,
      )
    } else if (l.startsWith('-') || l.startsWith('•')) {
      bullets.push(l.replace(/^[-•]\s*/, ''))
    } else {
      flush()
      blocks.push(
        <p key={`p${blocks.length}`} style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)' }}>
          {bold(l, 0)}
        </p>,
      )
    }
  }
  flush()
  return <div>{blocks}</div>
}
