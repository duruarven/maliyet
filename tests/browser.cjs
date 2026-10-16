const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium, devices } = require('playwright');

const root = path.resolve(__dirname, '..');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const product = 'Çağrı Örme – müşteriye özel';

async function serve() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      const relative = path.relative(root, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) {
        response.writeHead(403).end();
        return;
      }
      const bytes = await fsp.readFile(filename);
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filename)] || 'application/octet-stream' });
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function saveDownload(page, selector, directory, prefix) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  const name = download.suggestedFilename();
  assert.ok(!/[\\/\x00]/.test(name), `Unsafe download filename: ${name}`);
  const filename = path.join(directory, `${prefix}-${name}`);
  await download.saveAs(filename);
  return { name, filename, bytes: await fsp.readFile(filename) };
}

function checkPdf(download, expectedProduct, expectedTotal) {
  assert.match(download.name, /\.pdf$/i);
  assert.equal(download.bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(download.bytes.length > 1000, 'PDF should contain the report and embedded font');
  const extracted = spawnSync('pdftotext', ['-layout', download.filename, '-'], { encoding: 'utf8', timeout: 10000 });
  if (extracted.error?.code === 'ENOENT') {
    console.log('  pdftotext unavailable; PDF text extraction skipped (file signature checked).');
    return;
  }
  assert.equal(extracted.status, 0, extracted.stderr || String(extracted.error));
  assert.ok(extracted.stdout.includes(expectedProduct), 'PDF must retain Turkish product characters');
  assert.ok(extracted.stdout.includes(expectedTotal), 'PDF must include the current total');
  assert.ok(extracted.stdout.includes('Kaşkorse'), 'PDF must retain Turkish expense characters');
}

async function mockShare(page, mode) {
  await page.evaluate(mode => {
    const define = (name, value) => Object.defineProperty(navigator, name, { configurable: true, value });
    window.__shareData = null;
    window.__shareActivation = null;
    define('canShare', mode === 'no-can-share' ? undefined : () => {
      if (mode === 'can-share-throws') throw new TypeError('Files unsupported');
      return ['file', 'pending'].includes(mode);
    });
    define('share', mode === 'unavailable' ? undefined : data => {
      window.__shareData = data;
      window.__shareActivation = navigator.userActivation.isActive;
      if (mode === 'cancel') return Promise.reject(new DOMException('Cancelled', 'AbortError'));
      if (mode === 'error') return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
      if (mode === 'pending') return new Promise(resolve => { window.__resolveShare = resolve; });
      return Promise.resolve();
    });
  }, mode);
}

async function assertButtonsReady(page) {
  for (const id of ['download-csv', 'save-pdf', 'share']) assert.equal(await page.locator(`#${id}`).isEnabled(), true);
  assert.equal(await page.locator('#share').getAttribute('aria-busy'), null);
}

async function waitForStatus(page, fragment) {
  await page.waitForFunction(fragment => document.getElementById('export-status').textContent.includes(fragment), fragment);
}

async function exercise(browser, options, label, url, directory) {
  const context = await browser.newContext({ ...options, acceptDownloads: true });
  const errors = [];
  await context.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL);
    window.__exportBlobs = [];
    URL.createObjectURL = blob => {
      window.__exportBlobs.push({ type: blob.type, size: blob.size });
      return create(blob);
    };
  });
  try {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#product').fill(product);
    await page.locator('#price').fill('200');
    await page.locator('#grams').fill('250');
    const expenses = page.locator('#expenses input[type="number"]');
    for (const [index, value] of ['5', '20', '8', '2'].entries()) await expenses.nth(index).fill(value);
    assert.match(await page.locator('#total').textContent(), /85,00/);

    const csv = await saveDownload(page, '#download-csv', directory, `${label}-initial`);
    assert.match(csv.name, /\.csv$/i);
    const csvText = csv.bytes.toString('utf8');
    assert.equal(csvText.charCodeAt(0), 0xfeff, 'CSV needs UTF-8 BOM for Excel');
    for (const value of [product, 'Kaşkorse', '85,00']) assert.ok(csvText.includes(value), `CSV missing ${value}`);
    assert.match(await page.evaluate(() => window.__exportBlobs.at(-1).type), /^text\/csv/);

    const pdf = await saveDownload(page, '#save-pdf', directory, `${label}-initial`);
    checkPdf(pdf, product, '85,00');
    assert.equal(await page.evaluate(() => window.__exportBlobs.at(-1).type), 'application/pdf');

    await page.locator('#price').fill('240');
    assert.equal(await page.locator('#export-status').textContent(), '', 'Editing clears obsolete export feedback');
    assert.match(await page.locator('#total').textContent(), /95,00/);
    await page.reload();
    assert.equal(await page.locator('#product').inputValue(), product);
    assert.equal(await page.locator('#price').inputValue(), '240');
    const updated = await saveDownload(page, '#download-csv', directory, `${label}-updated`);
    assert.ok(updated.bytes.toString('utf8').includes('95,00'), 'Downloads must reflect edited and restored state');

    await mockShare(page, 'file');
    await page.locator('#share').click();
    await waitForStatus(page, 'PDF paylaşım');
    const shared = await page.evaluate(async () => ({
      activation: window.__shareActivation,
      title: window.__shareData.title,
      text: window.__shareData.text,
      files: await Promise.all(window.__shareData.files.map(async file => ({
        name: file.name, type: file.type, size: file.size,
        header: new TextDecoder().decode((await file.arrayBuffer()).slice(0, 5)),
      }))),
    }));
    assert.equal(shared.activation, true, 'Native sharing must run within the click activation');
    assert.ok(shared.title.includes(product));
    assert.equal(shared.text, undefined, 'Send PDF as a file to iPhone share targets');
    assert.equal(shared.files.length, 1);
    assert.equal(shared.files[0].type, 'application/pdf');
    assert.equal(shared.files[0].header, '%PDF-');
    assert.match(shared.files[0].name, /\.pdf$/i);
    assert.ok(shared.files[0].size > 1000);
    await assertButtonsReady(page);

    for (const mode of ['text', 'no-can-share', 'can-share-throws']) {
      await mockShare(page, mode);
      await page.locator('#share').click();
      await waitForStatus(page, 'Hesap özeti');
      const data = await page.evaluate(() => ({ ...window.__shareData, activation: window.__shareActivation }));
      assert.equal(data.activation, true);
      assert.equal(data.files, undefined);
      for (const value of [product, 'Kaşkorse', '95,00']) assert.ok(data.text.includes(value), `${mode} summary missing ${value}`);
      await assertButtonsReady(page);
    }

    await mockShare(page, 'pending');
    await page.locator('#share').click();
    for (const id of ['download-csv', 'save-pdf', 'share']) assert.equal(await page.locator(`#${id}`).isDisabled(), true);
    assert.equal(await page.locator('#share').getAttribute('aria-busy'), 'true');
    await page.evaluate(() => window.__resolveShare());
    await waitForStatus(page, 'PDF paylaşım');
    await assertButtonsReady(page);

    for (const [mode, status] of [['cancel', 'iptal edildi'], ['error', 'Paylaşım açılamadı']]) {
      await mockShare(page, mode);
      await page.locator('#share').click();
      await waitForStatus(page, status);
      await assertButtonsReady(page);
    }

    await mockShare(page, 'unavailable');
    const fallback = await saveDownload(page, '#share', directory, `${label}-fallback`);
    checkPdf(fallback, product, '95,00');
    await waitForStatus(page, 'desteklenmiyor');
    await assertButtonsReady(page);

    let unexpectedDownloads = 0;
    const onDownload = () => { unexpectedDownloads++; };
    page.on('download', onDownload);
    await page.locator('#price').fill('-1');
    for (const id of ['download-csv', 'save-pdf', 'share']) {
      await page.locator(`#${id}`).click();
      await waitForStatus(page, 'düzeltin');
    }
    await page.waitForTimeout(100);
    page.off('download', onDownload);
    assert.equal(unexpectedDownloads, 0, 'Invalid numeric inputs must block all exports');
    await page.locator('#price').fill('240');

    await page.locator('#product').fill('Çok uzun ürün adı '.repeat(8).slice(0, 120));
    await page.locator('#expenses input').first().fill('Özel gider '.repeat(10).slice(0, 100));
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(dimensions.content <= dimensions.viewport + 1, `${label} horizontal overflow: ${JSON.stringify(dimensions)}`);
    await page.screenshot({ path: path.join(directory, `${label}.png`), fullPage: true });

    await page.locator('#price').fill('-1');
    assert.equal(await page.locator('#price').evaluate(input => input.checkValidity()), false);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#reset').click();
    assert.equal(await page.locator('#price').inputValue(), '');
    assert.equal(await page.locator('#price').evaluate(input => input.checkValidity()), true, 'Reset clears stale custom validity');
    assert.match(await page.locator('#total').textContent(), /0,00/);
    const resetPdf = await saveDownload(page, '#save-pdf', directory, `${label}-reset`);
    checkPdf(resetPdf, '', '0,00');

    assert.deepEqual(errors, [], 'No unhandled browser errors');
    console.log(`PASS ${label}: CSV/PDF downloads, current state, native share activation and fallbacks, validation, layout`);
  } finally {
    await context.close();
  }
}

async function exerciseNativeBridge(browser, url) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__nativeRequests = [];
    window.__nativeStatus = 'completed';
    window.webkit = { messageHandlers: { exportFile: { postMessage(message) {
      window.__nativeRequests.push(message);
      setTimeout(() => NativeExport.complete(message.id, window.__nativeStatus), 0);
    } } } };
  });
  try {
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('#product').fill('İlmek müşteri raporu');
    await page.locator('#price').fill('200');
    await page.locator('#grams').fill('250');
    for (const [selector, action, extension] of [
      ['#save-pdf', 'save', 'pdf'], ['#share', 'share', 'pdf'], ['#download-csv', 'save', 'csv'],
    ]) {
      await page.locator(selector).click();
      await page.waitForFunction(() => document.getElementById('export-status').textContent.length > 0);
      const message = await page.evaluate(() => window.__nativeRequests.at(-1));
      assert.equal(message.action, action);
      assert.ok(message.filename.endsWith('.' + extension));
      const bytes = Buffer.from(message.data, 'base64');
      if (extension === 'pdf') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      else assert.ok(bytes.toString('utf8').includes('50,00'));
      await page.locator('#product').fill('İlmek müşteri raporu ' + extension);
    }
    await page.evaluate(() => { window.__nativeStatus = 'cancelled'; });
    await page.locator('#save-pdf').click();
    await waitForStatus(page, 'Kaydetme iptal');
    await page.locator('#share').click();
    await waitForStatus(page, 'Paylaşım iptal');
    await assertButtonsReady(page);
    await page.evaluate(() => { window.__nativeStatus = 'error'; });
    await page.locator('#share').click();
    await waitForStatus(page, 'Paylaşım açılamadı');
    await assertButtonsReady(page);
    console.log('PASS iOS bridge: PDF/CSV bytes, save/share routing, cancellation and error recovery');
  } finally { await context.close(); }
}

async function main() {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'maliyet-browser-'));
  const { server, url } = await serve();
  let browser;
  let passed = false;
  try {
    const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    const executablePath = configured || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    await exercise(browser, { viewport: { width: 1280, height: 900 } }, 'desktop', url, directory);
    await exercise(browser, devices['iPhone 13'], 'iphone-13-emulation', url, directory);
    await exerciseNativeBridge(browser, url);
    console.log('iPhone checks use Chromium device emulation and mocked Web Share; a physical iPhone share sheet requires a device check.');
    passed = true;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    if (passed) await fsp.rm(directory, { recursive: true, force: true });
    else console.error(`Browser failure artifacts retained at ${directory}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
