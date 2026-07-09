'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Icon, type IconName } from '@/components/ui/Icon'
import type { ScheduleView } from '@/lib/schedule/view-data'

interface Setup {
  icon: IconName
  title: string
  text: string
  href: string
  cta: string
}

/** What's actually missing before a schedule can be built, in setup order. */
function missingSetup(view: ScheduleView): Setup | null {
  if (view.employees.length === 0) {
    return { icon: 'users', title: 'אין עדיין עובדים', text: 'כדי לבנות סידור צריך קודם להוסיף את העובדים ולשייך תפקידים.', href: '/team', cta: 'להוספת עובדים' }
  }
  if (view.roles.length === 0) {
    return { icon: 'shield', title: 'אין תפקידים מוגדרים', text: 'הגדירו את התפקידים (אחמ״ש, מוקדן, מאבטח…) כדי שהמנוע ידע את מי לשבץ.', href: '/settings', cta: 'להגדרות' }
  }
  const hasRequirement = Object.values(view.requirements).some((day) =>
    Object.values(day).some((byRole) => Object.values(byRole).some((c) => c > 0)),
  )
  if (!hasRequirement) {
    return { icon: 'grid', title: 'אין דרישות איוש', text: 'קבעו כמה עובדים נדרשים בכל משמרת ותפקיד — זה הבסיס לסידור האוטומטי.', href: '/settings', cta: 'לקביעת דרישות' }
  }
  return null
}

/** Pre-schedule guidance: deep-links to the exact missing setup step, else the
 *  generic "build it" hint. Split out of ScheduleClient (≤200-line rule). */
export function EmptyStateCard({ view }: { view: ScheduleView }) {
  const setup = missingSetup(view)
  return (
    <Card style={{ textAlign: 'center', padding: '24px 20px', marginBottom: 14 }}>
      {setup ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <span style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <Icon name={setup.icon} size={22} stroke={2} />
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{setup.title}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>{setup.text}</div>
          <Link href={setup.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '9px 18px', borderRadius: 'var(--r-pill)', background: 'var(--accent)', color: 'var(--accent-ink, #fff)', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
            {setup.cta} <Icon name="chevronLeft" size={15} />
          </Link>
        </>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>בונים את הסידור עבורכם</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
            צרו סידור אוטומטי לפי הבקשות והתפקידים — או בנו אותו ידנית בטבלה למטה, תא אחר תא.
          </div>
        </>
      )}
    </Card>
  )
}
