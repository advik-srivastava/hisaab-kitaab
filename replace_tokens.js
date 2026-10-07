const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-canvas': 'bg-surface-primary',
  'bg-panel-hover': 'bg-surface-hover',
  'bg-panel': 'bg-surface-elevated',
  'border-panel-border-hover': 'border-border-default',
  'border-panel-border': 'border-border-default',
  'text-brand-primary': 'text-neutral-900',
  'bg-brand-primary': 'bg-neutral-900',
  'border-brand-primary': 'border-neutral-900',
  'bg-brand-primary/10': 'bg-neutral-100',
  'border-brand-primary/20': 'border-neutral-200',
  'bg-brand-primary/5': 'bg-neutral-50',
  'text-status-danger-text': 'text-red-500',
  'bg-status-danger-bg': 'bg-red-50',
  'border-status-danger-border': 'border-red-200',
  'text-status-success-text': 'text-green-500',
  'bg-status-success-bg': 'bg-green-50',
  'border-status-success-border': 'border-green-200',
  'text-status-warning-text': 'text-amber-500',
  'bg-status-warning-bg': 'bg-amber-50',
  'border-status-warning-border': 'border-amber-200',
  'bg-black/40': 'bg-surface-primary',
  'shadow-inner': '',
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const appFiles = walk(path.join(__dirname, 'src', 'app')).filter(f => !f.includes('api') && !f.includes('globals.css') && !f.includes('layout.tsx'));
const compFiles = walk(path.join(__dirname, 'src', 'components')).filter(f => !f.includes('StatusBadge.tsx') && !f.includes('ServerDashboard.tsx') && !f.includes('MetricCard.tsx'));

const files = [...appFiles, ...compFiles];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Replace glow shadows
  content = content.replace(/shadow-\[.*?\]/g, 'shadow-sm');
  content = content.replace(/shadow-xl/g, 'shadow-sm');
  content = content.replace(/shadow-2xl/g, 'shadow-sm');
  content = content.replace(/backdrop-blur-[a-z0-9]+/g, '');

  for (const [oldToken, newToken] of Object.entries(replacements)) {
    // Only replace whole words (using word boundary or specific characters)
    const regex = new RegExp(`(?<=\\s|["'\`]|\\b)${oldToken}(?=\\s|["'\`]|/|$)`, 'g');
    content = content.replace(regex, newToken);
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
