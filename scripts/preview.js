const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

const port = Number(process.env.PORT) || 43127;
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
const middlewareSource = fs.readFileSync(path.join(__dirname, '..', 'middleware.js'), 'utf8');
const loginStart = middlewareSource.indexOf('function loginPage');
const loginEnd = middlewareSource.indexOf('export default', loginStart);
const loginContext = {};
vm.runInNewContext(middlewareSource.slice(loginStart, loginEnd), loginContext);

http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (req.url.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'API unavailable in static preview' }));
  }
  if (requestUrl.pathname === '/login') {
    if (req.method === 'POST') {
      res.writeHead(303, { Location: '/' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(loginContext.loginPage(false));
  }
  if (requestUrl.pathname.startsWith('/assets/')) {
    const fileName = path.basename(requestUrl.pathname);
    const assetPath = path.join(__dirname, '..', 'assets', fileName);
    if (!fs.existsSync(assetPath)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const contentType = path.extname(assetPath).toLowerCase() === '.jpg' ? 'image/jpeg' : 'image/png';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    return fs.createReadStream(assetPath).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(index);
}).listen(port, '127.0.0.1', () => {
  console.log(`Autofinance preview: http://127.0.0.1:${port}`);
});
