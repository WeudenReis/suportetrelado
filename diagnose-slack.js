// Diagnostic script for Slack OAuth
// Run this in browser console at http://localhost:5179

async function diagnoseSlackOAuth() {
  console.log('🔍 Diagnóstico Slack OAuth');
  console.log('========================');

  // 1. Check Supabase connection
  console.log('1. Testando conexão Supabase...');
  try {
    const { data, error } = await fetch('https://qacrxpfoamarslxskcyb.supabase.co/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhY3J4cGZvYW1hcnNseHNrY3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0NDksImV4cCI6MjA5MDEyMTQ0OX0.GSp8g-IdFeOcX14wE4le27MRvwjw4jQB8dqgTe6OrBM',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhY3J4cGZvYW1hcnNseHNrY3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0NDksImV4cCI6MjA5MDEyMTQ0OX0.GSp8g-IdFeOcX14wE4le27MRvwjw4jQB8dqgTe6OrBM'
      }
    });
    console.log('✅ Supabase conectado');
  } catch (e) {
    console.error('❌ Erro Supabase:', e);
  }

  // 2. Test Slack OAuth endpoint
  console.log('2. Testando endpoint Slack OAuth...');
  try {
    const response = await fetch('https://qacrxpfoamarslxskcyb.supabase.co/auth/v1/authorize?provider=slack-oidc', {
      method: 'GET',
      redirect: 'manual'
    });
    console.log('Status:', response.status);
    console.log('Location:', response.headers.get('location'));
    if (response.status === 302) {
      console.log('✅ Slack OAuth endpoint funcionando');
    } else {
      console.log('❌ Slack OAuth endpoint falhando');
    }
  } catch (e) {
    console.error('❌ Erro no endpoint:', e);
  }

  // 3. Test with actual OAuth call
  console.log('3. Testando chamada OAuth real...');
  try {
    const { createClient } = await import('./src/supabaseClient.js');
    const supabase = createClient(
      'https://qacrxpfoamarslxskcyb.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhY3J4cGZvYW1hcnNseHNrY3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0NDksImV4cCI6MjA5MDEyMTQ0OX0.GSp8g-IdFeOcX14wE4le27MRvwjw4jQB8dqgTe6OrBM'
    );

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'slack-oidc',
      options: { redirectTo: window.location.origin }
    });

    if (error) {
      console.error('❌ Erro OAuth:', error.message);
    } else {
      console.log('✅ OAuth iniciado:', data);
    }
  } catch (e) {
    console.error('❌ Exceção OAuth:', e);
  }
}

// Run diagnosis
diagnoseSlackOAuth();