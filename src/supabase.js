import { createClient } from '@supabase/supabase-js'

const URL = 'https://xqozyklkdejvuzkkyvtb.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxb3p5a2xrZGVqdnV6a2t5dnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NzAyNDEsImV4cCI6MjA5NTI0NjI0MX0.iBEPErVgLVGPbEIbQ7qjDcauMWhvVu7PDQl5dnxboUA'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: (url, options = {}) => {
    const headers = new Headers(options.headers || {})
    headers.set('Accept', 'application/json')
    if (options.method && options.method !== 'GET') {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(url, { ...options, headers })
  }}
})
