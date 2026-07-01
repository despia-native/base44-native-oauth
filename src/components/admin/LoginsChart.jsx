import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { BarChart3 } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// Groups accounts by the DAY of their most recent login (last_login_at).
// Note: last_login_at only stores the latest login per account, so this shows
// the distribution of most-recent logins across days — not full login history.
export default function LoginsChart({ accounts }) {
  const data = useMemo(() => {
    const counts = {}
    accounts.forEach((a) => {
      if (!a.last_login_at) return
      try {
        const day = format(parseISO(a.last_login_at), 'yyyy-MM-dd')
        counts[day] = (counts[day] || 0) + 1
      } catch { /* skip invalid dates */ }
    })
    return Object.keys(counts)
      .sort()
      .map((day) => ({ day, label: format(parseISO(day), 'MMM d'), logins: counts[day] }))
  }, [accounts])

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Logins per day</h2>
      </div>

      {data.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">No login activity yet.</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="logins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}