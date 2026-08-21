import fs from 'node:fs';

const appJs=process.env.APP_JS||'app.v7.min.js';
const appCss=process.env.APP_CSS||'app.v7.min.css';
let html=fs.readFileSync('standalone.html','utf8');
html=html
  .replace(/<link rel="stylesheet" href="[^"]*assets\/style\.css">/, '')
  .replace(/<script src="[^"]*@supabase\/supabase-js@[^"]*"><\/script>/, '<script src="./vendor/supabase-2.49.8.min.js"></script>')
  .replace(/\s*<script src="[^"]*qrcode@[^"]*"><\/script>/, '')
  .replace(/<script src="[^"]*assets\/app\.js"><\/script>/, `<script src="./${appJs}"></script>`)
  .replace(/\s*<script src="[^"]*assets\/admin-hotfix\.js"><\/script>/, '')
  .replace('<title>CALEGO · Control Integral</title>','<title>CALEGO · Control Integral · V7 Lite</title>')
  .replace('</head>',`  <meta name="color-scheme" content="light">\n  <meta name="format-detection" content="telephone=no">\n  <link rel="stylesheet" href="./${appCss}">\n</head>`);
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',html);
