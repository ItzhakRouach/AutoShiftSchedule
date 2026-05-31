import React from 'react'

interface AvatarProps {
  name: string
  color: string
  size?: number
  ring?: boolean
}

export function Avatar({ name, color, size = 40, ring }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        flexShrink: 0,
        background: color,
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: ring
          ? `0 0 0 3px var(--surface), 0 0 0 ${size > 50 ? 5 : 4}px ${color}`
          : 'none',
        letterSpacing: '-0.5px',
      }}
    >
      {initials}
    </div>
  )
}
