import fs from 'node:fs';

let html=fs.readFileSync('standalone.html','utf8');
html=html
  .replace(/<link rel="stylesheet" href="[^"]*assets\/style\.css">/, '<link rel="stylesheet" href="./app.v7.min.css">')
  .replace(/<script src="[^"]*@supabase\/supabase-js@[^"]*"><\/script>/, '<script src="./vendor/supabase.min.js"></script>')
  .replace(/<script src="[^"]*qrcode@[^"]*"><\/script>/, '<script src="./vendor/qrcode.min.js"></script>')
  .replace(/<script src="[^"]*assets\/app\.js"><\/script>/, '<script src="./app.v7.min.js"></script>')
  .replace(/\s*<script src="[^"]*assets\/admin-hotfix\.js"><\/script>/, '')
  .replace('<title>CALEGO · Control Integral</title>','<title>CALEGO · Control Integral · V7 Lite</title>')
  .replace('</head>','  <meta name="color-scheme" content="light">\n  <meta name="format-detection" content="telephone=no">\n</head>');
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/index.html',html);
