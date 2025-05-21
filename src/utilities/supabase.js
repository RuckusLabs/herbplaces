import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qtpepsebztlremlhpxdt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cGVwc2VienRscmVtbGhweGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5MDM2MjQsImV4cCI6MjA1MjQ3OTYyNH0.VbPZKmqyesdQjiz21UlLnMNun9WepnnECQO9FEKaSLM';
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;