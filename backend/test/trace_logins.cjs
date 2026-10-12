const http = require('http');

const ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@sentrysafe.io' },
  { role: 'DEVELOPER', email: 'developer@sentrysafe.io' },
  { role: 'APPROVER', email: 'approver@sentrysafe.io' },
  { role: 'AUDITOR', email: 'auditor@sentrysafe.io' }
];

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTrace() {
  console.log('=== TRACING LOGIN FOR ALL FOUR DEMO ACCOUNTS ===\n');
  for (const acc of ACCOUNTS) {
    console.log(`--- TRACING ${acc.role} (${acc.email}) ---`);
    try {
      const loginRes = await request({
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, {
        email: acc.email,
        password: 'Password123!'
      });

      console.log(`Status: ${loginRes.statusCode}`);
      console.log('Body:', loginRes.body);
      const setCookie = loginRes.headers['set-cookie'] || [];
      const hasPreAuthCookie = setCookie.some(c => c.startsWith('sentrysafe_pre_auth='));
      console.log(`Pre-auth cookie set: ${hasPreAuthCookie ? 'YES' : 'NO'}`);
      console.log(`requiresTwoFactor: ${loginRes.body?.requiresTwoFactor}`);
      console.log(`requiresEnrollment: ${loginRes.body?.requiresEnrollment}\n`);
    } catch (err) {
      console.error(`Error tracing ${acc.role}:`, err.message);
    }
  }
}

runTrace().catch(console.error);
