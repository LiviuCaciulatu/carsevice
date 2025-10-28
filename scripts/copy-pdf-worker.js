const fs = require('fs');
const path = require('path');

async function copyWorker() {
  try {
    const candidates = [
      path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.js'),
      path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'),
      path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
    ];
    let src = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        src = c;
        break;
      }
    }
    const destDir = path.join(process.cwd(), 'public');
    const dest = path.join(destDir, 'pdf.worker.min.js');

    if (!src) {
      console.warn('pdf.worker not found in node_modules. Run `npm install pdfjs-dist` first.');
      return;
    }

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  fs.copyFileSync(src, dest);
    console.log('Copied pdf.worker.min.js to public/');
  } catch (err) {
    console.error('Failed to copy pdf.worker.min.js:', err);
    process.exitCode = 1;
  }
}

copyWorker();
