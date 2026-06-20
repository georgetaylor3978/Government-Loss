/* ================================================================
   process_data.js
   Government Loss Dashboard - Data Compiler

   Run from the "Govt Waste" folder:
       node process_data.js

   Reads:
       GovtLossData.csv      - raw loss records
       GovtLossMapped.csv    - incident/department mappings

   Writes:
       data.json             - optimised JSON used by the dashboard
   ================================================================ */

'use strict';

const fs   = require('fs');
const path = require('path');
const rl   = require('readline');

const DIR       = __dirname;
const DATA_CSV  = path.join(DIR, 'GovtLossData.csv');
const MAP_CSV   = path.join(DIR, 'GovtLossMapped.csv');
const OUT_JSON  = path.join(DIR, 'data.json');

function parseCSVLine(line) {
    const parts = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (c === ',' && !inQ) {
            parts.push(cur.trim());
            cur = '';
        } else {
            cur += c;
        }
    }
    parts.push(cur.trim());
    return parts;
}

function intern(val, list, map) {
    const key = (val || '').trim();
    if (map[key] !== undefined) return map[key];
    const idx = list.length;
    list.push(key);
    map[key] = idx;
    return idx;
}

if (!fs.existsSync(MAP_CSV)) {
    console.error('ERROR: ' + MAP_CSV + ' not found.');
    process.exit(1);
}

const incidentToLossType = {};
const deptNbrToName      = {};
const deptNbrToPortfolio = {};

const mapLines = fs.readFileSync(MAP_CSV, 'utf8').split(/\r?\n/);
for (const raw of mapLines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const p = parseCSVLine(line);
    if (p.length < 2) continue;
    const table = p[0];
    if (table === 'IncidentType') {
        if (p.length >= 5 && p[2] && p[4]) incidentToLossType[p[2]] = p[4];
    } else if (table === 'Department') {
        if (p.length >= 5 && p[1] && p[2]) {
            deptNbrToName[p[1]]      = p[2];
            deptNbrToPortfolio[p[1]] = p[4] || 'Unknown Portfolio';
        }
    }
}

console.log('Loaded ' + Object.keys(incidentToLossType).length + ' incident mappings');
console.log('Loaded ' + Object.keys(deptNbrToName).length + ' department mappings');

const lossTypes   = [], ltMap   = {};
const incidents   = [], incMap  = {};
const depts       = [], deptMap = {};
const portfolios  = [], portMap = {};

intern('Unknown', lossTypes,  ltMap);
intern('Unknown', incidents,  incMap);
intern('Unknown', depts,      deptMap);
intern('Unknown', portfolios, portMap);

if (!fs.existsSync(DATA_CSV)) {
    console.error('ERROR: ' + DATA_CSV + ' not found.');
    process.exit(1);
}

console.log('Reading ' + DATA_CSV + ' ...');

const reader  = rl.createInterface({ input: fs.createReadStream(DATA_CSV, { encoding: 'latin1' }), crlfDelay: Infinity });
const records = [];
let lineNum   = 0;

reader.on('line', line => {
    lineNum++;
    if (lineNum === 1) return;
    if (!line.trim()) return;
    const p = parseCSVLine(line);
    if (p.length < 10) return;

    const year        = parseInt(p[0], 10) || 0;
    const incText     = (p[2] || '').trim();
    const deptNbr     = (p[3] || '').trim();
    const loss        = parseFloat(p[7])  || 0;
    const recovered   = parseFloat(p[8])  || 0;
    const netLoss     = parseFloat(p[9])  || 0;
    const recoverable = parseFloat(p[10]) || 0;

    const ltText    = incidentToLossType[incText]  || 'Unknown';
    const deptName  = deptNbrToName[deptNbr]       || ('Dept ' + deptNbr);
    const portName  = deptNbrToPortfolio[deptNbr]  || 'Unknown Portfolio';

    records.push([
        year,
        intern(ltText,   lossTypes,  ltMap),
        intern(incText,  incidents,  incMap),
        intern(deptName, depts,      deptMap),
        intern(portName, portfolios, portMap),
        loss,
        recovered,
        netLoss,
        recoverable
    ]);
});

reader.on('close', () => {
    console.log('Processed ' + records.length.toLocaleString() + ' records.');

    const db = {
        meta: {
            title:       'Losses of Public Money or Property as per the Public Accounts of Canada',
            source:      'https://open.canada.ca/data/en/dataset/3b936f0d-4ea2-4aca-b60e-e53aead6ad69',
            generatedAt: new Date().toISOString(),
            recordCount: records.length
        },
        lossTypes,
        incidents,
        depts,
        portfolios,
        records
    };

    console.log('Writing data.json ...');
    fs.writeFileSync(OUT_JSON, JSON.stringify(db));

    const mb = (fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(2);
    console.log('\nDone! data.json is ' + mb + ' MB');
    console.log('  Loss Types:  ' + lossTypes.length);
    console.log('  Incidents:   ' + incidents.length);
    console.log('  Departments: ' + depts.length);
    console.log('  Portfolios:  ' + portfolios.length);
    console.log('  Records:     ' + records.length.toLocaleString());
});
