import { existsSync } from 'fs';
import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import type { Browser } from 'puppeteer-core';

/**
 * HTML → PDF for presentation reports, printed by headless Chromium.
 *
 * Why Chromium: it shapes Arabic and lays out RTL text natively, and renders
 * real CSS (grid, web fonts, SVG charts), so a report looks like the dashboard
 * it comes from. PDFKit has no bidi support and stays only as the fallback.
 *
 * Locked down — the HTML is built by our templates, but it carries tenant data
 * (names, notes) that must never become active content:
 *   • JavaScript is disabled in the page;
 *   • every network request is aborted except inline `data:` URLs (no SSRF,
 *     no remote fonts or images — the templates embed what they need);
 *   • each render gets a fresh page that is closed afterwards.
 *
 * One browser is shared across renders (launching costs ~0.5s), at most
 * MAX_CONCURRENT pages render at a time, and the browser is closed after
 * IDLE_MS without work so it does not hold memory between reports.
 */

const MAX_CONCURRENT = 2;
const IDLE_MS = 2 * 60 * 1000;
const RENDER_TIMEOUT_MS = 30_000;

/** Where Chromium usually lives: the API image (Alpine), CI runners, dev machines. */
const CANDIDATES = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export interface PdfFooter {
  /** Shown at the leading edge of every page footer (e.g. the company name). */
  text?: string;
}

@Injectable()
export class ReportPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(ReportPdfService.name);
  private browser: Promise<Browser> | null = null;
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /** The Chromium binary to use, or null when none is installed. */
  executablePath(): string | null {
    // An explicit CHROMIUM_PATH wins (and only it: a wrong one must not
    // silently pick another browser).
    const configured = process.env.CHROMIUM_PATH;
    if (configured) {
      if (existsSync(configured)) return configured;
      this.warnOnce(`CHROMIUM_PATH=${configured} does not exist; reports use the PDFKit fallback`);
      return null;
    }
    return CANDIDATES.find((p) => existsSync(p)) ?? null;
  }

  private warned = false;
  private warnOnce(message: string): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn(message);
  }

  /** True when a Chromium binary is present (the caller may fall back otherwise). */
  available(): boolean {
    return this.executablePath() !== null;
  }

  /** A4 PDF of a complete HTML document. Throws when Chromium is unavailable or fails. */
  async render(html: string, footer: PdfFooter = {}): Promise<Buffer> {
    await this.acquire();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      try {
        await page.setJavaScriptEnabled(false);
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (req.url().startsWith('data:')) void req.continue();
          else void req.abort();
        });
        await page.setContent(html, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS });
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: footerTemplate(footer.text),
          margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
          timeout: RENDER_TIMEOUT_MS,
        });
        return Buffer.from(pdf);
      } finally {
        await page.close().catch(() => undefined);
      }
    } catch (err) {
      // A crashed browser must not poison later renders.
      await this.closeBrowser();
      throw err;
    } finally {
      this.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = this.executablePath();
      if (!executablePath) return Promise.reject(new Error('Chromium is not installed'));
      this.browser = import('puppeteer-core')
        .then(({ launch }) =>
          launch({
            executablePath,
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--font-render-hinting=none',
            ],
          }),
        )
        .then((b) => {
          b.on('disconnected', () => {
            this.browser = null;
          });
          return b;
        })
        .catch((err) => {
          this.browser = null;
          this.logger.error(`Chromium failed to launch: ${(err as Error).message}`);
          throw err;
        });
    }
    return this.browser;
  }

  private async closeBrowser(): Promise<void> {
    const pending = this.browser;
    this.browser = null;
    if (!pending) return;
    try {
      await (await pending).close();
    } catch {
      /* already gone */
    }
  }

  private async acquire(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.active < MAX_CONCURRENT) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
  }

  private release(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) {
      next();
      return;
    }
    if (this.active === 0) {
      this.idleTimer = setTimeout(() => void this.closeBrowser(), IDLE_MS);
      this.idleTimer.unref();
    }
  }
}

/** "صفحة 2 من 5" at the trailing edge and the company name at the leading edge. */
function footerTemplate(text?: string): string {
  const safe = (text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<div dir="rtl" style="width:100%;margin:0 12mm;font-family:'Noto Sans Arabic','DejaVu Sans',sans-serif;font-size:8px;color:#64748b;display:flex;justify-content:space-between;">
  <span>${safe}</span>
  <span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
</div>`;
}

const presentLogger = new Logger('ReportPdf');

/**
 * A presentation report as PDF: Chromium when available; otherwise (or when
 * it fails) the caller's fallback layout; with no fallback, 503. Report
 * services hold ReportPdfService as @Optional, so `pdf` may be undefined.
 */
export async function presentReportPdf(
  pdf: ReportPdfService | undefined,
  html: string,
  brand: { name: string },
  fallback?: () => Promise<Buffer>,
): Promise<Buffer> {
  if (pdf?.available()) {
    try {
      return await pdf.render(html, { text: brand.name });
    } catch (err) {
      presentLogger.warn(`Chromium report render failed${fallback ? ', using the fallback' : ''}: ${(err as Error).message}`);
    }
  }
  if (fallback) return fallback();
  throw new ServiceUnavailableException('PDF reports are unavailable right now');
}
