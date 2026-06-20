/* ============================================================
   app.js
   Government Loss Dashboard
   ============================================================ */
'use strict';

// ── Chart.js defaults ───────────────────────────────────────────
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = 'rgba(139,154,184,1)';
Chart.defaults.plugins.legend.display = false;

// ── State ───────────────────────────────────────────────────────
let DB = null;           // full data.json blob
let activeRecords = [];  // filtered record array

// Filter state
let F = {
    yearFrom:  2006,
    yearTo:    2025,
    lossType:  '',
    incident:  '',
    portfolio: '',
    dept:      ''
};

// ── Palette ─────────────────────────────────────────────────────
const PALETTE = [
    '#3b82f6','#10b981','#f59e0b','#f43f5e','#8b5cf6',
    '#0ea5e9','#c9a227','#ec4899','#14b8a6','#a855f7',
    '#6366f1','#84cc16','#ef4444','#fb923c','#22d3ee'
];

// ── Helpers ─────────────────────────────────────────────────────
function fmt(n) {
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toFixed(0);
}
function fmtFull(n) {
    return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(n, d) { return d === 0 ? '0%' : (n / d * 100).toFixed(1) + '%'; }

// Record column indices
const C = { YEAR:0, LT:1, INC:2, DEPT:3, PORT:4, LOSS:5, REC:6, NET:7, RECOVERABLE:8 };

// ── Charts Registry ─────────────────────────────────────────────
const CHARTS = {};
function destroyChart(id) { if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; } }

function isDark() { return !document.body.classList.contains('light'); }

function gridColor() { return isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'; }
function tickColor() { return isDark() ? '#4f5f7a' : '#6b7a95'; }

// ── Load data.json ───────────────────────────────────────────────
async function loadData() {
    try {
        const resp = await fetch('data.json');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        DB = await resp.json();

        populateFilters();
        applyFilters();

        document.getElementById('dataStatus').textContent = '✔ ' + DB.meta.recordCount.toLocaleString() + ' records';
        document.getElementById('dataStatus').classList.add('ready');
        document.getElementById('loadingOverlay').classList.add('hidden');

    } catch (e) {
        document.getElementById('dataStatus').textContent = '✖ Load error';
        document.getElementById('dataStatus').classList.add('error');
        document.getElementById('loadingOverlay').querySelector('.loading-text').textContent = 'Error loading data. Is data.json present?';
        console.error(e);
    }
}

// ── Populate Filter Dropdowns ────────────────────────────────────
function populateFilters() {
    fillSelect('lossTypeFilter', DB.lossTypes.filter(x => x !== 'Unknown').sort());
    fillSelect('incidentFilter', DB.incidents.filter(x => x !== 'Unknown').sort());
    fillSelect('portfolioFilter', DB.portfolios.filter(x => x !== 'Unknown').sort());
    fillSelect('deptFilter', DB.depts.filter(x => x !== 'Unknown').sort());
}

function fillSelect(id, items) {
    const sel = document.getElementById(id);
    const first = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(first);
    items.forEach(v => {
        const o = document.createElement('option');
        o.value = v; o.textContent = v;
        sel.appendChild(o);
    });
}

// ── Filter Application ───────────────────────────────────────────
function applyFilters() {
    const ltIdx  = F.lossType  ? DB.lossTypes.indexOf(F.lossType)   : -1;
    const incIdx = F.incident  ? DB.incidents.indexOf(F.incident)   : -1;
    const portIdx= F.portfolio ? DB.portfolios.indexOf(F.portfolio) : -1;
    const deptIdx= F.dept      ? DB.depts.indexOf(F.dept)           : -1;

    activeRecords = DB.records.filter(r => {
        if (r[C.YEAR] < F.yearFrom || r[C.YEAR] > F.yearTo) return false;
        if (ltIdx   >= 0 && r[C.LT]   !== ltIdx)   return false;
        if (incIdx  >= 0 && r[C.INC]  !== incIdx)  return false;
        if (portIdx >= 0 && r[C.PORT] !== portIdx) return false;
        if (deptIdx >= 0 && r[C.DEPT] !== deptIdx) return false;
        return true;
    });

    renderAll();
}

// ── Cascade: when portfolio selected, filter dept list ───────────
function cascadeDeptFilter() {
    const portName = F.portfolio;
    let depts = DB.depts.filter(x => x !== 'Unknown');

    if (portName) {
        const portIdx = DB.portfolios.indexOf(portName);
        const deptSet = new Set();
        DB.records.forEach(r => {
            if (r[C.PORT] === portIdx) deptSet.add(DB.depts[r[C.DEPT]]);
        });
        depts = depts.filter(d => deptSet.has(d)).sort();
    } else {
        depts = depts.sort();
    }
    fillSelect('deptFilter', depts);
    document.getElementById('deptFilter').value = F.dept || '';
}

// ── Cascade: when losstype selected, filter incident list ─────────
function cascadeIncFilter() {
    const ltName = F.lossType;
    let incs = DB.incidents.filter(x => x !== 'Unknown');

    if (ltName) {
        const ltIdx = DB.lossTypes.indexOf(ltName);
        const incSet = new Set();
        DB.records.forEach(r => {
            if (r[C.LT] === ltIdx) incSet.add(DB.incidents[r[C.INC]]);
        });
        incs = incs.filter(i => incSet.has(i)).sort();
    } else {
        incs = incs.sort();
    }
    fillSelect('incidentFilter', incs);
    document.getElementById('incidentFilter').value = F.incident || '';
}

// ── Render All ────────────────────────────────────────────────────
function renderAll() {
    renderKPIs();
    renderTrendChart();
    renderLossTypeChart();
    renderPortfolioChart();
    renderTop10Table();
    renderIncidentTrendChart();
    renderDeptBarChart();
    renderRecoveryChart();
}

// ── KPIs ──────────────────────────────────────────────────────────
function renderKPIs() {
    let totalLoss = 0, totalRec = 0, totalNet = 0;
    activeRecords.forEach(r => {
        totalLoss += r[C.LOSS];
        totalRec  += r[C.REC];
        totalNet  += r[C.NET];
    });

    document.getElementById('kpiTotalLoss').textContent    = fmt(totalLoss);
    document.getElementById('kpiRecovered').textContent    = fmt(totalRec);
    document.getElementById('kpiNetLoss').textContent      = fmt(totalNet);
    document.getElementById('kpiIncidents').textContent    = activeRecords.length.toLocaleString();
    document.getElementById('kpiRecoveryRate').textContent = pct(totalRec, totalLoss);
}

// ── Trend Chart ───────────────────────────────────────────────────
function renderTrendChart() {
    const metric = document.getElementById('trendMetric').value;
    const col = metric === 'loss' ? C.LOSS : metric === 'netLoss' ? C.NET : C.REC;

    const byYear = {};
    activeRecords.forEach(r => {
        byYear[r[C.YEAR]] = (byYear[r[C.YEAR]] || 0) + r[col];
    });

    const years  = Object.keys(byYear).map(Number).sort((a,b) => a-b);
    const values = years.map(y => byYear[y]);

    const colMap = { loss: '#f43f5e', netLoss: '#f59e0b', recovered: '#10b981' };
    const color  = colMap[metric];

    destroyChart('trend');
    const ctx = document.getElementById('trendChart').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');

    CHARTS['trend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                data: values,
                borderColor: color,
                backgroundColor: grad,
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: color,
                pointBorderColor: 'var(--bg-card)',
                pointBorderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 600 },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => ' ' + fmtFull(ctx.raw)
                    }
                }
            },
            scales: {
                x: { grid: { color: gridColor() }, ticks: { color: tickColor() } },
                y: {
                    grid: { color: gridColor() },
                    ticks: { color: tickColor(), callback: v => fmt(v) }
                }
            }
        }
    });
}

// ── Loss Type Pie ─────────────────────────────────────────────────
function renderLossTypeChart() {
    const byLT = {};
    activeRecords.forEach(r => {
        const k = DB.lossTypes[r[C.LT]] || 'Unknown';
        byLT[k] = (byLT[k] || 0) + r[C.LOSS];
    });

    const labels = Object.keys(byLT);
    const values = labels.map(l => byLT[l]);
    const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

    destroyChart('lossType');
    CHARTS['lossType'] = new Chart(document.getElementById('lossTypeChart'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: isDark() ? '#111827' : '#fff', hoverOffset: 8 }] },
        options: {
            responsive: true,
            animation: { duration: 600 },
            cutout: '62%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: tickColor(), padding: 12, font: { size: 10, weight: '600' }, boxWidth: 10, boxHeight: 10 }
                },
                tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + fmtFull(ctx.raw) + ' (' + pct(ctx.raw, values.reduce((a,b)=>a+b,0)) + ')' } }
            }
        }
    });
}

// ── Portfolio Bar ─────────────────────────────────────────────────
function renderPortfolioChart() {
    const byPort = {};
    activeRecords.forEach(r => {
        const k = DB.portfolios[r[C.PORT]] || 'Unknown';
        byPort[k] = (byPort[k] || 0) + r[C.LOSS];
    });

    const entries = Object.entries(byPort).sort((a,b) => b[1]-a[1]).slice(0, 12);
    const labels  = entries.map(e => e[0].length > 30 ? e[0].slice(0,28)+'…' : e[0]);
    const values  = entries.map(e => e[1]);
    const colors  = values.map((_, i) => PALETTE[i % PALETTE.length]);

    destroyChart('portfolio');
    CHARTS['portfolio'] = new Chart(document.getElementById('portfolioChart'), {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 5, borderSkipped: false }] },
        options: {
            responsive: true,
            animation: { duration: 600 },
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ' ' + fmtFull(ctx.raw) } }
            },
            scales: {
                x: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => fmt(v) } },
                y: { grid: { display: false }, ticks: { color: tickColor(), font: { size: 10 } } }
            }
        }
    });
}

// ── Top 10 Table ──────────────────────────────────────────────────
function renderTop10Table() {
    const byDept = {};
    activeRecords.forEach(r => {
        const k = r[C.DEPT];
        if (!byDept[k]) byDept[k] = { name: DB.depts[k], port: DB.portfolios[r[C.PORT]], loss: 0, rec: 0, net: 0 };
        byDept[k].loss += r[C.LOSS];
        byDept[k].rec  += r[C.REC];
        byDept[k].net  += r[C.NET];
    });

    const sorted = Object.values(byDept).sort((a,b) => b.loss - a.loss).slice(0, 10);
    const maxLoss = sorted[0] ? sorted[0].loss : 1;
    const body = document.getElementById('top10Body');
    body.innerHTML = '';

    sorted.forEach((d, i) => {
        const tr = document.createElement('tr');
        const rank = i < 3 ? `<span class="rank-badge top3">${i+1}</span>` : `<span class="rank-badge">${i+1}</span>`;
        const bar  = `<div class="progress-bar-wrap"><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${(d.loss/maxLoss*100).toFixed(1)}%"></div></div><span style="font-size:.65rem;color:var(--text-muted);min-width:36px;text-align:right;">${pct(d.loss,maxLoss)}</span></div>`;
        tr.innerHTML = `
            <td>${rank}</td>
            <td style="color:var(--text-primary);font-weight:600;">${d.name || 'Unknown'}</td>
            <td style="font-size:.75rem;color:var(--text-muted);">${d.port || '—'}</td>
            <td class="tbl-amount loss">${fmtFull(d.loss)}</td>
            <td class="tbl-amount recovered">${fmtFull(d.rec)}</td>
            <td class="tbl-amount net">${fmtFull(d.net)}</td>
            <td>${bar}</td>
        `;
        body.appendChild(tr);
    });
}

// ── Incident Trend Stacked ─────────────────────────────────────────
function renderIncidentTrendChart() {
    const byYear = {};
    const incSet = new Set();
    activeRecords.forEach(r => {
        const y = r[C.YEAR];
        const inc = DB.incidents[r[C.INC]];
        if (!byYear[y]) byYear[y] = {};
        byYear[y][inc] = (byYear[y][inc] || 0) + r[C.LOSS];
        incSet.add(inc);
    });

    const years = Object.keys(byYear).map(Number).sort((a,b)=>a-b);
    const incs  = [...incSet].filter(x => x !== 'Unknown');

    // keep top 6 by total
    const totals = {};
    incs.forEach(inc => { totals[inc] = years.reduce((s,y) => s + (byYear[y]?.[inc] || 0), 0); });
    const top6 = incs.sort((a,b) => totals[b]-totals[a]).slice(0,6);

    const datasets = top6.map((inc, i) => ({
        label: inc.length > 40 ? inc.slice(0,38)+'…' : inc,
        data: years.map(y => byYear[y]?.[inc] || 0),
        backgroundColor: PALETTE[i % PALETTE.length] + 'cc',
        borderColor: PALETTE[i % PALETTE.length],
        borderWidth: 1
    }));

    destroyChart('incTrend');
    CHARTS['incTrend'] = new Chart(document.getElementById('incidentTrendChart'), {
        type: 'bar',
        data: { labels: years, datasets },
        options: {
            responsive: true,
            animation: { duration: 600 },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: tickColor(), padding: 10, font: { size: 9, weight: '600' }, boxWidth: 10, boxHeight: 10, usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtFull(ctx.raw) }
                }
            },
            scales: {
                x: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor() } },
                y: { stacked: true, grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => fmt(v) } }
            }
        }
    });
}

// ── Dept Bar ──────────────────────────────────────────────────────
function renderDeptBarChart() {
    const byDept = {};
    activeRecords.forEach(r => {
        const k = DB.depts[r[C.DEPT]] || 'Unknown';
        byDept[k] = (byDept[k] || 0) + r[C.LOSS];
    });

    const sorted = Object.entries(byDept).sort((a,b) => b[1]-a[1]).slice(0, 15);
    const labels = sorted.map(e => e[0].length > 28 ? e[0].slice(0,26)+'…' : e[0]);
    const values = sorted.map(e => e[1]);

    destroyChart('deptBar');
    CHARTS['deptBar'] = new Chart(document.getElementById('deptBarChart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: values.map((_, i) => PALETTE[i % PALETTE.length] + 'cc'),
                borderColor: values.map((_, i) => PALETTE[i % PALETTE.length]),
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 600 },
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ' ' + fmtFull(ctx.raw) } }
            },
            scales: {
                x: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => fmt(v) } },
                y: { grid: { display: false }, ticks: { color: tickColor(), font: { size: 9 } } }
            }
        }
    });
}

// ── Recovery Chart ────────────────────────────────────────────────
function renderRecoveryChart() {
    const byYear = {};
    activeRecords.forEach(r => {
        const y = r[C.YEAR];
        if (!byYear[y]) byYear[y] = { loss: 0, rec: 0, recoverable: 0 };
        byYear[y].loss        += r[C.LOSS];
        byYear[y].rec         += r[C.REC];
        byYear[y].recoverable += r[C.RECOVERABLE];
    });

    const years = Object.keys(byYear).map(Number).sort((a,b)=>a-b);

    destroyChart('recovery');
    const ctx2 = document.getElementById('recoveryChart').getContext('2d');
    const gLoss = ctx2.createLinearGradient(0, 0, 0, 200);
    gLoss.addColorStop(0, '#f43f5e44'); gLoss.addColorStop(1, '#f43f5e00');

    CHARTS['recovery'] = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Total Loss',
                    data: years.map(y => byYear[y].loss),
                    borderColor: '#f43f5e', backgroundColor: gLoss,
                    borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3
                },
                {
                    label: 'Recovered',
                    data: years.map(y => byYear[y].rec),
                    borderColor: '#10b981', backgroundColor: 'transparent',
                    borderWidth: 2, pointRadius: 3, fill: false, tension: 0.3,
                    borderDash: [4, 4]
                },
                {
                    label: 'Recoverable',
                    data: years.map(y => byYear[y].recoverable),
                    borderColor: '#f59e0b', backgroundColor: 'transparent',
                    borderWidth: 2, pointRadius: 3, fill: false, tension: 0.3,
                    borderDash: [2, 3]
                }
            ]
        },
        options: {
            responsive: true,
            animation: { duration: 600 },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: { color: tickColor(), padding: 16, font: { size: 10, weight: '600' }, boxWidth: 24, boxHeight: 2, usePointStyle: false }
                },
                tooltip: {
                    mode: 'index',
                    callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtFull(ctx.raw) }
                }
            },
            scales: {
                x: { grid: { color: gridColor() }, ticks: { color: tickColor() } },
                y: { grid: { color: gridColor() }, ticks: { color: tickColor(), callback: v => fmt(v) } }
            }
        }
    });
}

// ── Controls / Events ─────────────────────────────────────────────
function bindControls() {
    document.getElementById('yearFrom').addEventListener('change', e => {
        F.yearFrom = parseInt(e.target.value) || 2006;
        applyFilters();
    });
    document.getElementById('yearTo').addEventListener('change', e => {
        F.yearTo = parseInt(e.target.value) || 2025;
        applyFilters();
    });
    document.getElementById('lossTypeFilter').addEventListener('change', e => {
        F.lossType = e.target.value;
        F.incident = '';
        cascadeIncFilter();
        applyFilters();
    });
    document.getElementById('incidentFilter').addEventListener('change', e => {
        F.incident = e.target.value;
        applyFilters();
    });
    document.getElementById('portfolioFilter').addEventListener('change', e => {
        F.portfolio = e.target.value;
        F.dept = '';
        cascadeDeptFilter();
        applyFilters();
    });
    document.getElementById('deptFilter').addEventListener('change', e => {
        F.dept = e.target.value;
        applyFilters();
    });
    document.getElementById('trendMetric').addEventListener('change', () => renderTrendChart());

    document.getElementById('resetBtn').addEventListener('click', () => {
        F = { yearFrom:2006, yearTo:2025, lossType:'', incident:'', portfolio:'', dept:'' };
        document.getElementById('yearFrom').value = 2006;
        document.getElementById('yearTo').value   = 2025;
        ['lossTypeFilter','incidentFilter','portfolioFilter','deptFilter'].forEach(id => {
            document.getElementById(id).value = '';
        });
        populateFilters();
        applyFilters();
    });

    // Theme
    const btn = document.getElementById('themeToggle');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('light');
        const isLight = document.body.classList.contains('light');
        btn.textContent = isLight ? '🌙 Dark' : '☀️ Light';
        localStorage.setItem('govtLossTheme', isLight ? 'light' : 'dark');
        renderAll();
    });

    // Restore theme
    if (localStorage.getItem('govtLossTheme') === 'light') {
        document.body.classList.add('light');
        btn.textContent = '🌙 Dark';
    }
}

// ── Boot ──────────────────────────────────────────────────────────
bindControls();
loadData();
