import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import F7Icon from '@/components/F7Icon'
import { useAuth } from '@/lib/AuthContext'
import { invokeAuth } from '@/lib/customAuth'
import PushComposer from '@/components/admin/PushComposer'

// Admin push dashboard: broadcast to everyone or look up a user and push to them.
export default function AdminPush() {
  const { user, authChecked } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [mode, setMode] = useState('all') // 'all' | 'user'
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (authChecked && user?.role !== 'admin') navigate('/')
  }, [authChecked, user, navigate])

  useEffect(() => {
    invokeAuth('adminUsers', { action: 'list' }).then((d) => setAccounts(d.accounts || [])).catch(() => {})
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? accounts.filter((a) => (a.email || '').toLowerCase().includes(q) || (a.full_name || '').toLowerCase().includes(q))
    : accounts

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="scroll-container flex flex-col px-5 pt-safe-top pb-safe-bottom">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center text-primary text-[17px] active:opacity-60 self-start mt-4 -ml-1"
        >
          <F7Icon name="chevron_left" size={22} /> Back
        </button>

        <div className="w-full max-w-sm md:max-w-md mx-auto flex flex-col pt-4 pb-16">
          <h1 className="text-[26px] font-bold tracking-tight text-foreground mb-6">Push Notifications</h1>

          {/* Target picker */}
          <div className="flex gap-2 mb-5">
            {[['all', 'All users'], ['user', 'One user']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 h-11 rounded-full text-[14px] font-semibold transition-colors ${
                  mode === value ? 'ember-primary' : 'ember-glass ember-press text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* User lookup */}
          {mode === 'user' && (
            <div className="mb-5">
              <input
                type="text"
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ember-input mb-3"
              />
              <div className="rounded-3xl ember-card overflow-hidden max-h-72 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="p-4 text-[14px] text-muted-foreground">No users found.</p>
                )}
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelected(a)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">{a.full_name || 'No name'}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{a.email}</p>
                    </div>
                    {selected?.id === a.id && <F7Icon name="checkmark" size={18} className="text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(mode === 'all' || selected) ? (
            <PushComposer target={mode === 'all' ? 'all' : selected} />
          ) : (
            <p className="text-[14px] text-muted-foreground px-1">Select a user to send them a push.</p>
          )}
        </div>
      </div>
    </div>
  )
}