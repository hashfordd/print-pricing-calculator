/* ── Default data ── */
var DEFAULT_SIZES = [
  { label: '8\u00d710"',     ctp: 24, price: 44  },
  { label: '11\u00d714"',    ctp: 24, price: 64  },
  { label: '12\u00d716"',    ctp: 30, price: 84  },
  { label: '16\u00d720"',    ctp: 50, price: 114 },
  { label: '300\u00d7300mm', ctp: 24, price: 64  },
  { label: '500\u00d7500mm', ctp: 60, price: 110 }
];

var DEFAULT_DELIVERY = 15;
var DEFAULT_SHIPPING = 10;
var DEFAULT_PACKAGING = 1.40;
var DEFAULT_EXTRAS = 1.00;

/* ── State ── */
var sizes = [];
var delivery = DEFAULT_DELIVERY;
var shipping = DEFAULT_SHIPPING;
var packaging = DEFAULT_PACKAGING;
var extras = DEFAULT_EXTRAS;

var COLORS = ['#E24B4A','#1D9E75','#378ADD','#BA7517','#7F77DD','#D4537E'];
var COST_COLORS = { print: '#7F77DD', delivery: '#378ADD', packaging: '#BA7517', extras: '#D4537E' };
var MAX = 20;
var qtys = [];
for (var i = 1; i <= MAX; i++) qtys.push(i);
var sel = 0;
var qty = 1;
var chartMode = 'total'; /* 'total' or 'per' */

/* Track previous display values for conditional animation */
var prevDisplay = {};

/* ── Helpers ── */
function num(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function fmtMoney(v) {
  v = num(v);
  if (v < 0) return '-$' + Math.abs(v).toFixed(2);
  return '$' + v.toFixed(2);
}

function fmtMoneySign(v) {
  v = num(v);
  if (v < 0) return '-$' + Math.abs(v).toFixed(2);
  return '+$' + v.toFixed(2);
}

/* ── Derived values ── */
function fixed()         { return num(delivery) + num(shipping); }
function varex()         { return num(packaging) + num(extras); }
function costPP(s, n)    { return num(s.ctp) + varex() + fixed() / Math.max(n, 1); }
function profitPP(s, n)  { return num(s.price) - costPP(s, n); }
function orderProfit(s, n) { return n * profitPP(s, n); }

function marginPct(s, n) {
  var price = num(s.price);
  if (price === 0) return 0;
  return (profitPP(s, n) / price) * 100;
}

function breakEven(s) {
  var m = num(s.price) - num(s.ctp) - varex();
  if (m <= 0) return null;
  var f = fixed();
  if (f <= 0) return 1;
  return Math.ceil(f / m);
}

/* ── localStorage ── */
var STORAGE_KEY = 'ppc_v2';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sizes: sizes, delivery: delivery, shipping: shipping,
      packaging: packaging, extras: extras
    }));
  } catch (e) {}
}

function loadState() {
  sizes = JSON.parse(JSON.stringify(DEFAULT_SIZES));
  delivery = DEFAULT_DELIVERY;
  shipping = DEFAULT_SHIPPING;
  packaging = DEFAULT_PACKAGING;
  extras = DEFAULT_EXTRAS;

  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.sizes)) return;
    if (saved.sizes.length !== DEFAULT_SIZES.length) return;

    var valid = saved.sizes.every(function (s) {
      return s && typeof s.label === 'string' &&
             typeof s.ctp === 'number' && !isNaN(s.ctp) &&
             typeof s.price === 'number' && !isNaN(s.price);
    });
    if (!valid) return;

    sizes = saved.sizes;
    if (typeof saved.delivery === 'number' && !isNaN(saved.delivery)) delivery = saved.delivery;
    if (typeof saved.shipping === 'number' && !isNaN(saved.shipping)) shipping = saved.shipping;
    if (typeof saved.packaging === 'number' && !isNaN(saved.packaging)) packaging = saved.packaging;
    if (typeof saved.extras === 'number' && !isNaN(saved.extras)) extras = saved.extras;
  } catch (e) {}
}

function populateSettingsInputs() {
  document.getElementById('in-delivery').value = delivery;
  document.getElementById('in-shipping').value = shipping;
  document.getElementById('in-packaging').value = packaging;
  document.getElementById('in-extras').value = extras;
}

/* ── Settings panel ── */
function toggleSettings() {
  document.getElementById('settings-panel').classList.toggle('open');
  document.getElementById('settings-btn').classList.toggle('open');
}

function buildSizeEditor() {
  var tbody = document.getElementById('size-editor-body');
  tbody.innerHTML = '';
  sizes.forEach(function (s, i) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="size-name">' + s.label + '</td>' +
      '<td><div class="setting-input"><span class="dollar">$</span>' +
        '<input type="number" value="' + s.ctp + '" min="0" step="1" data-idx="' + i + '" data-field="ctp" /></div></td>' +
      '<td><div class="setting-input"><span class="dollar">$</span>' +
        '<input type="number" value="' + s.price + '" min="0" step="1" data-idx="' + i + '" data-field="price" /></div></td>';
    tr.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () { onSizeEdit(this); });
    });
    tbody.appendChild(tr);
  });
}

function onSizeEdit(el) {
  var idx = parseInt(el.getAttribute('data-idx'), 10);
  var field = el.getAttribute('data-field');
  var val = parseFloat(el.value);
  if (isNaN(val)) return;
  sizes[idx][field] = val;
  saveState();
  rebuildChart();
  update();
}

function onSettingChange() {
  var d = parseFloat(document.getElementById('in-delivery').value);
  var s = parseFloat(document.getElementById('in-shipping').value);
  var p = parseFloat(document.getElementById('in-packaging').value);
  var e = parseFloat(document.getElementById('in-extras').value);
  if (!isNaN(d)) delivery = d;
  if (!isNaN(s)) shipping = s;
  if (!isNaN(p)) packaging = p;
  if (!isNaN(e)) extras = e;
  saveState();
  rebuildChart();
  update();
}

function resetDefaults() {
  sizes = JSON.parse(JSON.stringify(DEFAULT_SIZES));
  delivery = DEFAULT_DELIVERY;
  shipping = DEFAULT_SHIPPING;
  packaging = DEFAULT_PACKAGING;
  extras = DEFAULT_EXTRAS;
  populateSettingsInputs();
  buildSizeEditor();
  saveState();
  rebuildChart();
  update();
}

/* ── Build static UI ── */
function buildSizeButtons() {
  var el = document.getElementById('size-btns');
  el.innerHTML = '';
  sizes.forEach(function (s, i) {
    var b = document.createElement('button');
    b.className = 'size-btn' + (i === sel ? ' active' : '');
    b.textContent = s.label;
    b.addEventListener('click', function () { sel = i; update(); });
    el.appendChild(b);
  });
}

function buildLegend() {
  var el = document.getElementById('legend');
  el.innerHTML = '';
  sizes.forEach(function (s, i) {
    var d = document.createElement('div');
    d.className = 'legend-item' + (i === sel ? ' active' : '');
    d.innerHTML = '<span class="legend-dot" style="background:' + COLORS[i % COLORS.length] + '"></span>' + s.label;
    d.addEventListener('click', function () { sel = i; update(); });
    el.appendChild(d);
  });
}

/* ── Chart ── */
var chart = null;

function chartDataFn(s, n) {
  if (chartMode === 'per') return parseFloat(profitPP(s, n).toFixed(2));
  return parseFloat(orderProfit(s, n).toFixed(2));
}

function chartYLabel() {
  return chartMode === 'per' ? 'Profit per print ($)' : 'Total profit ($)';
}

function chartTooltipLabel(ctx) {
  var v = ctx.parsed.y;
  var suffix = chartMode === 'per' ? '/print' : '';
  return ' ' + ctx.dataset.label + ': ' + fmtMoneySign(v) + suffix;
}

function setChartMode(mode) {
  chartMode = mode;
  document.getElementById('chart-mode-total').className =
    'chart-toggle-btn' + (mode === 'total' ? ' active' : '');
  document.getElementById('chart-mode-per').className =
    'chart-toggle-btn' + (mode === 'per' ? ' active' : '');
  document.getElementById('chart-title').textContent =
    (mode === 'total' ? 'Total order profit' : 'Profit per print') + ' \u2014 all sizes';
  rebuildChart();
}

function rebuildChart() {
  if (typeof Chart === 'undefined') return;

  var datasets = sizes.map(function (s, i) {
    return {
      label: s.label,
      data: qtys.map(function (n) { return chartDataFn(s, n); }),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: 'transparent',
      borderWidth: i === sel ? 2.5 : 1.2,
      borderDash: i === sel ? [] : [5, 4],
      pointRadius: i === sel ? 3.5 : 0,
      pointBackgroundColor: COLORS[i % COLORS.length],
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      tension: 0.35
    };
  });

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById('myChart'), {
    type: 'line',
    data: { labels: qtys, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      onClick: function (e) {
        var points = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false);
        if (points.length > 0) {
          qty = points[0].index + 1;
          document.getElementById('qty-slider').value = qty;
          update();
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26,26,24,0.92)',
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: function (items) {
              return items[0].label + (items[0].label === '1' ? ' print' : ' prints');
            },
            label: chartTooltipLabel
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Prints in order', font: { size: 11, weight: '500' }, color: '#aaa8a0' },
          ticks: { font: { size: 11 }, color: '#aaa8a0', maxTicksLimit: 10 },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        y: {
          title: { display: true, text: chartYLabel(), font: { size: 11, weight: '500' }, color: '#aaa8a0' },
          ticks: {
            callback: function (v) { return fmtMoney(v); },
            font: { size: 11 }, color: '#aaa8a0'
          },
          grid: {
            color: function (ctx) { return ctx.tick.value === 0 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.04)'; },
            lineWidth: function (ctx) { return ctx.tick.value === 0 ? 1.5 : 1; }
          }
        }
      }
    },
    plugins: [{
      id: 'qtyLine',
      afterDraw: function (ch) {
        var xScale = ch.scales.x;
        var yScale = ch.scales.y;
        var x = xScale.getPixelForValue(qty - 1);
        var ctx = ch.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
        ctx.restore();
      }
    }]
  });
}

function updateChartData() {
  if (!chart) return;
  chart.data.datasets.forEach(function (ds, i) {
    ds.data = qtys.map(function (n) { return chartDataFn(sizes[i], n); });
    ds.borderWidth = i === sel ? 2.5 : 1.2;
    ds.borderDash = i === sel ? [] : [5, 4];
    ds.pointRadius = i === sel ? 3.5 : 0;
  });
  chart.update('none');
}

/* ── Size comparison bars ── */
function updateCompareBars() {
  var container = document.getElementById('compare-bars');
  container.innerHTML = '';

  /* Find the max absolute profit to scale bars */
  var profits = sizes.map(function (s) { return profitPP(s, qty); });
  var maxAbs = Math.max.apply(null, profits.map(function (p) { return Math.abs(p); }));
  if (maxAbs === 0) maxAbs = 1;

  /* Find the max price to use as the scale reference (so bars relate to something meaningful) */
  var maxPrice = Math.max.apply(null, sizes.map(function (s) { return num(s.price); }));
  if (maxPrice === 0) maxPrice = 1;

  sizes.forEach(function (s, i) {
    var p = profits[i];
    var isActive = i === sel;
    var barPct = Math.min(Math.abs(p) / maxAbs * 85, 100); /* 85% max so labels fit */
    if (barPct < 3) barPct = 3;

    var row = document.createElement('div');
    row.className = 'compare-row';
    row.addEventListener('click', function () { sel = i; update(); });

    var label = document.createElement('div');
    label.className = 'compare-label' + (isActive ? ' active-label' : '');
    label.textContent = s.label;

    var barWrap = document.createElement('div');
    barWrap.className = 'compare-bar-wrap';

    var bar = document.createElement('div');
    bar.className = 'compare-bar';
    bar.style.width = barPct + '%';
    bar.style.background = p >= 0 ? COLORS[i % COLORS.length] : 'var(--red)';
    if (barPct > 25) bar.textContent = fmtMoneySign(p);

    barWrap.appendChild(bar);

    var value = document.createElement('div');
    value.className = 'compare-value ' + (p >= 0 ? 'pos' : 'neg');
    value.textContent = fmtMoneySign(p);

    row.appendChild(label);
    row.appendChild(barWrap);
    row.appendChild(value);
    container.appendChild(row);
  });

  document.getElementById('compare-qty-label').textContent =
    qty + (qty === 1 ? ' print' : ' prints');
}

/* ── Table ── */
function buildTable() {
  var tbody = document.getElementById('breakdown-body');
  tbody.innerHTML = '';
  var f = fixed();
  var v = varex();

  sizes.forEach(function (s, i) {
    var delShare = f / Math.max(qty, 1);
    var ctb = costPP(s, qty);
    var profit = profitPP(s, qty);
    var m = marginPct(s, qty);
    var tag = profit >= 0
      ? '<span class="tag-pos">' + fmtMoneySign(profit) + '</span>'
      : '<span class="tag-neg">' + fmtMoney(profit) + '</span>';
    tag += '<span class="tag-margin">' + m.toFixed(0) + '%</span>';

    var tr = document.createElement('tr');
    if (i === sel) tr.className = 'active-row';
    tr.innerHTML =
      '<td>' + s.label + '</td>' +
      '<td>' + fmtMoney(s.ctp) + '</td>' +
      '<td>' + fmtMoney(delShare) + '</td>' +
      '<td>' + fmtMoney(v) + '</td>' +
      '<td>' + fmtMoney(ctb) + '</td>' +
      '<td>' + fmtMoney(s.price) + '</td>' +
      '<td>' + tag + '</td>';
    tr.style.cursor = 'pointer';
    (function (idx) {
      tr.addEventListener('click', function () { sel = idx; update(); });
    })(i);
    tbody.appendChild(tr);
  });

  document.getElementById('table-qty-label').textContent =
    qty + (qty === 1 ? ' print' : ' prints');
}

/* ── Slider fill ── */
function updateSliderFill() {
  var pct = ((qty - 1) / (MAX - 1)) * 100;
  document.getElementById('qty-slider').style.background =
    'linear-gradient(to right, #1a1a18 0%, #1a1a18 ' + pct + '%, #e0dfd9 ' + pct + '%, #e0dfd9 100%)';
}

/* ── Animate only when value changed ── */
function animIfChanged(id, val) {
  if (prevDisplay[id] !== val) {
    prevDisplay[id] = val;
    var el = document.getElementById(id);
    el.classList.remove('num-anim');
    void el.offsetWidth;
    el.classList.add('num-anim');
  }
}

/* ── Main update ── */
function update() {
  var s = sizes[sel];
  if (!s) return;

  var c     = costPP(s, qty);
  var p     = profitPP(s, qty);
  var t     = orderProfit(s, qty);
  var m     = marginPct(s, qty);
  var price = num(s.price);

  /* Quantity displays */
  document.getElementById('qty-out').textContent = qty;
  document.getElementById('qty-plural').textContent = qty === 1 ? '' : 's';
  document.getElementById('m-qty').textContent = qty;

  /* Size buttons */
  document.querySelectorAll('.size-btn').forEach(function (b, i) {
    b.className = 'size-btn' + (i === sel ? ' active' : '');
  });

  /* Legend */
  document.querySelectorAll('.legend-item').forEach(function (b, i) {
    b.className = 'legend-item' + (i === sel ? ' active' : '');
  });

  /* Chart */
  updateChartData();

  /* Hero */
  document.getElementById('hero-size').textContent = s.label;
  document.getElementById('hero-price').textContent = 'Sale price ' + fmtMoney(price);

  /* Revenue bar */
  var costPctOfPrice = price > 0 ? Math.min((c / price) * 100, 100) : 100;
  var profitPctOfPrice = Math.max(100 - costPctOfPrice, 0);

  document.getElementById('rb-cost-label').textContent = fmtMoney(c);
  document.getElementById('rb-profit-label').textContent = fmtMoney(Math.abs(p));
  document.getElementById('rb-profit-word').textContent = p >= 0 ? 'profit' : 'loss';

  var rbMarginEl = document.getElementById('rb-margin');
  if (p >= 0) {
    rbMarginEl.textContent = m.toFixed(1) + '% margin';
    rbMarginEl.style.color = 'var(--green)';
  } else {
    rbMarginEl.textContent = Math.abs(m).toFixed(1) + '% loss';
    rbMarginEl.style.color = 'var(--red)';
  }

  var rbCost = document.getElementById('rb-cost');
  var rbProfit = document.getElementById('rb-profit');

  if (p >= 0) {
    rbCost.style.width = costPctOfPrice + '%';
    rbCost.textContent = costPctOfPrice > 20 ? fmtMoney(c) : '';
    rbProfit.style.width = profitPctOfPrice + '%';
    rbProfit.style.background = 'var(--green)';
    rbProfit.textContent = profitPctOfPrice > 15 ? fmtMoneySign(p) : '';
  } else {
    rbCost.style.width = '100%';
    rbCost.textContent = fmtMoney(c) + ' cost > ' + fmtMoney(price) + ' price';
    rbProfit.style.width = '0%';
    rbProfit.style.background = 'var(--red)';
    rbProfit.textContent = '';
  }

  /* Cost stack */
  var printVal = num(s.ctp);
  var delVal   = fixed() / Math.max(qty, 1);
  var packVal  = num(packaging);
  var extraVal = num(extras);
  var totalCost = printVal + delVal + packVal + extraVal;

  function segPct(val) {
    if (totalCost === 0) return '25%';
    return Math.max((val / totalCost) * 100, 6) + '%';
  }

  document.getElementById('seg-print').style.width = segPct(printVal);
  document.getElementById('seg-print').style.background = COST_COLORS.print;
  document.getElementById('seg-print').textContent = (printVal / totalCost > 0.15) ? fmtMoney(printVal) : '';

  document.getElementById('seg-delivery').style.width = segPct(delVal);
  document.getElementById('seg-delivery').style.background = COST_COLORS.delivery;
  document.getElementById('seg-delivery').textContent = (delVal / totalCost > 0.12) ? fmtMoney(delVal) : '';

  document.getElementById('seg-packaging').style.width = segPct(packVal);
  document.getElementById('seg-packaging').style.background = COST_COLORS.packaging;
  document.getElementById('seg-packaging').textContent = '';

  document.getElementById('seg-extras').style.width = segPct(extraVal);
  document.getElementById('seg-extras').style.background = COST_COLORS.extras;
  document.getElementById('seg-extras').textContent = '';

  document.getElementById('cost-stack-legend').innerHTML =
    '<div class="cost-stack-legend-item"><span class="cost-stack-legend-dot" style="background:' + COST_COLORS.print + '"></span>Print ' + fmtMoney(printVal) + '</div>' +
    '<div class="cost-stack-legend-item"><span class="cost-stack-legend-dot" style="background:' + COST_COLORS.delivery + '"></span>Delivery ' + fmtMoney(delVal) + '</div>' +
    '<div class="cost-stack-legend-item"><span class="cost-stack-legend-dot" style="background:' + COST_COLORS.packaging + '"></span>Packaging ' + fmtMoney(packVal) + '</div>' +
    '<div class="cost-stack-legend-item"><span class="cost-stack-legend-dot" style="background:' + COST_COLORS.extras + '"></span>Extras ' + fmtMoney(extraVal) + '</div>';

  /* Metrics */
  var cppStr = fmtMoney(c);
  document.getElementById('m-cpp').textContent = cppStr;
  animIfChanged('m-cpp', cppStr);

  var pppStr = fmtMoneySign(p);
  var pppEl = document.getElementById('m-ppp');
  pppEl.className = 'metric-value ' + (p >= 0 ? 'pos' : 'neg');
  pppEl.textContent = pppStr;
  document.getElementById('m-ppp-sub').textContent =
    (m >= 0 ? '' : '-') + Math.abs(m).toFixed(1) + '% margin';
  animIfChanged('m-ppp', pppStr);

  var topStr = fmtMoneySign(t);
  var topEl = document.getElementById('m-top');
  topEl.className = 'metric-value ' + (t >= 0 ? 'pos' : 'neg');
  topEl.textContent = topStr;
  document.getElementById('m-top-sub').textContent =
    'on ' + qty + (qty === 1 ? ' print' : ' prints');
  animIfChanged('m-top', topStr);

  /* Slider */
  updateSliderFill();

  /* Break-even marker */
  var beVal = breakEven(s);
  var beMarker = document.getElementById('be-marker');
  if (beVal !== null && beVal > 1 && beVal <= MAX) {
    beMarker.style.left = 'calc(' + (((beVal - 1) / (MAX - 1)) * 100) + '% - 1px)';
    beMarker.style.opacity = '1';
  } else {
    beMarker.style.opacity = '0';
  }

  /* Break-even note */
  var noteEl = document.getElementById('be-note');
  if (beVal === null) {
    noteEl.className = 'be-note warn';
    noteEl.innerHTML = 'Sale price doesn\u2019t cover variable costs \u2014 <strong>unprofitable at any quantity</strong>.';
  } else if (beVal === 1) {
    noteEl.className = 'be-note ok';
    noteEl.innerHTML = 'Profitable from the <strong>first print</strong>. Each extra print adds ' + fmtMoney(num(s.price) - num(s.ctp) - varex()) + ' margin.';
  } else if (qty >= beVal) {
    noteEl.className = 'be-note ok';
    noteEl.innerHTML = 'Break-even at <strong>' + beVal + ' prints</strong>. You\u2019re above it \u2014 making <strong>' + fmtMoney(p) + ' profit per print</strong>.';
  } else {
    noteEl.className = 'be-note warn';
    noteEl.innerHTML = 'Break-even at <strong>' + beVal + ' prints</strong> per order. Need <strong>' + (beVal - qty) + ' more</strong> to turn a profit on this size.';
  }

  /* Bulk savings callout */
  var callout = document.getElementById('savings-callout');
  var calloutText = document.getElementById('savings-text');
  if (qty > 1) {
    var singleCost = costPP(s, 1);
    var bulkCost = c;
    var savedPerPrint = singleCost - bulkCost;
    var singleProfit = profitPP(s, 1);
    var profitGain = p - singleProfit;
    callout.className = 'savings-callout';
    calloutText.innerHTML =
      'Ordering <strong>' + qty + '</strong> instead of 1 saves <strong>' + fmtMoney(savedPerPrint) + '/print</strong> on delivery costs' +
      (profitGain > 0 ? ' \u2014 that\u2019s <strong>' + fmtMoneySign(profitGain) + ' more profit</strong> per print.' :
       singleProfit < 0 && p >= 0 ? ' \u2014 enough to <strong>turn a loss into profit</strong>.' : '.');
  } else {
    callout.className = 'savings-callout hidden';
  }

  /* Size comparison bars */
  updateCompareBars();

  /* Table */
  buildTable();

  /* Footer */
  document.getElementById('footer-text').innerHTML =
    'Fixed per order: ' + fmtMoney(delivery) + ' delivery + ' + fmtMoney(shipping) + ' shipping = ' + fmtMoney(fixed()) + ' spread across all prints<br>' +
    'Variable per print: print cost + ' + fmtMoney(packaging) + ' packaging + ' + fmtMoney(extras) + ' extras';
}

/* ── Event handlers ── */
function onSlider(v) {
  qty = parseInt(v, 10) || 1;
  update();
}

/* ── Attach settings input listeners ── */
document.getElementById('in-delivery').addEventListener('input', onSettingChange);
document.getElementById('in-shipping').addEventListener('input', onSettingChange);
document.getElementById('in-packaging').addEventListener('input', onSettingChange);
document.getElementById('in-extras').addEventListener('input', onSettingChange);

/* ── Init ── */
loadState();
populateSettingsInputs();
buildSizeEditor();
buildSizeButtons();
buildLegend();
rebuildChart();
update();
