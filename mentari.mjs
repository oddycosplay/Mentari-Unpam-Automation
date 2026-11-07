// Mentari UNPAM harian: cek Forum Diskusi, unduh materi, screenshot, laporan.
// Mencatat status Pretest, Posttest, Kuesioner, Penugasan, dan Forum Diskusi; tidak mengirimkan aktivitas.
// Pakai:  node mentari.mjs --login   (sekali, login manual)
//         node mentari.mjs           (jalan normal)
//         node mentari.mjs --debug   (simpan HTML section ke _scripts/debug untuk kalibrasi selector)
import pw from 'playwright';
const { chromium } = pw;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const DEBUG = args.has('--debug');
const progressFile = path.join(cfg.baseDir, '_progress.json');
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safe = (s) => s.replace(/[<>:"/\\|?*]+/g, '_').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function loadProgress() {
  if (fs.existsSync(progressFile)) return JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  return Object.fromEntries(cfg.courses.map((c) => [c.folder, cfg.firstMeeting - 1]));
}
const saveProgress = (p) => fs.writeFileSync(progressFile, JSON.stringify(p, null, 2));

async function isLoggedOut(page) {
  const url = page.url().toLowerCase();
  if (/login|signin|auth/.test(url)) return true;
  return (await page.locator('input[type="password"]').count()) > 0;
}

async function openCourse(page, course) {
  await page.goto(cfg.dashboardUrl, { waitUntil: 'networkidle' });
  if (await isLoggedOut(page)) throw new Error('LOGOUT');
  const before = page.url();
  const title = page.getByText(new RegExp(esc(course.title), 'i'));
  // kartu di panel kanan; sidebar kiri juga memuat judul, jadi coba dari yang terakhir
  await title.last().click();
  await page.waitForLoadState('networkidle');
  if (page.url() === before) {
    // fallback: klik tombol panah pada kartu yang sama
    await title.last().locator('xpath=ancestor::*[.//button][1]').locator('button').last().click();
    await page.waitForLoadState('networkidle');
  }
}

async function openMeeting(page, n) {
  const header = page.getByText(new RegExp(`^\\s*Pertemuan ${n}\\s*$`)).first();
  await header.scrollIntoViewIfNeeded();
  await header.click();
  await sleep(1200);
}

// Mencatat keberadaan dan tautan aktivitas; tidak membuka, menjawab, atau mengirimkannya.
async function inspectActivity(page, name) {
  const item = page.getByText(new RegExp(`^\\s*${esc(name)}\\s*$`, 'i')).first();
  if ((await item.count()) === 0) return `${name}: item tidak ditemukan`;

  const details = await item.evaluate((el) => {
    const row = el.closest('li, a, button, [role="button"], [class*="item"], [class*="Item"]')
      || el.parentElement;
    const link = el.closest('a') || row?.querySelector('a');
    const disabled = row?.getAttribute('aria-disabled') === 'true'
      || row?.hasAttribute('disabled');
    return { href: link?.href || '', disabled };
  });

  if (details.disabled) return `${name}: ditemukan, tetapi tampak nonaktif`;
  return `${name}: ditemukan${details.href ? ` — ${details.href}` : ''}; perlu ditinjau manual`;
}

// true jika item "Forum Diskusi" terkunci/nonaktif. Heuristik; kalibrasi dengan --debug bila perlu.
async function forumLocked(page) {
  const el = page.getByText(/Forum Diskusi/i).first();
  if ((await el.count()) === 0) return { locked: true, why: 'item Forum Diskusi tidak ditemukan' };
  return await el.evaluate((node) => {
    const row = node.closest('li, a, button, [role="button"], [class*="item"], [class*="Item"]') || node.parentElement;
    const html = (row?.outerHTML || '').toLowerCase();
    const disabled = row?.getAttribute('aria-disabled') === 'true' || row?.hasAttribute('disabled');
    const lockHint = /lock|terkunci|disabled|mdi-lock|keyhole/.test(html);
    return { locked: !!(disabled || lockHint), why: disabled ? 'disabled' : lockHint ? 'ikon/kelas kunci' : 'tidak ada tanda kunci' };
  });
}

async function grab(page, context, name, dir, links) {
  const item = page.getByText(new RegExp(`^\\s*${esc(name)}\\s*$`, 'i')).first();
  if ((await item.count()) === 0) return `${name}: item tidak ada`;
  const dl = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
  const popup = context.waitForEvent('page', { timeout: 6000 }).catch(() => null);
  const urlBefore = page.url();
  await item.click();
  const [d, p] = await Promise.all([dl, popup]);
  if (d) {
    const file = path.join(dir, safe(d.suggestedFilename()));
    await d.saveAs(file);
    return `${name}: diunduh -> ${path.basename(file)}`;
  }
  if (p) {
    await p.waitForLoadState('domcontentloaded').catch(() => {});
    const u = p.url();
    await p.close();
    links.push(`${name}: ${u}`);
    return `${name}: link dicatat (${u})`;
  }
  if (page.url() !== urlBefore) {
    links.push(`${name}: ${page.url()}`);
    const res = `${name}: halaman terbuka, URL dicatat (${page.url()})`;
    await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
    return res;
  }
  const body = (await page.locator('main, body').first().innerText()).slice(0, 4000);
  return /no content/i.test(body) ? `${name}: kosong (No content)` : `${name}: diklik, tidak ada unduhan terdeteksi (cek manual)`;
}

async function main() {
  const ctx = await chromium.launchPersistentContext(cfg.profileDir, {
    channel: 'chrome',
    headless: false,
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  if (args.has('--login')) {
    await page.goto(cfg.dashboardUrl);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('Login ke Mentari di jendela Chrome, lalu tekan Enter di sini... ');
    rl.close();
    await ctx.close();
    return;
  }

  const progress = loadProgress();
  const report = [`# Laporan Mentari ${today}`, ''];

  for (const course of cfg.courses) {
    const n = (progress[course.folder] ?? cfg.firstMeeting - 1) + 1;
    report.push(`## ${course.folder} - Pertemuan ${n}`);
    try {
      await openCourse(page, course);
      await openMeeting(page, n);
      if (DEBUG) {
        fs.mkdirSync(path.join(here, 'debug'), { recursive: true });
        fs.writeFileSync(path.join(here, 'debug', `${safe(course.folder)}_P${n}.html`), await page.content());
      }
      for (const name of ['Pretest', 'Posttest', 'Kuesioner', 'Penugasan', 'Forum Diskusi']) {
        report.push(`- ${await inspectActivity(page, name)}`);
      }
      const f = await forumLocked(page);
      if (f.locked) {
        report.push(`- Status Forum Diskusi: terkunci/tidak tersedia (${f.why}); dilewati.`, '');
        continue;
      }
      const dir = path.join(cfg.baseDir, course.folder, `Pertemuan ${n}`);
      fs.mkdirSync(dir, { recursive: true });
      const links = [];
      report.push('- Status Forum Diskusi: terbuka; isi/postingan tidak disentuh.');
      for (const name of cfg.materialItems) report.push(`- ${await grab(page, ctx, name, dir, links)}`);
      for (const name of cfg.linkItems) {
        const item = page.getByText(new RegExp(`^\\s*${esc(name)}\\s*$`, 'i')).first();
        if ((await item.count()) === 0) { report.push(`- ${name}: item tidak ada`); continue; }
        const href = await item.evaluate((el) => (el.closest('a') || el.parentElement?.querySelector('a'))?.href || '');
        if (href) { links.push(`${name}: ${href}`); report.push(`- ${name}: ${href}`); }
        else report.push(`- ${name}: link tidak terbaca, cek manual`);
      }
      if (links.length) fs.writeFileSync(path.join(dir, 'links.txt'), links.join('\n') + '\n');
      await page.screenshot({ path: path.join(dir, `screenshot_pertemuan_${n}.png`), fullPage: true });
      report.push('- Pretest, Posttest, Kuesioner, Penugasan, dan aktivitas Forum Diskusi tetap dikerjakan manual.', '');
      progress[course.folder] = n;
      saveProgress(progress);
    } catch (e) {
      if (e.message === 'LOGOUT') {
        report.push('- Sesi Mentari logout. Jalankan: node mentari.mjs --login', '');
        break;
      }
      report.push(`- Error: ${e.message.split('\n')[0]}`, '');
    }
  }

  fs.writeFileSync(path.join(cfg.baseDir, `laporan_${today}.md`), report.join('\n'));
  console.log(report.join('\n'));
  await ctx.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
