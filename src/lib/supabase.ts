import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Your project's address, e.g. https://xxxx.supabase.co */
export const supabaseUrl = (url ?? '').replace(/\/$/, '')

/** False until .env.local has both values filled in. */
export const isConfigured = Boolean(url && key)

/**
 * True when the page was opened from a "reset your password" email link.
 * Read before the Supabase client starts, because it clears the link details from the address bar.
 */
export const openedFromResetLink = window.location.hash.includes('type=recovery')

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
})
