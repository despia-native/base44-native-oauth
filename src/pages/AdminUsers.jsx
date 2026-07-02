import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ChevronLeft, Loader2, Download } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import GlassHeader from '@/components/mobile/GlassHeader'
import AmbientBackground from '@/components/mobile/AmbientBackground'
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
    <div className="relative flex flex-col h-full bg-muted/40 overflow-hidden">
      <AmbientBackground />
      <GlassHeader
        title="Users"
        left={
          <Link to="/" className="flex items-center text-primary text-[17px] active:opacity-60 pl-1">
            <ChevronLeft className="w-6 h-6 -ml-1" /> Back
          </Link>
        }
        right={
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || accounts.length === 0}
            className="p-2 text-primary active:opacity-60 disabled:opacity-40"
            aria-label="Export CSV"
          >
            <Download className="w-5 h-5" />
          </button>
        }
      />

      <div className="scroll-container relative px-5 pb-safe-bottom" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 72px)' }}>
        <p className="px-1 pt-2 pb-3 text-[13px] text-muted-foreground">
          {accounts.length} account{accounts.length === 1 ? '' : 's'}
        </p>

        {!loading && <LoginsChart accounts={accounts} />}

        <div className="rounded-2xl glass-card overflow-hidden mb-6">
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
        <AlertDialogContent className="rounded-3xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}