import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ChevronLeft, Loader2, Download } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import * as adminApi from '@/lib/adminUsers'
import UserRow from '@/components/admin/UserRow'
import LoginsChart from '@/components/admin/LoginsChart'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function AdminUsers() {
  const { user, isLoadingAuth } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = async () => {
    setLoading(true)
    const list = await adminApi.listAccounts()
    setAccounts(list)
    setLoading(false)
  }

  useEffect(() => {
    if (user?.role === 'admin') load()
  }, [user])

  if (isLoadingAuth) return null
  if (user?.role !== 'admin') return <Navigate to="/" replace />

  const handleToggleRole = async (account) => {
    setBusyId(account.id)
    await adminApi.setAccountRole(account.id, account.role === 'admin' ? 'user' : 'admin')
    await load()
    setBusyId(null)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setBusyId(confirmDelete.id)
    await adminApi.deleteAccount(confirmDelete.id)
    setConfirmDelete(null)
    await load()
    setBusyId(null)
  }

  const handleExport = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const headers = ['Full name', 'Email', 'Role', 'Email verified', 'Last login']
    const rows = accounts.map((a) => [
      esc(a.full_name), esc(a.email), esc(a.role),
      esc(a.email_verified ? 'yes' : 'no'), esc(a.last_login_at || ''),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-muted/40">
      {/* Top bar */}
      <header className="shrink-0 pt-safe-top bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="h-11 grid grid-cols-[1fr_auto_1fr] items-center px-2">
          <Link to="/" className="flex items-center text-primary text-[17px] active:opacity-60 justify-self-start">
            <ChevronLeft className="w-6 h-6 -ml-1" /> Back
          </Link>
          <h1 className="text-[17px] font-semibold text-foreground">Users</h1>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || accounts.length === 0}
            className="justify-self-end p-2 text-primary active:opacity-60 disabled:opacity-40"
            aria-label="Export CSV"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="scroll-container px-4 pb-safe-bottom">
        <p className="px-1 pt-5 pb-3 text-[13px] text-muted-foreground">
          {accounts.length} account{accounts.length === 1 ? '' : 's'}
        </p>

        {!loading && <LoginsChart accounts={accounts} />}

        <div className="rounded-xl bg-card border border-border/60 overflow-hidden shadow-sm mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-[15px] text-muted-foreground py-16">No accounts yet.</p>
          ) : (
            accounts.map((a) => (
              <UserRow
                key={a.id}
                account={a}
                isSelf={a.id === user.id}
                busy={busyId === a.id}
                onToggleRole={handleToggleRole}
                onDelete={setConfirmDelete}
              />
            ))
          )}
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}