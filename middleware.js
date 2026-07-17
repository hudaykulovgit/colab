// Vercel Routing Middleware -- gates the entire app (pages + API routes)
// behind a single shared password, no username. Reads APP_PASSWORD from
// the environment; if it's not set, the app stays open (fails open rather
// than locking everyone out with no way in).

const COOKIE_NAME = 'af_auth';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loginPage(error) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in — Autofinance</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5fc;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#16152b}
  form{background:#fff;border:1px solid #e7e6f4;border-radius:16px;padding:32px;width:min(320px,90vw);box-shadow:0 10px 35px rgba(76,29,149,.09);box-sizing:border-box}
  h1{font-size:18px;margin:0 0 6px;letter-spacing:-.02em}
  p{color:#6b7085;font-size:13px;margin:0 0 20px}
  input{width:100%;height:44px;border:1px solid #e7e6f4;border-radius:10px;padding:0 13px;font-size:15px;box-sizing:border-box;outline:none}
  input:focus{border-color:#a5b4fc;box-shadow:0 0 0 3px rgba(99,102,241,.14)}
  button{width:100%;height:44px;margin-top:14px;border:0;border-radius:10px;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:15px;font-weight:650;cursor:pointer}
  .err{color:#e11d48;font-size:12.5px;margin-top:10px}
</style></head>
<body><form method="post" action="/login">
  <h1>Autofinance</h1>
  <p>Enter the password to continue.</p>
  <input type="password" name="password" placeholder="Password" autofocus required autocomplete="current-password">
  ${error ? '<div class="err">Incorrect password.</div>' : ''}
  <button type="submit">Sign in</button>
</form></body></html>`;
}

export default async function middleware(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return; // not configured yet -- stay open rather than lock everyone out

  const url = new URL(request.url);
  const expectedHash = await sha256(password);

  if (url.pathname === '/login') {
    if (request.method === 'POST') {
      const form = await request.formData();
      if (form.get('password') === password) {
        const res = new Response(null, { status: 303, headers: { Location: '/' } });
        res.headers.append(
          'Set-Cookie',
          `${COOKIE_NAME}=${expectedHash}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
        );
        return res;
      }
      return new Response(loginPage(true), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return new Response(loginPage(false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (match && match[1] === expectedHash) return;

  return new Response(null, { status: 303, headers: { Location: '/login' } });
}
