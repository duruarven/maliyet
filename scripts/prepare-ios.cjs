const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'ios/Maliyet/Web');
fs.mkdirSync(target, { recursive: true });
for (const file of ['index.html', 'style.css', 'cost.js', 'report.js', 'app.js', 'native-export.js', 'vendor']) {
  fs.cpSync(path.join(root, file), path.join(target, file), { recursive: true });
}
console.log('iOS offline web assets prepared.');
