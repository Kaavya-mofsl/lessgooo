// ════════════════════════════════════════════════════════════════════════════
//  NEWS — all news fetch/render functions + esc helper
// ════════════════════════════════════════════════════════════════════════════

var newsLoaded = false;

function initNewsView() {
  if (newsLoaded) return;
  newsLoaded = true;

  fetchMarketRecap();
  fetchHeadlines();
  fetchIPOData();
  fetchMacroData();
  fetchFIIDIIData();
  fetchBulkDealsData();

  // Scroll-triggered entrance for each section (per animation rule)
  var sections = document.querySelectorAll('#newsSection .news-terminal-section');
  if (sections.length) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('news-section-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.04 });
    sections.forEach(function(s) { io.observe(s); });
  }
}

function refreshNewsView() {
  // Spin the button icon while fetching
  var btn = document.getElementById('news-refresh-btn');
  if (btn) btn.classList.add('news-refresh-spinning');

  // Reset each section's HTML back to its initial placeholder state
  var resets = [
    ['news-headlines',
      '<div class="news-placeholder"><span class="material-symbols-outlined">newspaper</span>Headlines loading…</div>'],
    ['news-today',
      '<h2 class="news-terminal-heading">Today in Markets</h2>' +
      '<div class="news-placeholder"><span class="material-symbols-outlined">today</span>Today’s summary loading…</div>'],
    ['news-fiidii',
      '<h2 class="news-terminal-heading">FII / DII Activity</h2>' +
      '<p class="news-terminal-sub">Foreign and domestic institutional buying and selling flows across cash market segments.</p>' +
      '<div class="news-placeholder"><span class="material-symbols-outlined">account_balance</span>Institutional flow data loading…</div>'],
    ['news-bulkdeals',
      '<h2 class="news-terminal-heading">Bulk &amp; Block Deals</h2>' +
      '<p class="news-terminal-sub">Large trades reported on NSE and BSE — institutional block deals and bulk deal disclosures.</p>' +
      '<div class="news-placeholder"><span class="material-symbols-outlined">swap_horiz</span>Bulk &amp; block deals loading…</div>'],
    ['news-macro',
      '<div class="news-macro-hdr">' +
        '<h2 class="news-terminal-heading news-heading-inline">Global Capital Flow Terminal</h2>' +
        '<div class="news-macro-toggle-group">' +
          '<button class="news-macro-tbtn news-macro-tbtn-on" onclick="newsTerminalToggle(this,\'24H\')">24H</button>' +
          '<button class="news-macro-tbtn" onclick="newsTerminalToggle(this,\'7D\')">7D</button>' +
          '<button class="news-macro-tbtn" onclick="newsTerminalToggle(this,\'1M\')">1M</button>' +
        '</div>' +
      '</div>' +
      '<div class="news-placeholder"><span class="material-symbols-outlined">public</span>Macro data loading…</div>'],
    ['news-ipo',
      '<h2 class="news-terminal-heading">IPO Watch</h2>' +
      '<div class="news-placeholder"><span class="material-symbols-outlined">rocket_launch</span>IPO pipeline loading…</div>']
  ];

  resets.forEach(function(pair) {
    var el = document.getElementById(pair[0]);
    if (!el) return;
    el.innerHTML = pair[1];
    el.classList.remove('news-section-visible');
  });

  // Allow initNewsView to run again, then re-init
  newsLoaded = false;
  initNewsView();

  // Stop spinning after a short delay (data may still be fetching in background)
  setTimeout(function() {
    if (btn) btn.classList.remove('news-refresh-spinning');
  }, 1400);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripCDATA(str) {
  return String(str || '').replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim();
}

// Time period toggle for macro section (UI only)
function newsTerminalToggle(btn, period) {
  var group = btn.closest('.news-macro-toggle-group');
  if (!group) return;
  group.querySelectorAll('.news-macro-tbtn').forEach(function(b) {
    b.classList.remove('news-macro-tbtn-on');
  });
  btn.classList.add('news-macro-tbtn-on');
}

// ── HEADLINES — editorial layout ──────────────────────────────────────────
function fetchHeadlines() {
  var container = document.getElementById('news-headlines');
  if (!container) return;

  fetch(WORKER_URL + '/?action=news')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) placeholder.remove();

      var items = (data.items || []).filter(function(x) { return x.title && x.link; }).slice(0, 7);

      if (!items.length) {
        container.insertAdjacentHTML('beforeend',
          '<div class="news-error-state"><span class="material-symbols-outlined">info</span>No headlines available right now.</div>');
        return;
      }

      function timeAgo(pubDate) {
        if (!pubDate) return '';
        try {
          var d = new Date(pubDate);
          if (isNaN(d.getTime())) return '';
          var diffMs   = Date.now() - d.getTime();
          var diffMins = Math.floor(diffMs / 60000);
          if      (diffMins < 1)  return 'just now';
          else if (diffMins < 60) return diffMins + 'm ago';
          var diffHrs = Math.floor(diffMins / 60);
          if (diffHrs < 24) return diffHrs + 'h ago';
          return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } catch(e) { return ''; }
      }

      var featured = items[0];
      var cards    = items.slice(1, 6);

      var featuredSrc     = esc((featured.source || 'NEWS').toUpperCase());
      var featuredTitle   = esc(stripCDATA(featured.title));
      var featuredSnippet = featured.description
        ? esc(stripCDATA(featured.description).replace(/<[^>]*>/g,'').substring(0, 200))
        : '';
      var featuredTime    = timeAgo(featured.pubDate);

      // Build the image / fallback block for the featured article
      var featuredImgBlock;
      if (featured.image) {
        featuredImgBlock =
          '<a class="news-editorial-img-wrap" href="' + esc(featured.link) + '" target="_blank" rel="noopener noreferrer">' +
            '<img class="news-editorial-img" src="' + esc(featured.image) + '" alt="" loading="lazy" ' +
              'onerror="this.parentNode.classList.add(\'ne-img-err\')">' +
            '<span class="ne-fallback"><span class="news-editorial-img-src">' + featuredSrc + '</span></span>' +
          '</a>';
      } else {
        featuredImgBlock =
          '<a class="news-editorial-img-wrap ne-img-err" href="' + esc(featured.link) + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="ne-fallback"><span class="news-editorial-img-src">' + featuredSrc + '</span></span>' +
          '</a>';
      }

      var html =
        '<div class="news-editorial">' +
          '<div class="news-editorial-badges">' +
            '<span class="news-intel-badge">CRITICAL INTELLIGENCE</span>' +
            '<button class="news-refresh-btn" id="news-refresh-btn" onclick="refreshNewsView()" title="Refresh news &amp; market data"><span class="material-symbols-outlined">refresh</span>REFRESH</button>' +
          '</div>' +
          '<div class="news-editorial-grid">' +
            '<div class="news-editorial-featured">' +
              featuredImgBlock +
              '<h1 class="news-editorial-headline">' +
                '<a class="news-editorial-featured-link" href="' + esc(featured.link) + '" target="_blank" rel="noopener noreferrer">' +
                  featuredTitle +
                '</a>' +
              '</h1>' +
              (featuredSnippet ? '<p class="news-editorial-snippet">' + featuredSnippet + '</p>' : '') +
              '<div class="news-editorial-meta">' +
                '<span class="news-editorial-source">SOURCE: ' + featuredSrc + '</span>' +
                (featuredTime ? '<span class="news-editorial-sep">&nbsp;·&nbsp;</span><span class="news-editorial-time">' + esc(featuredTime) + '</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="news-editorial-cards">';

      cards.forEach(function(item) {
        var src     = esc((item.source || 'NEWS').toUpperCase());
        var title   = esc(stripCDATA(item.title));
        var snippet = item.description
          ? esc(stripCDATA(item.description).replace(/<[^>]*>/g,'').substring(0, 110))
          : '';
        html +=
          '<div class="news-card-item">' +
            '<span class="news-card-category">' + src + '</span>' +
            '<h3 class="news-card-title">' +
              '<a class="news-card-title-link" href="' + esc(item.link) + '" target="_blank" rel="noopener noreferrer">' + title + '</a>' +
            '</h3>' +
            (snippet ? '<p class="news-card-snippet">' + snippet + '</p>' : '') +
            '<a class="news-card-link" href="' + esc(item.link) + '" target="_blank" rel="noopener noreferrer">' +
              'READ FULL ANALYSIS <span class="material-symbols-outlined" style="font-size:11px;vertical-align:middle;margin-left:2px;">arrow_forward</span>' +
            '</a>' +
          '</div>';
      });

      html += '</div></div></div>';
      container.insertAdjacentHTML('beforeend', html);
    })
    .catch(function() {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) {
        placeholder.className = 'news-error-state';
        placeholder.innerHTML = '<span class="material-symbols-outlined">wifi_off</span>Could not load headlines — check connection or try again later.';
      }
    });
}

// ── TODAY IN MARKETS — index cards + mover tables ─────────────────────────
function fetchMarketRecap() {
  var container = document.getElementById('news-today');
  if (!container) return;

  fetch(WORKER_URL + '/?action=recap')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.error) throw new Error(data.error);

      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) placeholder.remove();

      var idx = data.indices || {};

      function fmtIdx(v, decimals) {
        if (v == null || v === undefined) return '—';
        return v.toLocaleString('en-IN', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }

      function idxCard(label, q) {
        if (!q || !q.price) {
          return '<div class="news-idx-card">' +
            '<p class="news-idx-label">' + esc(label) + '</p>' +
            '<p class="news-idx-value">—</p>' +
            '<div class="news-idx-change news-idx-flat">—</div>' +
            '</div>';
        }
        var chg  = q.change    || 0;
        var pct  = q.changePct || 0;
        var dir  = chg > 0 ? 'news-idx-up' : chg < 0 ? 'news-idx-down' : 'news-idx-flat';
        var icon = chg > 0 ? 'arrow_upward' : chg < 0 ? 'arrow_downward' : 'remove';
        var sign = chg >= 0 ? '+' : '';
        var chgStr = sign + fmtIdx(chg, 2) + ' (' + sign + fmtIdx(pct, 2) + '%)';
        return '<div class="news-idx-card">' +
          '<p class="news-idx-label">' + esc(label) + '</p>' +
          '<p class="news-idx-value">' + fmtIdx(q.price, 2) + '</p>' +
          '<div class="news-idx-change ' + dir + '">' +
            '<span class="material-symbols-outlined">' + icon + '</span>' +
            esc(chgStr) +
          '</div>' +
          '</div>';
      }

      var html = '<div class="news-idx-grid">';
      html += idxCard('NIFTY 50',   idx.nifty50);
      html += idxCard('BANK NIFTY', idx.bankNifty);
      html += idxCard('SENSEX',     idx.sensex);
      html += idxCard('INDIA VIX',  idx.indiaVix || null);
      html += '</div>';

      function moverTable(rows, isGain) {
        if (!rows || !rows.length) return '<p style="font-size:12px;color:var(--text-3)">No data</p>';
        var t = '<table class="news-mover-table"><thead><tr>' +
          '<th>SYMBOL</th><th>PRICE</th><th>CHG %</th>' +
          '</tr></thead><tbody>';
        rows.forEach(function(r) {
          var chgCls = isGain ? 'news-mt-chg-gain' : 'news-mt-chg-lose';
          var sign = r.changePct >= 0 ? '+' : '';
          t += '<tr>' +
            '<td><div class="news-mt-symbol">' + esc(r.symbol) +
              (r.name ? '<span class="news-mt-name">' + esc(r.name.substring(0, 22)) + '</span>' : '') +
            '</div></td>' +
            '<td class="news-mt-price">' + fmtIdx(r.price, 2) + '</td>' +
            '<td class="' + chgCls + '">' + sign + fmtIdx(r.changePct, 2) + '%</td>' +
            '</tr>';
        });
        t += '</tbody></table>';
        return t;
      }

      html += '<div class="news-movers-grid">';
      html += '<div class="news-mover-panel">' +
        '<h3 class="news-mover-heading news-mover-gain">TOP GAINERS</h3>' +
        moverTable(data.gainers, true) +
        '</div>';
      html += '<div class="news-mover-panel">' +
        '<h3 class="news-mover-heading news-mover-lose">TOP LOSERS</h3>' +
        moverTable(data.losers, false) +
        '</div>';
      html += '</div>';
      html += '<p class="news-source-note">Source: Yahoo Finance · 15-min delayed · NSE-listed equities</p>';

      container.insertAdjacentHTML('beforeend', html);
    })
    .catch(function() {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) {
        placeholder.className = 'news-error-state';
        placeholder.innerHTML = '<span class="material-symbols-outlined">wifi_off</span>Market recap unavailable — check connection or try again later.';
      }
    });
}

// ── IPO WATCH ─────────────────────────────────────────────────────────────
function fetchIPOData() {
  var container = document.getElementById('news-ipo');
  if (!container) return;

  fetch(WORKER_URL + '/?action=ipo')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) placeholder.remove();

      var calendar = data.calendar || [];
      var gmpList  = data.gmp     || [];

      if (!calendar.length && !gmpList.length) throw new Error('empty');

      function statusBadge(s) {
        var raw = (s || '').toLowerCase();
        var cls = 'ipo-badge ';
        if      (raw.indexOf('open')     === 0) cls += 'ipo-badge-open';
        else if (raw.indexOf('upcoming') === 0) cls += 'ipo-badge-upcoming';
        else if (raw.indexOf('allot')    === 0) cls += 'ipo-badge-allotted';
        else if (raw.indexOf('listed')   === 0) cls += 'ipo-badge-listed';
        else cls += 'ipo-badge-closed';
        return s ? '<span class="' + cls + '">' + esc(s) + '</span>' : '';
      }

      function statusRank(s) {
        var r = (s || '').toLowerCase();
        if (r.indexOf('open')     === 0) return 0;
        if (r.indexOf('upcoming') === 0) return 1;
        if (r.indexOf('allot')    === 0) return 2;
        return 3;
      }

      var calSorted = calendar.slice().sort(function(a, b) {
        return statusRank(a.status) - statusRank(b.status);
      }).slice(0, 10);
      var gmpSorted = gmpList.slice().sort(function(a, b) {
        return statusRank(a.status) - statusRank(b.status);
      }).slice(0, 10);

      var html = '';

      if (calSorted.length) {
        html += '<div class="news-ipo-card">';
        html += '<p class="news-ipo-label">CURRENT &amp; UPCOMING IPOs</p>';
        html += '<p class="ipo-count">' + calSorted.length + ' IPOs this month</p>';
        html += '<div class="ipo-scroll"><table class="ipo-cal-table">';
        html += '<thead><tr>' +
          '<th>COMPANY</th><th>OPENS</th><th>CLOSES</th>' +
          '<th>ALLOTMENT</th><th>LISTING</th><th>STATUS</th>' +
          '</tr></thead><tbody>';
        calSorted.forEach(function(r) {
          html += '<tr>' +
            '<td><span class="ipo-company">' + esc(r.company) + '</span>' +
              (r.type ? '<br><span class="ipo-type-tag">' + esc(r.type) + '</span>' : '') +
            '</td>' +
            '<td>' + esc(r.opens)     + '</td>' +
            '<td>' + esc(r.closes)    + '</td>' +
            '<td>' + esc(r.allotment) + '</td>' +
            '<td>' + esc(r.listing)   + '</td>' +
            '<td>' + statusBadge(r.status) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div>';
      }

      if (gmpSorted.length) {
        html += '<div class="news-ipo-card">';
        html += '<p class="news-ipo-label">GMP INTELLIGENCE (UNOFFICIAL)</p>';
        html += '<div class="ipo-scroll"><table class="ipo-gmp-table">';
        html += '<thead><tr>' +
          '<th>COMPANY</th><th>ISSUE PRICE</th><th>GMP</th>' +
          '<th>EST. LISTING</th><th>OPENS</th><th>CLOSES</th>' +
          '<th>SUBSCRIBED</th><th>STATUS</th>' +
          '</tr></thead><tbody>';

        gmpSorted.forEach(function(r) {
          var gmpStr = '—', gmpCls = 'ipo-gmp-zero';
          if (r.gmp !== null) {
            var sign = r.gmp > 0 ? '+' : '';
            var pct  = r.gmpPct !== null
              ? ' (' + (r.gmpPct >= 0 ? '+' : '') + r.gmpPct.toFixed(1) + '%)'
              : '';
            gmpStr = sign + '₹' + r.gmp.toFixed(2) + pct;
            gmpCls = r.gmp > 0 ? 'ipo-gmp-pos' : r.gmp < 0 ? 'ipo-gmp-neg' : 'ipo-gmp-zero';
          }
          var issueStr = r.issuePrice ? '₹' + r.issuePrice.toLocaleString('en-IN') : (r.priceBand !== '—' ? r.priceBand : '—');
          var estStr   = (r.estListing && r.estListing > 0)
            ? '₹' + r.estListing.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—';
          html += '<tr>' +
            '<td><span class="ipo-company">' + esc(r.company) + '</span></td>' +
            '<td>' + esc(issueStr) + '</td>' +
            '<td class="' + gmpCls + '">' + esc(gmpStr) + '</td>' +
            '<td>' + esc(estStr) + '</td>' +
            '<td>' + esc(r.opens)  + '</td>' +
            '<td>' + esc(r.closes) + '</td>' +
            '<td>' + esc(r.subscription) + '</td>' +
            '<td>' + statusBadge(r.status) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
        html += '</div>';
      }

      html += '<div class="news-gmp-disclaimer">' +
        '<span class="material-symbols-outlined">warning</span>' +
        '<p><strong>Grey market data is unofficial.</strong> GMP figures are sourced from grey market operators — they are not regulated, not guaranteed, and do not predict actual listing prices. Use for reference only.</p>' +
        '</div>';
      html += '<p class="news-source-note">Calendar &amp; GMP: ipocracker.com · GMP is unofficial grey market data · Updated multiple times daily</p>';

      container.insertAdjacentHTML('beforeend', html);
    })
    .catch(function() {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) {
        placeholder.className = 'news-error-state';
        placeholder.innerHTML = '<span class="material-symbols-outlined">wifi_off</span>IPO data unavailable — try again later.';
      }
    });
}

// ── GLOBAL CAPITAL FLOW TERMINAL ──────────────────────────────────────────
function fetchMacroData() {
  var container = document.getElementById('news-macro');
  if (!container) return;

  fetch(WORKER_URL + '/?action=macro')
    .then(function(res) { return res.json(); })
    .then(function(d) {
      if (d.error) throw new Error(d.error);

      var tiles = [
        { key: 'usdinr', label: 'USD / INR',   prefix: '₹', suffix: '',      decimals: 2 },
        { key: 'brent',  label: 'BRENT CRUDE', prefix: '$', suffix: ' /bbl', decimals: 2 },
        { key: 'sp500',  label: 'S&P 500',      prefix: '',  suffix: '',      decimals: 2 },
        { key: 'nasdaq', label: 'NASDAQ',        prefix: '',  suffix: '',      decimals: 2 },
      ];

      var metricsHTML = '<div class="news-macro-metrics">';
      tiles.forEach(function(t) {
        var q = d[t.key] || {};
        if (!q.price) {
          metricsHTML += '<div class="news-macro-panel">' +
            '<p class="news-macro-label">' + t.label + '</p>' +
            '<p class="news-macro-value">—</p>' +
            '<p class="news-macro-chg" style="color:#717171">—</p>' +
            '</div>';
          return;
        }
        var val    = q.price.toLocaleString('en-IN', { minimumFractionDigits: t.decimals, maximumFractionDigits: t.decimals });
        var chg    = q.change    || 0;
        var sign   = chg >= 0 ? '+' : '';
        var chgStr = sign + chg.toFixed(2) + ' vs Prev';
        var chgCls = chg > 0 ? 'news-pos' : chg < 0 ? 'news-neg' : '';
        metricsHTML +=
          '<div class="news-macro-panel">' +
            '<p class="news-macro-label">' + t.label + '</p>' +
            '<p class="news-macro-value">' + t.prefix + val + t.suffix + '</p>' +
            '<p class="news-macro-chg ' + chgCls + '">' + chgStr + '</p>' +
          '</div>';
      });
      metricsHTML += '</div>';

      var chartHTML =
        '<div class="news-macro-chart-wrap">' +
          '<div class="news-chart-legend">' +
            '<div class="news-chart-legend-item">' +
              '<span class="news-chart-dot"></span>' +
              '<span>DEVELOPED MARKETS</span>' +
            '</div>' +
            '<div class="news-chart-legend-item">' +
              '<span class="news-chart-dash"></span>' +
              '<span>EMERGING MARKETS</span>' +
            '</div>' +
          '</div>' +
          '<div class="news-chart-area">' +
            '<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="news-chart-svg">' +
              '<path d="M0,80 Q10,70 20,85 T40,60 T60,80 T80,30 T100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-dasharray="2,2" stroke-width="0.6"/>' +
              '<path d="M0,70 Q15,40 30,80 T60,20 T80,90 T100,60" fill="none" stroke="#C17F3A" stroke-width="1.5"/>' +
            '</svg>' +
          '</div>' +
        '</div>';

      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) placeholder.remove();
      container.insertAdjacentHTML('beforeend', metricsHTML + chartHTML);
      container.insertAdjacentHTML('beforeend', '<p class="news-source-note">Prices from Yahoo Finance · delayed · USD unless noted</p>');
    })
    .catch(function() {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) {
        placeholder.className = 'news-error-state';
        placeholder.innerHTML = '<span class="material-symbols-outlined">wifi_off</span>Could not load macro data — try again later.';
      }
    });
}

// ── BULK / BLOCK DEALS — unchanged ────────────────────────────────────────
function fetchBulkDealsData() {
  var container = document.getElementById('news-bulkdeals');
  if (!container) return;

  fetch(WORKER_URL + '/?action=bulkdeals')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var deals = data.deals || [];
      if (!deals.length) throw new Error('empty');

      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) placeholder.remove();

      var wrap = document.createElement('div');
      wrap.className = 'bd-wrap';
      container.appendChild(wrap);

      var sortCol = 'date';
      var sortAsc = false;

      function parseDate(s) {
        var mo = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
        var p = String(s||'').toUpperCase().split('-');
        return p.length < 3 ? 0 : new Date(+p[2], mo[p[1]]||0, +p[0]).getTime();
      }

      function fmtQty(n) {
        if (!n) return '—';
        return n.toLocaleString('en-IN');
      }
      function fmtPrice(n) {
        if (!n) return '—';
        return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      var cols = [
        { key:'date',    label:'Date',    num:false },
        { key:'symbol',  label:'Symbol',  num:false },
        { key:'client',  label:'Client',  num:false },
        { key:'side',    label:'B / S',   num:false },
        { key:'qty',     label:'Qty',     num:true  },
        { key:'price',   label:'Price',   num:true  },
        { key:'type',    label:'Type',    num:false },
      ];

      function render() {
        var sorted = deals.slice().sort(function(a, b) {
          var va = a[sortCol], vb = b[sortCol];
          if (sortCol === 'date') { va = parseDate(va); vb = parseDate(vb); }
          var cmp = (typeof va === 'number' && typeof vb === 'number')
            ? (va - vb)
            : String(va).localeCompare(String(vb));
          return sortAsc ? cmp : -cmp;
        });

        var h = '<p class="bd-count">' + sorted.length + ' deals &nbsp;·&nbsp; last 7 days</p>';
        h += '<div class="bd-scroll"><table class="bd-table"><thead><tr>';

        cols.forEach(function(c) {
          var cls = c.key === sortCol ? (sortAsc ? ' sort-asc' : ' sort-desc') : '';
          h += '<th class="' + cls + '" data-col="' + c.key + '">' + c.label + '</th>';
        });
        h += '</tr></thead><tbody>';

        sorted.forEach(function(d) {
          var sideCls = d.side === 'BUY' || d.side === 'B' ? 'bd-buy' : 'bd-sell';
          var sideLabel = d.side === 'BUY' || d.side === 'B' ? 'BUY' : 'SELL';
          var typeBadge = d.type === 'Bulk'
            ? '<span class="bd-badge bd-badge-bulk">Bulk</span>'
            : '<span class="bd-badge bd-badge-block">Block</span>';
          h += '<tr>' +
            '<td>' + esc(d.date) + '</td>' +
            '<td>' + esc(d.symbol) + '</td>' +
            '<td class="bd-client">' + esc(d.client) + '</td>' +
            '<td class="' + sideCls + '">' + sideLabel + '</td>' +
            '<td>' + fmtQty(d.qty) + '</td>' +
            '<td>' + fmtPrice(d.price) + '</td>' +
            '<td>' + typeBadge + '</td>' +
            '</tr>';
        });

        h += '</tbody></table></div>';
        h += '<p class="bd-source">Source: NSE India · Cash Market · Last 7 calendar days</p>';

        wrap.innerHTML = h;

        wrap.querySelectorAll('th[data-col]').forEach(function(th) {
          th.addEventListener('click', function() {
            var col = th.dataset.col;
            if (sortCol === col) { sortAsc = !sortAsc; }
            else { sortCol = col; sortAsc = col === 'symbol' || col === 'client'; }
            render();
          });
        });
      }

      render();
    })
    .catch(function() {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) {
        placeholder.className = 'news-error-state';
        placeholder.innerHTML = '<span class="material-symbols-outlined">wifi_off</span>' +
          'Bulk/block deal data unavailable — NSE may be updating. Try after market hours.';
      }
    });
}

// ── FII / DII ACTIVITY ────────────────────────────────────────────────────
function fetchFIIDIIData() {
  var container = document.getElementById('news-fiidii');
  if (!container) return;

  fetch(WORKER_URL + '/?action=fiidii')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var rows = data.rows || [];
      if (!rows.length) throw new Error('empty');

      function fmtCr(n) {
        if (n == null) return '—';
        return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      var date = rows[0].date || '';
      var html = '<div class="news-fiidii-card">';
      html += '<div class="news-fiidii-meta">';
      if (date) html += '<p class="news-fiidii-date-label">As of ' + esc(date) + ' &nbsp;·&nbsp; Cash Market &nbsp;·&nbsp; ₹ Crore</p>';
      html += '</div>';

      html += '<div class="news-fiidii-scroll"><table class="news-fiidii-tbl"><thead><tr>' +
        '<th>CATEGORY</th><th>BUY</th><th>SELL</th><th>NET</th>' +
        '</tr></thead><tbody>';

      rows.forEach(function(row) {
        var netCls  = row.net > 0 ? 'news-pos' : row.net < 0 ? 'news-neg' : '';
        var netSign = row.net > 0 ? '+' : '';
        html += '<tr>' +
          '<td>' + esc(row.category) + '</td>' +
          '<td>' + fmtCr(row.buy)  + '</td>' +
          '<td>' + fmtCr(row.sell) + '</td>' +
          '<td class="' + netCls + '">' + (row.net !== null ? netSign + fmtCr(row.net) : '—') + '</td>' +
          '</tr>';
      });

      html += '</tbody></table></div></div>';
      html += '<p class="news-source-note">Source: NSE India · Provisional · Updated after market close</p>';

      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) placeholder.remove();
      container.insertAdjacentHTML('beforeend', html);
    })
    .catch(function() {
      var placeholder = container.querySelector('.news-placeholder');
      if (placeholder) {
        placeholder.className = 'news-error-state';
        placeholder.innerHTML = '<span class="material-symbols-outlined">wifi_off</span>' +
          'FII/DII data unavailable — NSE may be updating. Check back after 7 PM IST.';
      }
    });
}

