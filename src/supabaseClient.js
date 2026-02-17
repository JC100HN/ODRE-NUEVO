import { createClient } from '@supabase/supabase-js'

// Reemplaza los textos de abajo con tus datos reales de Supabase
const supabaseUrl = 'https://nulfkhinmiwconfnstal.supabase.co' 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bGZraGlubWl3Y29uZm5zdGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTg0NTUsImV4cCI6MjA4NjgzNDQ1NX0.Y9NOcSRxLJx_i6TmzzGCBSaD9b9CG5A1_QhOUe3CcOg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)