import { createClient } from '@supabase/supabase-js'

// Skopiuj te wartości z zakładki Settings -> API w Supabase
const supabaseUrl = 'https://qctgoydersafhxjowmoz.supabase.co'
const supabaseKey = 'sb_publishable_UvBwkJxMiA-Q_o5d3dQ1yw_-HZdKl63'

export const supabase = createClient(supabaseUrl, supabaseKey)