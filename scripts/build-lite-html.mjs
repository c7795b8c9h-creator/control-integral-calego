import fs from 'node:fs';

const appJs=process.env.APP_JS||'app.v8.min.js';
const appCss=process.env.APP_CSS||'app.v8.min.css';

let html=fs.readFileSync('standalone.html','utf8');

html=html
  // standalone may already point to a previously published bundle. Strip all
  // asset routing first so dist can never inherit an older release.
  .replace(/\s*<base\b[^>]*>\s*/gi,'\n')
  .replace(/\s*<link\s+rel=["']stylesheet["'][^>]*>\s*/gi,'\n')
  .replace(/\s*<script\s+src=["'][^"']+["'][^>]*><\/script>\s*/gi,'\n')
  .replace(/\s*<meta\s+name=["']color-scheme["'][^>]*>\s*/gi,'\n')
  .replace(/\s*<meta\s+name=["']format-detection["'][^>]*>\s*/gi,'\n')
  .replace(/<title>[^<]*<\/title>/i,'<title>CALEGO · Control Integral · V8</title>')
  .replace('</head>',
    '  <meta name="color-scheme" content="light">\n'+
    '  <meta name="format-detection" content="telephone=no">\n'+
    '  <link rel="stylesheet" href="./'+appCss+'">\n'+
    '</head>')
  .replace('</body>',
    '<script src="./vendor/supabase-2.49.8.min.js"></script>\n'+
    '<script src="./'+appJs+'"></script>\n'+
    '</body>');

fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',html);
