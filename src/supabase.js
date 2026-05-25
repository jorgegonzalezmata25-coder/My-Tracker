import { createClient } from "@supabase/supabase-js"
export const supabase = createClient("https://xqozyklkdejvuzkkyvtb.supabase.co","sb_publishable_wAZckuQTzGYW2FM81SyFBw_RYzoMBnb",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
