// Test script to verify Slack OAuth configuration
// Run this in browser console at http://localhost:5179

import { supabase } from './src/supabaseClient.js';

async function testSlackOAuth() {
  console.log('Testing Slack OAuth...');

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'slack',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error('OAuth Error:', error);
      return;
    }

    console.log('OAuth initiated successfully:', data);
  } catch (err) {
    console.error('Exception:', err);
  }
}

// Call the test
testSlackOAuth();