import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { ReportPdfService } from '../report-pdf.service';

/**
 * The Chromium renderer. The rendering cases need a Chromium binary (CI
 * runners and the API image have one); without one they are reported as
 * skipped rather than failing, and `available()` is what reports use to fall
 * back to PDFKit.
 */
describe('ReportPdfService', () => {
  const ORIGINAL = process.env.CHROMIUM_PATH;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CHROMIUM_PATH;
    else process.env.CHROMIUM_PATH = ORIGINAL;
  });

  it('is unavailable when CHROMIUM_PATH points at nothing (no silent substitute)', () => {
    process.env.CHROMIUM_PATH = '/nonexistent/chromium';
    const svc = new ReportPdfService();
    expect(svc.available()).toBe(false);
    return expect(svc.render('<p>x</p>')).rejects.toThrow(/not installed/);
  });

  describe('rendering', () => {
    const svc = new ReportPdfService();
    const itRenders = svc.available() ? it : it.skip;
    let server: Server;
    let hits = 0;
    let port = 0;

    beforeAll((done) => {
      server = createServer((_req, res) => {
        hits++;
        res.end('x');
      }).listen(0, '127.0.0.1', () => {
        port = (server.address() as AddressInfo).port;
        done();
      });
    });
    afterAll(async () => {
      await svc.onModuleDestroy();
      await new Promise((r) => server.close(r));
    });

    itRenders(
      'prints an A4 PDF and never lets the page reach the network',
      async () => {
        const url = `http://127.0.0.1:${port}`;
        const pdf = await svc.render(
          `<!doctype html><html dir="rtl"><head>
             <link rel="stylesheet" href="${url}/a.css">
             <style>@font-face{font-family:x;src:url(${url}/f.ttf)} body{font-family:x}</style>
           </head><body>
             <h1>تقرير</h1>
             <img src="${url}/i.png">
             <iframe src="${url}/frame"></iframe>
             <script>fetch('${url}/js')</script>
           </body></html>`,
          { text: 'شركة' },
        );
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        expect(hits).toBe(0);
      },
      60_000,
    );
  });
});
