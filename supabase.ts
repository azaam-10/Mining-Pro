
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srvmrtnvlduiybtjcica.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNydm1ydG52bGR1aXlidGpjaWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNDYyNjIsImV4cCI6MjA4MTYyMjI2Mn0.ADlgBDrQm2e0EhXClAIm6kDD2T5gB6u5D7M_chVQ_KY';

export const supabase = createClient(supabaseUrl, supabaseKey);
