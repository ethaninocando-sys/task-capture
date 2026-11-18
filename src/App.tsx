import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Login } from './components/Login'
import { PopupCapture } from './components/PopupCapture'
import { SetNewPassword } from './components/SetNewPassword'
import { TaskBoard } from './components/TaskBoard'
import { isPopup } from './lib/native'
import { isConfigured, openedFromResetLink, supabase } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(openedFromResetLink)

  useEffect(() => {
    if (!isConfigured) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setResettingPassword(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <h1 className="text-xl font-semibold">Almost there</h1>
        <p className="mt-2 text-sm text-muted">
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase URL and publishable key,
          then restart <code>npm run dev</code>.
        </p>
      </main>
    )
  }

  if (!ready) return null
  if (session && resettingPassword) return <SetNewPassword onDone={() => setResettingPassword(false)} />
  if (!session) return <Login />
  return isPopup ? <PopupCapture /> : <TaskBoard />
}
