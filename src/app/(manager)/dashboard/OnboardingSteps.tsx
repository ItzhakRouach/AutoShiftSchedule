import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Icon, type IconName } from '@/components/ui/Icon'

const STEPS: { href: string; icon: IconName; title: string; subtitle: string }[] = [
  { href: '/team', icon: 'users', title: 'הוספת עובדים', subtitle: 'הזמינו את הצוות בקישור ווטסאפ' },
  { href: '/settings', icon: 'settings', title: 'הגדרת תפקידים ומשמרות', subtitle: 'תפקידים, משמרות ודרישות איוש' },
  { href: '/schedule', icon: 'calendar', title: 'יצירת הסידור הראשון', subtitle: 'שיבוץ אוטומטי ופרסום' },
]

/** First-run guidance shown on the dashboard when there are no active
 *  employees yet — three clickable steps to get a workplace going. */
export function OnboardingSteps() {
  return (
    <Card style={{ padding: '20px 18px' }}>
      <div style={{ fontSize: 'var(--text-h3)', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
        ברוכים הבאים 👋 בואו נתחיל
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
        שלושה צעדים קצרים כדי ליצור את הסידור הראשון שלכם.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STEPS.map((s, i) => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <Card
              interactive
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', background: 'var(--surface-2)' }}
            >
              <div
                style={{
                  width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
                  background: 'var(--accent)', color: 'var(--accent-ink)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>{s.subtitle}</div>
              </div>
              <Icon name={s.icon} size={20} stroke={1.9} color="var(--accent)" />
              <Icon name="chevronLeft" size={17} color="var(--text-3)" />
            </Card>
          </Link>
        ))}
      </div>
    </Card>
  )
}
