// Temporary script to add group metadata to investments.js
const fs = require('fs');

const filePath = './static/js/investments.js';
let content = fs.readFileSync(filePath, 'utf8');

// Update header comment
content = content.replace(
  '/**\n * Registry of all available investments (managers and upgrades)\n * Ordered by: cost (florins), cheapest first\n */',
  '/**\n * Registry of all available investments (managers and upgrades)\n * Organized logically by type. UI sorting happens at render time based on group and cost.\n */'
);

// Add group: "manager" to the three managers
const managerIds = ['arborist', 'foreman', 'pressManager'];
managerIds.forEach(id => {
  const pattern = new RegExp(`(\\s+id: "${id}",\\s+title: "[^"]+",)\\s+(cost:)`, 'g');
  content = content.replace(pattern, `$1\n    group: "manager",\n    \n    $2`);
});

// Add group: "upgrade" to all upgrades
const upgradeIds = [
  'standardized_tools', 'training_program', 'selective_picking', 'ladders_nets', 'quality_inspector',
  'olive_ship_efficiency_1', 'olive_ship_efficiency_2', 'olive_ship_efficiency_3',
  'olive_oil_ship_efficiency_1', 'olive_oil_ship_efficiency_2', 'olive_oil_ship_efficiency_3'
];
upgradeIds.forEach(id => {
  const pattern = new RegExp(`(\\s+id: "${id}",\\s+title: "[^"]+",)\\s+(cost:)`, 'g');
  content = content.replace(pattern, `$1\n    group: "upgrade",\n    \n    $2`);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done! Added group metadata to all investments.');
