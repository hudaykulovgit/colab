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
  :root{--pink:#ea526f;--ink:#1d3342;--ghost:#f7f7ff;--surf:#23b5d3;--blue:#279af1;--mist:#eaf8fc}
  *{box-sizing:border-box}html,body{min-height:100%}body{margin:0;background:var(--ghost);color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
  .auth-shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(420px,.92fr);padding:18px;gap:18px}
  .visual{position:relative;overflow:hidden;min-height:calc(100vh - 36px);padding:46px;border:1px solid rgba(39,154,241,.12);border-radius:30px;color:var(--ink);background:var(--mist)}
  .visual:before{content:"";position:absolute;z-index:1;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.97) 0%,rgba(255,255,255,.88) 38%,rgba(255,255,255,.24) 72%),linear-gradient(0deg,rgba(255,255,255,.94),transparent 34%)}
  .landing-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:.82}
  .brand{position:relative;z-index:2;display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:-.02em}.mark{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,var(--surf),var(--blue) 48%,var(--pink));color:#fff;box-shadow:0 12px 30px rgba(39,154,241,.22)}.brand small{display:block;margin-top:1px;color:#718894;font-size:9px;letter-spacing:.16em}
  .story{position:relative;z-index:2;max-width:720px;margin-top:clamp(90px,17vh,190px)}.kicker{color:#11849b;font-size:10px;font-weight:850;letter-spacing:.16em;text-transform:uppercase}.story h1{max-width:680px;margin:14px 0 22px;font-size:clamp(48px,6vw,88px);line-height:.94;letter-spacing:-.065em}.story p{max-width:560px;margin:0;color:#5d7482;font-size:16px}
  .capabilities{position:absolute;z-index:2;left:46px;right:46px;bottom:42px;display:grid;grid-template-columns:repeat(3,1fr);padding:0 18px 16px;border:1px solid rgba(29,51,66,.10);border-radius:16px;background:rgba(255,255,255,.78);backdrop-filter:blur(12px)}.capability{display:grid;grid-template-columns:auto 1fr;column-gap:13px;padding:20px 24px 0 0}.capability+.capability{padding-left:24px;border-left:1px solid rgba(29,51,66,.09)}.capability span{grid-row:1/3;color:#11849b;font-size:10px;font-weight:800;letter-spacing:.08em}.capability strong{font-size:13px}.capability p{margin:3px 0 0;color:#718894;font-size:10px}
  .panel{display:grid;place-items:center;padding:48px}.login{width:min(430px,100%)}.secure{display:inline-flex;align-items:center;gap:7px;margin-bottom:28px;padding:7px 10px;border:1px solid rgba(35,181,211,.22);border-radius:999px;color:#116477;background:rgba(35,181,211,.08);font-size:10px;font-weight:800;letter-spacing:.08em}.secure i{width:7px;height:7px;border-radius:50%;background:var(--surf);box-shadow:0 0 0 4px rgba(35,181,211,.13)}
  .login h2{margin:0 0 8px;font-size:36px;line-height:1.1;letter-spacing:-.045em}.login>p{margin:0 0 30px;color:#66717a}.field{display:grid;gap:8px}.field label{font-size:11px;font-weight:750}.input-wrap{position:relative}.input-wrap svg{position:absolute;left:15px;top:15px;color:#8d98a0}.input-wrap input{width:100%;height:52px;border:1px solid rgba(29,51,66,.14);border-radius:14px;padding:0 15px 0 45px;background:#fff;color:var(--ink);font-size:15px;outline:none;box-shadow:0 10px 26px rgba(29,51,66,.04);transition:.18s ease}.input-wrap input:focus{border-color:var(--blue);box-shadow:0 0 0 4px rgba(39,154,241,.13),0 12px 30px rgba(29,51,66,.06)}
  button{width:100%;height:52px;margin-top:16px;border:0;border-radius:14px;background:linear-gradient(135deg,var(--blue),var(--surf));color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 14px 30px rgba(39,154,241,.24);transition:.18s ease}button:hover{transform:translateY(-2px);box-shadow:0 18px 34px rgba(39,154,241,.3)}button:focus-visible,input:focus-visible{outline:3px solid rgba(39,154,241,.28);outline-offset:2px}
  .err{display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 12px;border:1px solid rgba(234,82,111,.22);border-radius:11px;color:#a91f3b;background:rgba(234,82,111,.09);font-size:12px;font-weight:650}.foot{display:flex;align-items:center;gap:8px;margin-top:24px;color:#7d8790;font-size:11px}.foot svg{color:var(--surf);flex:0 0 auto}
  @media(max-width:900px){.auth-shell{grid-template-columns:1fr;padding:10px}.visual{min-height:430px;padding:28px}.visual:before{background:linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.42)),linear-gradient(0deg,rgba(255,255,255,.94),transparent 48%)}.story{max-width:720px;margin-top:58px}.story h1{font-size:50px}.story p{font-size:13px}.capabilities{left:28px;right:28px;bottom:28px}.panel{padding:42px 24px 54px}}
  @media(max-width:540px){.visual{min-height:390px;border-radius:22px}.story{margin-top:48px}.story h1{font-size:40px}.story p{max-width:94%}.capabilities{grid-template-columns:1fr;gap:0}.capability{padding:10px 0}.capability+.capability{padding-left:0;border-left:0;border-top:1px solid rgba(29,51,66,.09)}.capability p{display:none}.panel{padding:34px 14px 46px}.login h2{font-size:31px}}
  @media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head>
<body><main class="auth-shell">
  <section class="visual" aria-label="Autofinance portfolio platform">
    <img class="landing-art" src="/assets/finance-landing.jpg" alt="" aria-hidden="true">
    <div class="brand"><div class="mark">AF</div><div>Autofinance<small>PORTFOLIO OS</small></div></div>
    <div class="story"><div class="kicker">Private finance workspace</div><h1>Every contract.<br>One clear view.</h1><p>Monitor receivables, collections, repayment schedules, and portfolio risk from a secure operating dashboard.</p></div>
    <div class="capabilities" aria-label="Platform capabilities"><div class="capability"><span>01</span><strong>Contracts</strong><p>Terms and balances in one register</p></div><div class="capability"><span>02</span><strong>Payments</strong><p>Recorded against the live schedule</p></div><div class="capability"><span>03</span><strong>Forecasting</strong><p>Current and future cash flow</p></div></div>
  </section>
  <section class="panel"><form class="login" method="post" action="/login">
    <div class="secure"><i></i> PROTECTED WORKSPACE</div><h2>Welcome back</h2><p>Enter your workspace password to continue.</p>
    <div class="field"><label for="password">Workspace password</label><div class="input-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="password" type="password" name="password" placeholder="Enter password" autofocus required autocomplete="current-password"></div></div>
    ${error ? '<div class="err">Password not recognized. Please try again.</div>' : ''}
    <button type="submit">Open dashboard</button><div class="foot"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z"/><path d="M9 12l2 2 4-5"/></svg><span>Session protected with a secure, HTTP-only cookie.</span></div>
  </form></section>
</main></body></html>`;
}

export default async function middleware(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return; // not configured yet -- stay open rather than lock everyone out

  const url = new URL(request.url);
  const expectedHash = await sha256(password);

  if (url.pathname === '/assets/finance-landing.jpg') return;

  if (url.pathname === '/logout') {
    const res = new Response(null, { status: 303, headers: { Location: '/login' } });
    res.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
    return res;
  }

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
