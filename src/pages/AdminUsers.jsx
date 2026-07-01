import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ArrowLeft, Users, Loader2 } from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading text-foreground">User management</h1>
            <p className="text-sm text-muted-foreground">{accounts.length} account{accounts.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {!loading && <LoginsChart accounts={accounts} />}

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">No accounts yet.</p>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}