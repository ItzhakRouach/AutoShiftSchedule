'use client'

import React from 'react'
import { Icon, type IconName } from './Icon'

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

interface BtnProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: BtnVariant
  size?: BtnSize
  icon?: IconName
  style?: React.CSSProperties
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  style,
  disabled,
  type = 'button',
}: BtnProps) {
  const sizes: Record<BtnSize, { padding: string; fontSize: number; gap: number; h: number }> = {
    sm: { padding: '8px 14px', fontSize: 14, gap: 6, h: 36 },
    md: { padding: '12px 18px', fontSize: 15.5, gap: 8, h: 48 },
    lg: { padding: '15px 22px', fontSize: 17, gap: 9, h: 56 },
  }

  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: '0 4px 14px var(--accent-soft)',
    },
    soft: {
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
      border: '1px solid transparent',
    },
    ghost: {
      background: 'var(--surface-2)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--text)',
      border: '1px solid var(--border-strong)',
    },
    danger: {
      background: 'rgba(220,70,70,0.12)',
      color: '#D8423B',
      border: '1px solid transparent',
    },
  }

  const s = sizes[size]

  return (
    <button
      type={type}
      className="btn"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        minHeight: s.h,
        fontFamily: 'var(--font)',
        fontSize: s.fontSize,
        fontWeight: 600,
        borderRadius: 'var(--r-pill)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform .12s ease, filter .15s ease',
        WebkitTapHighlightColor: 'transparent',
        width: style?.width === '100%' ? '100%' : undefined,
        ...variants[variant],
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 17 : 19} stroke={2} />}
      {children}
    </button>
  )
}
