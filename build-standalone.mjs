import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const html = readFileSync('dist-standalone/index.html', 'utf8');
const js = readFileSync('dist-standalone/app.js', 'utf8');
const css = readFileSync('dist-standalone/app.css', 'utf8');

// Bước 1: thay thẻ ngoài bằng placeholder VÀ kiểm tra ngay trên HTML gốc
// (không kiểm tra sau khi nhúng, vì bản thân mã bundle cũng chứa chuỗi giống thẻ script).
let n = 0;
let tpl = html
  .replace(/<script\b[^>]*\bsrc="[^"]*app\.js"[^>]*><\/script>/, () => { n++; return '@@JS@@'; })
  .replace(/<link\b[^>]*\bhref="[^"]*app\.css"[^>]*>/, () => { n++; return '@@CSS@@'; });

if (n !== 2) {
  console.error(`LỖI: chỉ thay được ${n}/2 thẻ tài nguyên trong dist-standalone/index.html.`);
  process.exit(1);
}

// Vite đặt thẻ script trong <head>. Script IIFE (không phải module) KHÔNG được defer,
// nên phải chuyển xuống cuối <body>, sau khi #root đã tồn tại.
const inlineJs = '<script>\n' + js.replace(/<\/script>/gi, '<\\/script>') + '\n</script>';
const out = tpl
  .replace('@@CSS@@', () => '<style>\n' + css + '\n</style>')   // dạng hàm: tránh $& $' bị diễn giải
  .replace('@@JS@@', '')
  .replace('</body>', () => inlineJs + '\n</body>');

if (!out.includes(inlineJs)) {
  console.error('LỖI: không chèn được mã vào cuối <body>.');
  process.exit(1);
}

writeFileSync('dist/asc-uat-standalone.html', out);
rmSync('dist-standalone', { recursive: true, force: true });
console.log('Đã tạo dist/asc-uat-standalone.html —', (out.length / 1024).toFixed(0), 'kB');
