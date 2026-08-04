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

function legacyLoginPage(error) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in — Autofinance</title>
<style>
  :root{--pink:#ea526f;--ink:#1d3342;--ghost:#f7f7ff;--surf:#23b5d3;--blue:#279af1;--mist:#eaf8fc}
  *{box-sizing:border-box}html,body{min-height:100%}body{margin:0;background:var(--ghost);color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
  .auth-shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(420px,.92fr);padding:18px;gap:18px}
  .visual{position:relative;overflow:hidden;min-height:calc(100vh - 36px);padding:46px;border:1px solid rgba(39,154,241,.12);border-radius:30px;color:var(--ink);background:var(--mist)}
  .visual:before{content:"";position:absolute;z-index:1;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.97) 0%,rgba(255,255,255,.88) 38%,rgba(255,255,255,.24) 72%),linear-gradient(0deg,rgba(255,255,255,.94),transparent 34%)}
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

function loginPage(error) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autofinance — Secure Portfolio</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&amp;family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..700,0..1,-50..200&amp;display=swap" rel="stylesheet">
<style>
  :root{--pink:#ea526f;--ink:#1d3342;--muted:#66717a;--ghost:#f7f7ff;--surf:#23b5d3;--blue:#279af1;--line:rgba(29,51,66,.11)}
  *{box-sizing:border-box}html,body{min-height:100%}body{margin:0;padding:18px;background:#b9c4c9;color:var(--ink);font:400 14px/1.45 "Roboto",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}button,input{font:inherit}.material-symbols-rounded{display:inline-block;font-family:"Material Symbols Rounded";font-style:normal;font-weight:normal!important;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;word-wrap:normal;direction:ltr;font-feature-settings:"liga";-webkit-font-feature-settings:"liga";-webkit-font-smoothing:antialiased;font-variation-settings:"FILL" 0,"wght" 400,"GRAD" 0,"opsz" 24;vertical-align:middle}
  .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  .shell{position:relative;min-height:calc(100vh - 36px);overflow:hidden;border:9px solid rgba(255,255,255,.30);border-radius:34px;background:radial-gradient(circle at 50% 34%,rgba(35,181,211,.16),transparent 27rem),radial-gradient(circle at 88% 76%,rgba(234,82,111,.08),transparent 22rem),linear-gradient(145deg,var(--ghost) 0%,#eef8fd 58%,#edf6fa 100%);box-shadow:0 28px 70px rgba(29,51,66,.14),inset 0 0 0 1px rgba(255,255,255,.9)}
  .shell:before,.shell:after{content:"";position:absolute;border-radius:50%;pointer-events:none}.shell:before{width:430px;height:430px;left:50%;bottom:-290px;transform:translateX(-50%);background:rgba(39,154,241,.10)}.shell:after{width:220px;height:220px;right:8%;top:16%;background:rgba(234,82,111,.07);filter:blur(70px)}
  .topbar{position:relative;z-index:5;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:24px 30px}.brand{display:flex;align-items:center;gap:9px;font-weight:700;letter-spacing:-.02em}.mark{width:24px;height:24px;display:grid;place-items:center;border:2px solid var(--surf);border-radius:50%}.mark:after{content:"";width:5px;height:5px;border-radius:50%;background:var(--blue)}
  .nav{display:flex;gap:7px}.nav span{padding:7px 13px;border:1px solid rgba(255,255,255,.82);border-radius:999px;background:rgba(255,255,255,.48);box-shadow:0 3px 12px rgba(29,51,66,.04);font-size:10px;font-weight:500;color:#506268}.top-actions{justify-self:end;display:flex;align-items:center;gap:8px}.top-actions a{padding:8px 15px;border-radius:999px;color:var(--ink);background:#fff;text-decoration:none;font-size:10px;font-weight:700;box-shadow:0 5px 18px rgba(29,51,66,.08)}.top-actions .primary{color:#fff;background:linear-gradient(135deg,var(--blue),var(--surf));box-shadow:0 8px 24px rgba(39,154,241,.25)}
  .hero{position:relative;z-index:3;width:min(760px,calc(100% - 40px));margin:clamp(34px,7vh,78px) auto 0;text-align:center}.eyebrow{display:inline-flex;align-items:center;gap:7px;margin-bottom:15px;color:#476674;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--surf);box-shadow:0 0 0 5px rgba(35,181,211,.12)}
  h1{margin:0;font-family:"Roboto",ui-sans-serif,sans-serif;font-size:clamp(48px,6vw,86px);font-weight:400;line-height:.91;letter-spacing:-.06em}h1 em{font-family:inherit;font-style:italic;font-weight:300;letter-spacing:-.055em}h1 .line{display:block}.hero>p{max-width:470px;margin:19px auto 22px;color:var(--muted);font-size:12px;line-height:1.55}
  .login{width:max-content;max-width:100%;margin:auto}.login-button{height:50px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;padding:0 27px;color:#fff;background:linear-gradient(135deg,var(--blue),var(--surf));font-weight:700;cursor:pointer;box-shadow:0 12px 28px rgba(39,154,241,.25);transition:.18s ease}.login-button .material-symbols-rounded{font-size:19px}.login-button:hover{transform:translateY(-2px);box-shadow:0 16px 32px rgba(39,154,241,.32)}.login-button:focus-visible,.top-actions a:focus-visible{outline:3px solid rgba(39,154,241,.28);outline-offset:3px}
  .deck{position:relative;z-index:2;width:min(920px,calc(100% - 52px));height:278px;margin:28px auto 0}.mini-card{position:absolute;border:1px solid rgba(255,255,255,.86);border-radius:18px;background:rgba(255,255,255,.80);box-shadow:0 24px 54px rgba(39,154,241,.10),inset 0 1px 0 #fff;backdrop-filter:blur(16px);animation:rise .7s both cubic-bezier(.2,.8,.2,1)}.card-label{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:500}.card-label i{color:var(--blue);font-style:normal;font-size:18px}.forecast .card-label i{color:var(--pink)}
  .quick{left:2%;top:22px;width:250px;padding:18px;transform:rotate(-5deg);animation-delay:.08s}.quick-icons{display:flex;gap:10px;margin-top:22px}.quick-icons span{width:40px;height:40px;display:grid;place-items:center;border-radius:50%;color:var(--blue);background:#eef9fd;font-size:19px}.quick-icons span:first-child{color:#fff;background:var(--surf)}
  .balance{left:50%;top:42px;width:290px;padding:19px;transform:translateX(-50%);animation-delay:.16s}.wallet-row{display:flex;justify-content:space-between;margin-top:14px;padding:10px 11px;border-radius:10px;background:#f4f8fb;color:#7b898d;font-size:9px}.balance-number{margin-top:20px;font-size:25px;letter-spacing:-.04em}.balance-number span{display:block;color:var(--blue);font-size:18px}.delta{position:absolute;right:19px;bottom:20px;color:var(--surf);font-size:18px}
  .forecast{right:2%;top:8px;width:232px;padding:18px 18px 16px;transform:rotate(5deg);animation-delay:.24s}.chart{height:116px;margin-top:12px;display:flex;align-items:flex-end;justify-content:center;gap:10px;border-bottom:1px solid var(--line)}.chart span{width:28px;border-radius:10px 10px 5px 5px;background:#eef3f7}.chart span:nth-child(1){height:40%}.chart span:nth-child(2){height:54%}.chart span:nth-child(3){height:86%;background:linear-gradient(var(--blue),var(--surf))}.chart span:nth-child(4){height:66%}.months{display:flex;justify-content:center;gap:26px;margin-top:7px;color:#91a0a4;font-size:8px}
  .secure-note{position:absolute;left:30px;bottom:22px;color:#728489;font-size:9px;letter-spacing:.06em}.secure-note:before{content:"";display:inline-block;width:6px;height:6px;margin-right:7px;border-radius:50%;background:var(--surf)}
  @keyframes rise{from{opacity:0;translate:0 22px}to{opacity:1;translate:0 0}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}@media(max-width:800px){body{padding:8px}.shell{min-height:calc(100vh - 16px);border-width:5px;border-radius:25px}.topbar{grid-template-columns:1fr auto;padding:20px}.nav{display:none}.hero{margin-top:38px}h1{font-size:clamp(44px,11vw,66px)}.deck{height:250px}.quick{left:0}.forecast{right:0}.balance{z-index:2}.secure-note{display:none}}@media(max-width:600px){.top-actions{display:none}.hero{width:calc(100% - 28px)}.hero>p{font-size:11px}.login-button{width:100%}.deck{width:calc(100% - 24px);height:224px;margin-top:22px}.quick,.forecast{display:none}.balance{top:12px;width:min(310px,100%)}h1{font-size:43px}.topbar{padding:16px}}
</style></head><body><main class="shell">
  <header class="topbar"><div class="brand"><span class="mark"></span>Autofinance</div><nav class="nav" aria-label="Platform sections"><span>Portfolio</span><span>Contracts</span><span>Payments</span><span>Forecast</span></nav><div class="top-actions"><a class="primary" href="#login">Login</a></div></header>
  <section class="hero" aria-labelledby="landing-title"><div class="eyebrow"><i></i>Private portfolio workspace</div><h1 id="landing-title"><span class="line">The next era of</span><span class="line"><em>Auto</em> Finance</span></h1><p>One calm operating view for contracts, scheduled collections, live payments, and forward cash flow.</p><form class="login" method="post" action="/login"><button class="login-button" id="login" type="submit">Login to dashboard <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></form></section>
  <section class="deck" aria-label="Autofinance interface preview"><article class="mini-card quick"><div class="card-label">Quick actions <i class="material-symbols-rounded">north_east</i></div><div class="quick-icons"><span class="material-symbols-rounded">add</span><span class="material-symbols-rounded">payments</span><span class="material-symbols-rounded">sync</span><span class="material-symbols-rounded">check</span></div></article><article class="mini-card balance"><div class="card-label">Portfolio balance <i class="material-symbols-rounded">account_balance_wallet</i></div><div class="wallet-row"><span>Neon Postgres</span><span>Live records</span></div><div class="balance-number">$52,373.34<span>$5,355 collected</span></div><strong class="delta">+18.4%</strong></article><article class="mini-card forecast"><div class="card-label">Cash flow <i class="material-symbols-rounded">monitoring</i></div><div class="chart"><span></span><span></span><span></span><span></span></div><div class="months"><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span></div></article></section><div class="secure-note">Protected workspace · Neon Postgres</div>
</main></body></html>`;
}

export default async function middleware(request) {
  const password = process.env.APP_PASSWORD;
  if (!password) return; // not configured yet -- stay open rather than lock everyone out

  const url = new URL(request.url);
  const expectedHash = await sha256(password);

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
      const res = new Response(null, { status: 303, headers: { Location: '/' } });
      res.headers.append(
        'Set-Cookie',
        `${COOKIE_NAME}=${expectedHash}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
      );
      return res;
    }
    return new Response(loginPage(false), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (match && match[1] === expectedHash) return;

  return new Response(null, { status: 303, headers: { Location: '/login' } });
}
