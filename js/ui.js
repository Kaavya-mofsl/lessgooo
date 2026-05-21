// ════════════════════════════════════════════════════════════════════════════
//  UI — State, view switching, form handlers, grade helpers, renderResults,
//       GSAP animations, nav tab switching, initLearnView, showTool
// ════════════════════════════════════════════════════════════════════════════

// ── APP STATE ──────────────────────────────────────────────
let analysisResult = null;
let companyInputData = null;
let radarChartInstance = null;

// ── Hero helpers ───────────────────────────────────────
function heroScrollTop() {
  var hero = document.getElementById('heroSection');
  return (hero && hero.style.display !== 'none') ? hero.offsetTop + hero.offsetHeight : 0;
}

function hideHero() {
  var hero = document.getElementById('heroSection');
  var brand = document.getElementById('heroBranding');
  if (hero) hero.style.display = 'none';
  if (brand) brand.style.display = 'none';
  // Kill the hero-scroll nav trigger so it can't re-hide the nav
  if (typeof navHeroTrigger !== 'undefined' && navHeroTrigger) {
    navHeroTrigger.kill();
    navHeroTrigger = null;
  }
  gsap.killTweensOf('#mainNav');
  gsap.set('#mainNav', { y: 0, opacity: 1 });
}

function showHero() {
  var hero = document.getElementById('heroSection');
  var brand = document.getElementById('heroBranding');
  if (hero) hero.style.display = '';
  if (brand) brand.style.display = '';
  ['analyzerSection','toolsSection','learnSection','newsSection'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var footer = document.getElementById('siteFooter');
  if (footer) footer.style.display = 'none';
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  gsap.killTweensOf('#mainNav');
  gsap.set('#mainNav', { y: -60, opacity: 0 });
  // Re-create the nav scroll trigger now that hero is visible again
  navHeroTrigger = ScrollTrigger.create({
    trigger: '#heroSection',
    start: 'bottom top',
    onEnter: function() {
      gsap.to('#mainNav', { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
    },
    onLeaveBack: function() {
      gsap.to('#mainNav', { y: -60, opacity: 0, duration: 0.35, ease: 'power2.in' });
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function heroNavTo(sectionId, viewId) {
  var tab = document.querySelector('[data-section="' + sectionId + '"]');
  if (tab) tab.click();
  if (viewId) showView(viewId);
}

// ── View switcher ──────────────────────────────────────
function showView(v) {
  document.getElementById('inputView').classList.toggle('hidden', v !== 'input');
  document.getElementById('loadingView').classList.toggle('hidden', v !== 'loading');
  document.getElementById('resultsView').classList.toggle('hidden', v !== 'results');
  document.getElementById('compareResultsView').classList.toggle('hidden', v !== 'compareResults');
  const ph = document.getElementById('comparePlaceholder');
  if (ph) ph.classList.add('hidden');
  window.scrollTo({ top: heroScrollTop(), behavior: 'smooth' });
  if (v === 'results') { initResultsAnimations(); initFloatingPaths('resultsView'); }
}

// ── Compare handler ────────────────────────────────────
async function handleCompare() {
  hideFormError();

  const symbolA = (document.getElementById('symbolA').value || '').trim().toUpperCase();
  const symbolB = (document.getElementById('symbolB').value || '').trim().toUpperCase();

  if (!symbolA || !symbolB) {
    showFormError('Please enter both company symbols.');
    return;
  }

  showView('loading');

  try {
    const [rawA, rawB] = await Promise.all([
      fetchScreenerData(symbolA),
      fetchScreenerData(symbolB)
    ]);

    window.compareDataA = mapScreenerData(rawA, {});
    window.compareDataB = mapScreenerData(rawB, {});

    console.log('Company A mapped data:', window.compareDataA);
    console.log('Company B mapped data:', window.compareDataB);

    runCompareAnalysis();

  } catch (err) {
    showView('input');
    showFormError(err.message || 'Failed to fetch data. Please try again.');
  }
}

function showFormError(msg) {
  const wrap = document.getElementById('formError');
  wrap.querySelector('p').textContent = msg;
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideFormError() {
  document.getElementById('formError').classList.add('hidden');
}

// ── Render results ─────────────────────────────────────
function renderResults() {
  const a = analysisResult;
  const dims = ['size','usefulness','strength','versatility','composition','capacity'];

  // Company header
  document.getElementById('resultCompanyName').textContent = companyInputData.companyName;
  document.getElementById('resultIndustry').textContent =
    companyInputData.industry + ' · Rs.' + Number(companyInputData.stockPrice).toLocaleString('en-IN') + ' per share';

  // Mini scores
  const idMap = { size:'scoreSize', usefulness:'scoreUsefulness', strength:'scoreStrength',
                  versatility:'scoreVersatility', composition:'scoreComposition', capacity:'scoreCapacity' };
  dims.forEach(d => {
    document.getElementById(idMap[d]).textContent = a.dimensions[d].score + '/10';
  });

  // Score ring
  const circumference = 2 * Math.PI * 58; // 364.42
  document.getElementById('totalScoreDisplay').textContent = a.totalScore;
  setTimeout(() => {
    const arc = document.getElementById('scoreArc');
    arc.style.strokeDashoffset = circumference * (1 - a.totalScore / 60);
    arc.style.stroke = gradeColor(a.grade);
  }, 80);

  // Grade badge
  const badge = document.getElementById('gradeBadge');
  badge.textContent = gradeEmoji(a.grade) + ' ' + a.grade;
  badge.style.background = gradeColor(a.grade);
  badge.style.color = gradeTextColor(a.grade);

  // Radar chart
  buildRadarChart(dims.map(d => a.dimensions[d].score));

  // Dimension cards - using Stitch card style
  const dimLabels = {
    size:'Size', usefulness:'Usefulness', strength:'Strength',
    versatility:'Versatility', composition:'Composition', capacity:'Capacity'
  };
  const container = document.getElementById('dimCards');
  container.innerHTML = '';
  dims.forEach(d => {
    const dim = a.dimensions[d];
    const card = document.createElement('div');
    card.className = 'bg-surface-container-low border border-outline-variant rounded-lg p-md space-y-sm';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-label-lg text-primary">${dimLabels[d]}</h4>
        <span class="score-pill">${dim.score}/10</span>
      </div>
      <p class="font-body-md text-on-surface-variant" style="line-height:1.7;">${dim.reasoning}</p>
      ${dim.score < 6 && dim.improvementNote ? `
        <div class="improvement-note">
          <p class="font-label-lg text-on-error-container mb-xs">⚠ Improvement Note</p>
          <p class="font-body-md text-on-error-container" style="font-size:14px;line-height:1.6;">${dim.improvementNote}</p>
        </div>` : ''}
    `;
    container.appendChild(card);
  });

  // Summary & guidance
  document.getElementById('investmentSummary').textContent = a.investmentSummary;
  document.getElementById('investorGuidance').textContent = a.investorGuidance;
}

// ── Grade helpers ───────────────────────────────────────────
function gradeColor(g) {
  return { 'Elite Box':'#F5A623', 'Strong Box':'#F5A623',
           'Average Box':'#F5A623', 'Weak Box':'#EF4444', 'Poor Box':'#EF4444' }[g] || '#F5A623';
}
function gradeTextColor(g) {
  return { 'Weak Box':'#ffffff', 'Poor Box':'#ffffff' }[g] || '#0F0F0F';
}
function gradeEmoji(g) {
  return { 'Elite Box':'🟢', 'Strong Box':'🔵', 'Average Box':'🟡', 'Weak Box':'🟠', 'Poor Box':'🔴' }[g] || '';
}

// ── Analyze Another Company ────────────────────────────
document.getElementById('analyzeAnotherBtn').addEventListener('click', () => {
  analysisResult = null;
  companyInputData = null;
  hideFormError();
  if (radarChartInstance) { radarChartInstance.destroy(); radarChartInstance = null; }
  showView('input');
});

// ── PDF Generation ─────────────────────────────────────
document.getElementById('downloadPdfBtn').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const a = analysisResult;
  const dims = ['size','usefulness','strength','versatility','composition','capacity'];
  const dimLabels = { size:'Size', usefulness:'Usefulness', strength:'Strength',
                      versatility:'Versatility', composition:'Composition', capacity:'Capacity' };
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const usable = W - M * 2;
  let y = M;

  const NAVY  = [0, 18, 86];
  const AMBER = [131, 85, 0];
  const GOLD  = [254, 174, 44];
  const MUTED = [100, 108, 125];
  const BODY  = [45, 49, 52];

  function newPage() { doc.addPage(); y = M; }
  function guard(need) { if (y + need > H - 18) newPage(); }

  function hline(yy, col) {
    doc.setDrawColor(...(col || [198, 197, 210]));
    doc.setLineWidth(0.3);
    doc.line(M, yy, W - M, yy);
  }

  function block(text, x, maxW, size, style, color, lh) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style || 'normal');
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ''), maxW);
    lines.forEach(ln => { guard(lh + 2); doc.text(ln, x, y); y += lh; });
  }

  function addFooters() {
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(
        'Generated by BOX Theory Analyzer  |  For educational purposes only. Not financial advice.',
        M, H - 8
      );
      doc.text('Page ' + i + ' of ' + total, W - M, H - 8, { align: 'right' });
    }
  }

  // ── Page 1: Title ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, H, 'F');

  doc.setFillColor(...GOLD);
  doc.rect(0, 60, W, 2, 'F');
  doc.rect(0, H - 62, W, 2, 'F');

  doc.setFontSize(30); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text('BOX Theory', W/2, 80, { align:'center' });
  doc.setFontSize(22); doc.setTextColor(255,255,255);
  doc.text('Analysis Report', W/2, 93, { align:'center' });

  doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(185,195,255);
  doc.text(companyInputData.companyName, W/2, 118, { align:'center' });
  doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.setTextColor(150,160,200);
  doc.text(companyInputData.industry, W/2, 128, { align:'center' });
  doc.text(new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}), W/2, 138, { align:'center' });

  doc.setFontSize(18); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text(a.grade + '  |  ' + a.totalScore + '/60', W/2, 165, { align:'center' });

  // ── Page 2: Score table ──
  newPage();
  doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
  doc.text('Dimension Scores', M, y); y += 4;
  hline(y, GOLD); y += 10;

  // Table header
  doc.setFillColor(230, 232, 236);
  doc.rect(M, y - 5, usable, 9, 'F');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...MUTED);
  doc.text('Dimension', M + 3, y); doc.text('Score', M + 95, y); doc.text('Bar', M + 118, y);
  y += 10;

  dims.forEach((d, i) => {
    const sc = a.dimensions[d].score;
    if (i % 2 === 0) { doc.setFillColor(245, 247, 251); doc.rect(M, y-5, usable, 9, 'F'); }
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    doc.text(dimLabels[d], M + 3, y);
    doc.setTextColor(...AMBER);
    doc.text(sc + '/10', M + 95, y);
    const barW = (sc / 10) * 60;
    doc.setFillColor(...GOLD); doc.rect(M + 118, y - 4, barW, 5, 'F');
    doc.setDrawColor(...AMBER); doc.setLineWidth(0.3); doc.rect(M + 118, y - 4, 60, 5);
    y += 11;
  });

  y += 6; hline(y); y += 10;
  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
  doc.text('Total Score:', M, y); doc.setTextColor(...AMBER); doc.text(String(a.totalScore) + ' / 60', M + 35, y);
  y += 9;
  doc.setTextColor(...NAVY); doc.text('Grade:', M, y);
  doc.setTextColor(...AMBER); doc.text(a.grade, M + 20, y);
  y += 16; hline(y); y += 12;

  // ── Dimension analysis ──
  dims.forEach(d => {
    guard(40);
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
    doc.text(dimLabels[d] + '  -  ' + a.dimensions[d].score + '/10', M, y); y += 8;
    block(a.dimensions[d].reasoning, M, usable, 10, 'normal', BODY, 6);

    if (a.dimensions[d].score < 6 && a.dimensions[d].improvementNote) {
      guard(28);
      const noteLines = doc.splitTextToSize('Improvement Note: ' + a.dimensions[d].improvementNote, usable - 8);
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(147, 0, 10);
      noteLines.forEach((ln, ni) => {
        guard(10);
        doc.setFillColor(255, 218, 214);
        doc.rect(M, y - 4, usable, 7.5, 'F');
        doc.setTextColor(147, 0, 10);
        doc.text((ni === 0 ? '>> ' : '   ') + ln, M + 4, y);
        y += 5.5;
      });
      y += 4;
    }
    y += 4; guard(6); hline(y); y += 10;
  });

  // ── Investment Summary ──
  guard(40);
  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
  doc.text('Overall Investment Summary', M, y); y += 8;
  block(a.investmentSummary, M, usable, 10, 'normal', BODY, 6);
  y += 8; guard(6); hline(y); y += 12;

  // ── Investor Guidance ──
  guard(40);
  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
  doc.text('What Should the Investor Do?', M, y); y += 8;
  const guidLines = doc.splitTextToSize(a.investorGuidance, usable - 8);
  doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(107, 69, 0);
  guidLines.forEach(ln => {
    guard(10);
    doc.setFillColor(255, 221, 180);
    doc.rect(M, y - 4, usable, 8, 'F');
    doc.setTextColor(107, 69, 0);
    doc.text(ln, M + 4, y);
    y += 6;
  });

  addFooters();
  doc.save('BOX_Theory_' + companyInputData.companyName.replace(/\s+/g,'_') + '.pdf');
});

// ── Page-load entrance animations ────────────────────
gsap.registerPlugin(ScrollTrigger);

// Nav: hidden until user scrolls past the hero
gsap.set('#mainNav', { y: -60, opacity: 0 });
var navHeroTrigger = ScrollTrigger.create({
  trigger: '#heroSection',
  start: 'bottom top',
  onEnter: function() {
    gsap.to('#mainNav', { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
  },
  onLeaveBack: function() {
    gsap.to('#mainNav', { y: -60, opacity: 0, duration: 0.35, ease: 'power2.in' });
  }
});

// Hero content: staggered entrance on page load
gsap.set(['#heroHeadline', '#heroSubheading', '#heroCtaAnalyze', '#heroCtaLearn', '.hero-scroll-hint'], {
  y: 32, opacity: 0
});
gsap.to('#heroHeadline',    { y: 0, opacity: 1, duration: 0.85, ease: 'power2.out', delay: 0.25 });
gsap.to('#heroSubheading',  { y: 0, opacity: 1, duration: 0.85, ease: 'power2.out', delay: 0.45 });
gsap.to('#heroCtaAnalyze',  { y: 0, opacity: 1, duration: 0.75, ease: 'power2.out', delay: 0.62 });
gsap.to('#heroCtaLearn',    { y: 0, opacity: 1, duration: 0.75, ease: 'power2.out', delay: 0.74 });
gsap.to('.hero-scroll-hint',{ y: 0, opacity: 0.38, duration: 0.7, ease: 'power2.out', delay: 1.1 });

gsap.from('#inputView main > *', {
  y: 40, opacity: 0, duration: 0.8, ease: 'power2.out',
  stagger: 0.12, delay: 0.3
});

// ── Results animations ────────────────────────────────
function initResultsAnimations() {
  // Small delay to let DOM paint
  setTimeout(() => {
    const circumference = 2 * Math.PI * 58;

    // ── Grade badge: premium restyle ──
    const badge = document.getElementById('gradeBadge');
    if (badge) {
      const gradeText = badge.textContent.replace(/[🟢🔵🟡🟠🔴]\s*/u, '').trim();
      if (gradeText === 'Elite Box') {
        badge.style.background = 'linear-gradient(135deg, #F5A623, #FFD07A)';
        badge.style.color = '#0D1142';
        badge.style.border = 'none';
        badge.style.boxShadow = '0 0 20px rgba(245,166,35,0.4)';
      } else if (gradeText === 'Strong Box') {
        badge.style.background = '#161616';
        badge.style.color = '#F0EDE6';
        badge.style.border = '2px solid #7B9EBF';
        badge.style.boxShadow = '0 0 12px rgba(123,158,191,0.20)';
      } else if (gradeText === 'Average Box') {
        badge.style.background = 'rgba(245,166,35,0.15)';
        badge.style.color = '#FFD07A';
        badge.style.border = '1px solid rgba(245,166,35,0.4)';
      } else if (gradeText === 'Weak Box') {
        badge.style.background = 'rgba(239,68,68,0.15)';
        badge.style.color = '#FCA5A5';
        badge.style.border = '1px solid rgba(239,68,68,0.4)';
      } else {
        badge.style.background = 'rgba(239,68,68,0.2)';
        badge.style.color = '#FCA5A5';
        badge.style.border = '1px solid rgba(239,68,68,0.5)';
      }
    }

    // ── Score ring: animate via GSAP on ScrollTrigger ──
    const arc = document.getElementById('scoreArc');
    const scoreEl = document.getElementById('totalScoreDisplay');
    const targetScore = parseInt(scoreEl.textContent) || 0;
    const targetOffset = circumference * (1 - targetScore / 60);

    // Reset arc to hidden
    if (arc) {
      arc.style.strokeDashoffset = circumference;

      ScrollTrigger.create({
        trigger: arc,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(arc, {
            attr: { strokeDashoffset: targetOffset },
            duration: 1.6,
            ease: 'power2.out'
          });
        }
      });
    }

    // ── Score number count-up ──
    if (scoreEl) {
      const counter = { val: 0 };
      ScrollTrigger.create({
        trigger: scoreEl,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(counter, {
            val: targetScore,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: function() {
              scoreEl.textContent = Math.round(counter.val);
            }
          });
        }
      });
    }

    // ── Dimension cards: staggered alternating slide ──
    const cards = document.querySelectorAll('#dimCards > div');
    cards.forEach((card, i) => {
      gsap.from(card, {
        x: i % 2 === 0 ? -40 : 40,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          once: true
        },
        delay: i * 0.05
      });
    });

    // ── Radar: scale + fade ──
    const radarWrap = document.querySelector('#radarChart');
    if (radarWrap) {
      gsap.from(radarWrap, {
        scale: 0.95,
        opacity: 0,
        duration: 0.9,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: radarWrap,
          start: 'top 88%',
          once: true
        }
      });
    }

    // ── Summary card ──
    const summaryCard = document.getElementById('investmentSummary');
    if (summaryCard) {
      gsap.from(summaryCard.parentElement, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        delay: 0.15,
        scrollTrigger: {
          trigger: summaryCard,
          start: 'top 88%',
          once: true
        }
      });
    }

    // ── Guidance card ──
    const guidanceCard = document.getElementById('investorGuidance');
    if (guidanceCard) {
      gsap.from(guidanceCard.parentElement, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        delay: 0.25,
        scrollTrigger: {
          trigger: guidanceCard,
          start: 'top 88%',
          once: true
        }
      });
    }

    // Refresh ScrollTrigger after layout settles
    ScrollTrigger.refresh();
  }, 120);
}

// ── Nav tab switching ──
(function() {
  var tabs    = document.querySelectorAll('.nav-tab');
  var indicator = document.querySelector('.nav-indicator');
  var sections = {
    analyzerSection: document.getElementById('analyzerSection'),
    toolsSection:    document.getElementById('toolsSection'),
    learnSection:    document.getElementById('learnSection'),
    newsSection:     document.getElementById('newsSection')
  };

  // Order determines slide direction: later index = slide from right
  var tabOrder = ['learnSection', 'analyzerSection', 'toolsSection', 'newsSection'];
  var _transitioning = false;

  var learnAnimated = false;

  function moveIndicator(activeTab) {
    if (!indicator || !activeTab) return;
    indicator.style.left  = activeTab.offsetLeft + 'px';
    indicator.style.width = activeTab.offsetWidth + 'px';
  }

  // Position on load without transition
  var initialTab = document.querySelector('.nav-tab.active');
  if (initialTab && indicator) {
    indicator.style.transition = 'none';
    moveIndicator(initialTab);
    requestAnimationFrame(function() {
      indicator.style.transition = '';
    });
  }

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      if (_transitioning) return;
      var target = tab.dataset.section;

      // Find which section (if any) is currently visible
      var outgoing = null;
      var outgoingId = null;
      Object.keys(sections).forEach(function(id) {
        if (sections[id] && sections[id].style.display !== 'none') {
          outgoing = sections[id];
          outgoingId = id;
        }
      });

      if (outgoingId === target) return; // already on this tab

      _transitioning = true;
      hideHero();

      // Determine slide direction
      var prevIndex = tabOrder.indexOf(outgoingId);
      var nextIndex = tabOrder.indexOf(target);
      var isForward = (outgoingId === null || nextIndex >= prevIndex);
      var startX = isForward ? 100 : -100;
      var exitX  = isForward ? -100 : 100;

      // Update nav UI immediately
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      moveIndicator(tab);

      var incoming = sections[target];
      var host     = document.getElementById('sections-host');
      var hostH    = window.innerHeight;

      // Freeze the host to viewport height and clip horizontal overflow
      gsap.set(host, { overflow: 'hidden', height: hostH });

      function done() {
        // Restore host to natural flow
        gsap.set(host, { clearProps: 'overflow,height' });
        // Restore incoming section to normal flow
        gsap.set(incoming, { clearProps: 'position,top,left,width,height,zIndex,xPercent,opacity,transform' });
        // Hide and restore outgoing section
        if (outgoing) gsap.set(outgoing, { display: 'none', clearProps: 'position,top,left,width,height,zIndex,xPercent,transform' });
        window.scrollTo(0, 0);
        _transitioning = false;
        var footer = document.getElementById('siteFooter');
        if (footer) footer.style.display = '';
        if (target === 'learnSection') initLearnView();
        if (target === 'newsSection')  { initNewsView(); setTimeout(initNewsScrollAnimations, 100); }
        if (target === 'toolsSection') setTimeout(initToolsAnimations, 60);
      }

      if (outgoing) {
        // Pin both sections inside the host as absolute layers, then slide them
        gsap.set(outgoing, {
          position: 'absolute', top: 0, left: 0, width: '100%',
          height: hostH, zIndex: 49, xPercent: 0
        });
        gsap.set(incoming, {
          display: 'block', position: 'absolute', top: 0, left: 0,
          width: '100%', height: hostH, zIndex: 50, xPercent: startX
        });
        gsap.timeline({ onComplete: done })
          .to(incoming, { xPercent: 0,    duration: 0.44, ease: 'power2.inOut' }, 0)
          .to(outgoing, { xPercent: exitX, duration: 0.44, ease: 'power2.inOut' }, 0);
      } else {
        // Coming from hero — slide in from the side with a soft fade
        gsap.set(incoming, {
          display: 'block', position: 'absolute', top: 0, left: 0,
          width: '100%', height: hostH, zIndex: 50, xPercent: startX, opacity: 0
        });
        gsap.to(incoming, { xPercent: 0, opacity: 1, duration: 0.4, ease: 'power2.out', onComplete: done });
      }
    });
  });

  function initLearnView() {
    if (!learnAnimated) {
      learnAnimated = true;

      // ── Intro section: headline + body fade up staggered ─────────────
      var introInner = document.querySelector('#learn-intro .lv-intro-inner');
      if (introInner) {
        var introEls = Array.from(introInner.children);
        introEls.forEach(function(el, i) {
          gsap.set(el, { opacity: 0, y: 20 });
        });
        ScrollTrigger.create({
          trigger: '#learn-intro',
          start: 'top 80%',
          once: true,
          onEnter: function() {
            introEls.forEach(function(el, i) {
              gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: i * 0.12 });
            });
          }
        });
      }

      // ── Dimension cards: per-element timed animations ─────────────────
      document.querySelectorAll('.lv-dim-card').forEach(function(card) {
        var illus     = card.querySelector('.lv-dim-illus');
        var label     = card.querySelector('.lv-dim-label');
        var headline  = card.querySelector('.lv-dim-headline');
        var body      = card.querySelector('.lv-dim-body');
        var highScore = card.querySelector('.lv-high-score');
        var metric    = card.querySelector('.lv-dim-metric');

        if (illus)     gsap.set(illus,     { opacity: 0, scale: 0.92 });
        if (label)     gsap.set(label,     { opacity: 0, y: 15 });
        if (headline)  gsap.set(headline,  { opacity: 0, y: 20 });
        if (body)      gsap.set(body,      { opacity: 0, y: 15 });
        if (highScore) gsap.set(highScore, { opacity: 0, y: 15 });
        if (metric)    gsap.set(metric,    { opacity: 0 });

        ScrollTrigger.create({
          trigger: card,
          start: 'top 78%',
          once: true,
          onEnter: function() {
            if (illus)     gsap.to(illus,     { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' });
            if (label)     gsap.to(label,     { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
            if (headline)  gsap.to(headline,  { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 0.1 });
            if (body)      gsap.to(body,      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.2 });
            if (highScore) gsap.to(highScore, { opacity: 0.72, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.25 });
            if (metric)    gsap.to(metric,    { opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.3 });
          }
        });
      });

      // ── CTA section ───────────────────────────────────────────────────
      var ctaHeadline = document.querySelector('#learn-cta .lv-cta-headline');
      var ctaBtn      = document.querySelector('#learn-cta .lv-cta-btn');
      if (ctaHeadline) gsap.set(ctaHeadline, { opacity: 0, y: 20 });
      if (ctaBtn)      gsap.set(ctaBtn,      { opacity: 0, y: 20 });
      if (ctaHeadline || ctaBtn) {
        ScrollTrigger.create({
          trigger: '#learn-cta',
          start: 'top 80%',
          once: true,
          onEnter: function() {
            if (ctaHeadline) gsap.to(ctaHeadline, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
            if (ctaBtn)      gsap.to(ctaBtn,      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.15 });
          }
        });
      }

      // ── Set every learn element to its initial hidden/below state ──
      gsap.set('.learn-hero-eyebrow, .learn-hero h1, .learn-hero-lead', { opacity: 0, y: 24 });
      gsap.set('#learnScoreRing', { opacity: 0, scale: 0.65, y: 0 });
      gsap.set('#learnSection .learn-section-header, #learnSection .learn-section-sub', { opacity: 0, y: 20 });
      gsap.set('.dim-card', { opacity: 0, y: 28 });
      gsap.set('.flow-step, .flow-arrow', { opacity: 0, y: 18 });
      gsap.set('#learnGradeScale', { opacity: 0, y: 20 });
      gsap.set('.tier-card', { opacity: 0, y: 24 });
      gsap.set('.example-header, .example-dim-row', { opacity: 0, y: 18 });
      gsap.set('#learnResultBox', { opacity: 0, y: 18 });
      gsap.set('.mistake-card', { opacity: 0, y: 22 });
      gsap.set('.learn-cta-wrap, .learn-disclaimer', { opacity: 0, y: 18 });

      // ── Hero text (eyebrow → h1 → lead) ──
      ['.learn-hero-eyebrow', '.learn-hero h1', '.learn-hero-lead'].forEach(function(sel, i) {
        var el = document.querySelector(sel);
        if (!el) return;
        ScrollTrigger.create({
          trigger: el, start: 'top 88%', once: true,
          onEnter: function() {
            gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: i * 0.1 });
          }
        });
      });

      // ── Score ring + count-up ──
      ScrollTrigger.create({
        trigger: '#learnScoreRing', start: 'top 88%', once: true,
        onEnter: function() {
          gsap.to('#learnScoreRing', { opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.7)' });
          var numEl = document.getElementById('learnScoreNum');
          if (numEl) {
            var obj = { val: 0 };
            gsap.to(obj, { val: 60, duration: 1.4, ease: 'power2.out', delay: 0.2,
              onUpdate: function() { numEl.textContent = Math.round(obj.val); }
            });
          }
        }
      });

      // ── Section headers and subs ──
      document.querySelectorAll('#learnSection .learn-section-header, #learnSection .learn-section-sub').forEach(function(el) {
        ScrollTrigger.create({
          trigger: el, start: 'top 88%', once: true,
          onEnter: function() { gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }); }
        });
      });

      // ── Dim cards ──
      document.querySelectorAll('.dim-card').forEach(function(card, i) {
        ScrollTrigger.create({
          trigger: card, start: 'top 88%', once: true,
          onEnter: function() {
            gsap.to(card, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', delay: (i % 2) * 0.09 });
          }
        });
      });

      // ── Flow steps and arrows ──
      document.querySelectorAll('.flow-step, .flow-arrow').forEach(function(el) {
        ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: function() { gsap.to(el, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }); }
        });
      });

      // ── Grade scale ──
      var gradeScale = document.getElementById('learnGradeScale');
      if (gradeScale) {
        ScrollTrigger.create({
          trigger: gradeScale, start: 'top 88%', once: true,
          onEnter: function() { gsap.to(gradeScale, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }); }
        });
      }

      // ── Tier cards ──
      document.querySelectorAll('.tier-card').forEach(function(card, i) {
        ScrollTrigger.create({
          trigger: card, start: 'top 88%', once: true,
          onEnter: function() {
            gsap.to(card, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', delay: i * 0.1 });
          }
        });
      });

      // ── Example header ──
      var exHeader = document.querySelector('.example-header');
      if (exHeader) {
        ScrollTrigger.create({
          trigger: exHeader, start: 'top 88%', once: true,
          onEnter: function() { gsap.to(exHeader, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }); }
        });
      }

      // ── Example dim rows + score bars + counter ──
      var exRows = document.querySelectorAll('#exDimRows .example-dim-row');
      var exTotal = document.getElementById('exTotalNum');
      if (exRows.length && exTotal) {
        var totalScore = 0;
        exRows.forEach(function(row) { totalScore += parseInt(row.dataset.score || 0); });
        ScrollTrigger.create({
          trigger: '#exDimRows', start: 'top 80%', once: true,
          onEnter: function() {
            exRows.forEach(function(row, i) {
              var score = parseInt(row.dataset.score || 0);
              var max   = parseInt(row.dataset.max || 10);
              var bar   = row.querySelector('.example-score-bar');
              gsap.to(row, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: i * 0.07 });
              if (bar) {
                gsap.to(bar, { width: (score / max * 100) + '%', duration: 0.9, ease: 'power2.out', delay: i * 0.08 });
              }
            });
            var obj2 = { val: 0 };
            gsap.to(obj2, { val: totalScore, duration: 1.2, ease: 'power2.out', delay: 0.3,
              onUpdate: function() { exTotal.textContent = Math.round(obj2.val); }
            });
          }
        });
      }

      // ── Result summary box ──
      var resultBox = document.getElementById('learnResultBox');
      if (resultBox) {
        ScrollTrigger.create({
          trigger: resultBox, start: 'top 88%', once: true,
          onEnter: function() { gsap.to(resultBox, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }); }
        });
      }

      // ── Mistake cards ──
      document.querySelectorAll('.mistake-card').forEach(function(card, i) {
        ScrollTrigger.create({
          trigger: card, start: 'top 90%', once: true,
          onEnter: function() {
            gsap.to(card, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: i * 0.07 });
          }
        });
      });

      // ── CTA + disclaimer ──
      document.querySelectorAll('.learn-cta-wrap, .learn-disclaimer').forEach(function(el) {
        ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: function() { gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }); }
        });
      });

    }

    // ── Watermark counter: 1 → 60 every time Learn is visited ───────────
    var wmNum = document.getElementById('lv-watermark-num');
    if (wmNum) {
      wmNum.textContent = '1';
      if (wmNum._gsapTween) wmNum._gsapTween.kill();
      var wmObj = { val: 1 };
      wmNum._gsapTween = gsap.to(wmObj, {
        val: 60,
        duration: 2,
        ease: 'power2.out',
        onUpdate: function() { wmNum.textContent = Math.round(wmObj.val); }
      });
    }

    ScrollTrigger.refresh();
  }

  // CTA button → switch to Analyzer tab
  var ctaBtn = document.getElementById('learnCtaBtn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', function() {
      var analyzerTab = document.querySelector('.nav-tab[data-section="analyzerSection"]');
      if (analyzerTab) analyzerTab.click();
    });
  }

  // ── Tool selector buttons ──
  var toolsLayout       = document.getElementById('toolsLayout');
  var toolsActiveContent = document.getElementById('toolsActiveContent');

  function showTool(value) {
    // Show/hide individual tool sections
    document.querySelectorAll('.tool-section').forEach(function(s) {
      s.classList.toggle('active', !!(value && s.id === 'tool-' + value));
    });
    // Toggle active button highlight
    document.querySelectorAll('.tool-select-btn').forEach(function(btn) {
      btn.classList.toggle('active', !!(value && btn.dataset.tool === value));
    });
    // Show content area + reorder layout
    if (toolsLayout)        toolsLayout.classList.toggle('has-active', !!value);
    if (toolsActiveContent) toolsActiveContent.style.display = value ? 'block' : 'none';
    if (value) window.scrollTo({ top: 0, behavior: 'smooth' });
    // Wire glow on any buttons just rendered into the active tool section
    if (value) setTimeout(function() { wireGlow(); }, 0);
  }

  // Wire glow effect for any button with .tool-btn-glow (runs once on load,
  // also exposed as window._wireGlow for tool sections rendered after load)
  function wireGlow(root) {
    (root || document).querySelectorAll('.tool-btn-glow').forEach(function(glow) {
      var btn = glow.parentElement;
      if (!btn || btn._glowWired) return;
      btn._glowWired = true;
      btn.addEventListener('mousemove', function(e) {
        var r = btn.getBoundingClientRect();
        glow.style.left = (e.clientX - r.left) + 'px';
        glow.style.top  = (e.clientY - r.top)  + 'px';
      });
      btn.addEventListener('mouseenter', function() { glow.classList.add('visible'); });
      btn.addEventListener('mouseleave', function() { glow.classList.remove('visible'); });
    });
  }
  wireGlow();
  window._wireGlow = wireGlow;

  var btnGrid = document.getElementById('toolsBtnGrid');
  if (btnGrid) {
    btnGrid.querySelectorAll('.tool-select-btn').forEach(function(btn) {
      var glow = btn.querySelector('.tool-btn-glow');

      // Glow follows the cursor
      btn.addEventListener('mousemove', function(e) {
        if (!glow) return;
        var r = btn.getBoundingClientRect();
        glow.style.left = (e.clientX - r.left) + 'px';
        glow.style.top  = (e.clientY - r.top)  + 'px';
      });
      btn.addEventListener('mouseenter', function() { if (glow) glow.classList.add('visible'); });
      btn.addEventListener('mouseleave', function() { if (glow) glow.classList.remove('visible'); });

      // Click: select or deselect
      btn.addEventListener('click', function() {
        var tool = btn.dataset.tool;
        showTool(btn.classList.contains('active') ? '' : tool);
      });
    });

    // Honour URL hash on load
    var hash = location.hash.replace('#', '');
    if (hash) showTool(hash);
  }
})();


// ════════════════════════════════════════════════════════════════════════════
//  PREMIUM UI UPGRADES — v2
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Custom cursor with smooth lag (desktop only) ──────────────────────
(function initCursor() {
  if (!window.matchMedia('(pointer: fine) and (hover: hover)').matches) return;
  var dot = document.getElementById('cursor-dot');
  if (!dot) return;
  var mx = window.innerWidth / 2, my = window.innerHeight / 2;
  var cx = mx, cy = my;
  document.addEventListener('mousemove', function(e) { mx = e.clientX; my = e.clientY; });
  (function loop() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    dot.style.left = cx + 'px';
    dot.style.top  = cy + 'px';
    requestAnimationFrame(loop);
  }());
}());

// ── 2. Number count-up via IntersectionObserver ──────────────────────────
(function initCountupObserver() {
  if (!window.IntersectionObserver || !window.gsap) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting || entry.target._counted) return;
      entry.target._counted = true;
      var el  = entry.target;
      var raw = (el.dataset.countup !== undefined) ? el.dataset.countup : el.textContent;
      var end = parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
      if (!end) return;
      var isInt = (end % 1 === 0);
      var obj = { val: 0 };
      gsap.to(obj, {
        val: end, duration: 2, ease: 'power2.out',
        onUpdate: function() {
          el.textContent = isInt ? Math.round(obj.val) : obj.val.toFixed(1);
        }
      });
      observer.unobserve(el);
    });
  }, { threshold: 0.3 });

  function observeCountups() {
    document.querySelectorAll('[data-countup]').forEach(function(el) {
      if (!el._counted) observer.observe(el);
    });
  }
  observeCountups();
  window.refreshCountup = observeCountups;
}());

// ── 3. Scroll animations for Tools section ───────────────────────────────
var _toolsAnimated = false;
function initToolsAnimations() {
  if (_toolsAnimated) return;
  _toolsAnimated = true;

  // Page header children fade up
  var hdr = document.querySelector('#toolsSection .tools-page-header');
  if (hdr) {
    gsap.from(hdr.children, {
      y: 30, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.1
    });
  }

  // Tool selector buttons stagger
  var btns = document.querySelectorAll('#toolsBtnGrid .tool-select-btn');
  btns.forEach(function(btn, i) {
    gsap.from(btn, {
      y: 30, opacity: 0, duration: 0.6, ease: 'power2.out',
      delay: i * 0.07,
      scrollTrigger: { trigger: btn, start: 'top 90%', once: true }
    });
  });
}

// ── 4. Scroll animations for News section header ─────────────────────────
var _newsHdrAnimated = false;
function initNewsScrollAnimations() {
  if (_newsHdrAnimated) return;
  _newsHdrAnimated = true;

  var hdr = document.querySelector('#newsSection .news-page-header');
  if (hdr) {
    gsap.from(hdr.children, {
      y: 30, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.1
    });
  }

  document.querySelectorAll('#newsSection .news-section').forEach(function(sec) {
    ScrollTrigger.create({
      trigger: sec, start: 'top 88%', once: true,
      onEnter: function() {
        gsap.from(sec, { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' });
      }
    });
  });
}

// ── Floating paths background ─────────────────────────────────────────────
function initFloatingPaths(containerId) {
  var container = document.getElementById(containerId);
  if (!container || container.querySelector('.bg-paths-canvas')) return;

  var NS     = 'http://www.w3.org/2000/svg';
  var COUNT  = 36;
  var SPREAD = 3.2; // px between lines — middle ground between tight and loose

  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 696 316');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');

  var allPaths = [];

  // Two crossing S-curve ribbon bundles.
  // Bundle A: lower-left → upper-right.  Bundle B: upper-left → lower-right.
  var bundles = [
    { sBase:  80, eBase: 230, c1dy: -90, c2dy:  90 },
    { sBase: 130, eBase: 200, c1dy: -85, c2dy:  85 }
  ];

  bundles.forEach(function(b) {
    for (var i = 0; i < COUNT; i++) {
      var off = (i - COUNT / 2) * SPREAD;
      var sy  = b.sBase + off;
      var ey  = b.eBase + off;
      var d   = 'M-210 ' + sy.toFixed(1) +
                ' C160 ' + (sy + b.c1dy).toFixed(1) +
                ' 536 '  + (ey + b.c2dy).toFixed(1) +
                ' 906 '  + ey.toFixed(1);

      var bOp = 0.05 + (i / (COUNT - 1)) * 0.10;
      var sw  = 0.35 + (i / (COUNT - 1)) * 0.65;

      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'white');
      path.setAttribute('stroke-width', sw.toFixed(2));
      path.setAttribute('stroke-opacity', (bOp * 0.5).toFixed(3));
      svg.appendChild(path);
      allPaths.push({ el: path, bOp: bOp });
    }
  });

  var wrap = document.createElement('div');
  wrap.className = 'bg-paths-canvas';
  wrap.appendChild(svg);
  container.insertBefore(wrap, container.firstChild);

  requestAnimationFrame(function() {
    allPaths.forEach(function(item) {
      var el  = item.el;
      var bOp = item.bOp;

      var len;
      try { len = el.getTotalLength(); } catch (e) { len = 0; }
      if (!len || len < 50) len = 1100;

      var dashLen  = len * 0.3;
      var gapLen   = len - dashLen;          // dash+gap = full period → seamless tiling
      var duration = 20 + Math.random() * 10;
      var startOff = -(Math.random() * len); // random phase per line

      gsap.set(el, { attr: {
        'stroke-dasharray':  dashLen.toFixed(1) + ' ' + gapLen.toFixed(1),
        'stroke-dashoffset': startOff
      }});

      // Continuous seamless flow
      gsap.to(el, {
        attr: { 'stroke-dashoffset': startOff - len },
        duration: duration,
        ease: 'none',
        repeat: -1
      });

      // Slow organic opacity pulse
      gsap.to(el, {
        attr: { 'stroke-opacity': bOp },
        duration: 8 + Math.random() * 6,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: Math.random() * 4
      });
    });
  });
}

// ── Hook new animations into existing nav tab clicks ─────────────────────
document.querySelectorAll('.nav-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    if (tab.dataset.section === 'toolsSection')  { setTimeout(initToolsAnimations, 60);  setTimeout(function() { initFloatingPaths('toolsSection'); }, 80); }
    if (tab.dataset.section === 'newsSection')   { setTimeout(initNewsScrollAnimations, 100); setTimeout(function() { initFloatingPaths('newsSection'); }, 80); }
    if (tab.dataset.section === 'analyzerSection') setTimeout(function() { initFloatingPaths('inputView'); }, 80);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  TICKER AUTOCOMPLETE — NSE symbol suggestions for symbolA / symbolB
// ════════════════════════════════════════════════════════════════════════════

var NSE_TICKERS = [
  // ── Nifty 50 ──────────────────────────────────────────
  { t:'ADANIENT',   n:'Adani Enterprises' },
  { t:'ADANIPORTS', n:'Adani Ports & SEZ' },
  { t:'APOLLOHOSP', n:'Apollo Hospitals' },
  { t:'ASIANPAINT', n:'Asian Paints' },
  { t:'AXISBANK',   n:'Axis Bank' },
  { t:'BAJAJ-AUTO', n:'Bajaj Auto' },
  { t:'BAJAJFINSV', n:'Bajaj Finserv' },
  { t:'BAJFINANCE', n:'Bajaj Finance' },
  { t:'BHARTIARTL', n:'Bharti Airtel' },
  { t:'BPCL',       n:'Bharat Petroleum' },
  { t:'BRITANNIA',  n:'Britannia Industries' },
  { t:'CIPLA',      n:'Cipla' },
  { t:'COALINDIA',  n:'Coal India' },
  { t:'DIVISLAB',   n:"Divi's Laboratories" },
  { t:'DRREDDY',    n:"Dr. Reddy's Laboratories" },
  { t:'EICHERMOT',  n:'Eicher Motors' },
  { t:'GRASIM',     n:'Grasim Industries' },
  { t:'HCLTECH',    n:'HCL Technologies' },
  { t:'HDFCBANK',   n:'HDFC Bank' },
  { t:'HDFCLIFE',   n:'HDFC Life Insurance' },
  { t:'HEROMOTOCO', n:'Hero MotoCorp' },
  { t:'HINDALCO',   n:'Hindalco Industries' },
  { t:'HINDUNILVR', n:'Hindustan Unilever' },
  { t:'ICICIBANK',  n:'ICICI Bank' },
  { t:'INDUSINDBK', n:'IndusInd Bank' },
  { t:'INFY',       n:'Infosys' },
  { t:'ITC',        n:'ITC' },
  { t:'JSWSTEEL',   n:'JSW Steel' },
  { t:'KOTAKBANK',  n:'Kotak Mahindra Bank' },
  { t:'LT',         n:'Larsen & Toubro' },
  { t:'M&M',        n:'Mahindra & Mahindra' },
  { t:'MARUTI',     n:'Maruti Suzuki' },
  { t:'NESTLEIND',  n:'Nestlé India' },
  { t:'NTPC',       n:'NTPC' },
  { t:'ONGC',       n:'Oil & Natural Gas Corporation' },
  { t:'POWERGRID',  n:'Power Grid Corporation' },
  { t:'RELIANCE',   n:'Reliance Industries' },
  { t:'SBILIFE',    n:'SBI Life Insurance' },
  { t:'SBIN',       n:'State Bank of India' },
  { t:'SHREECEM',   n:'Shree Cement' },
  { t:'SUNPHARMA',  n:'Sun Pharmaceutical' },
  { t:'TATACONSUM', n:'Tata Consumer Products' },
  { t:'TATAMOTORS', n:'Tata Motors' },
  { t:'TATASTEEL',  n:'Tata Steel' },
  { t:'TCS',        n:'Tata Consultancy Services' },
  { t:'TECHM',      n:'Tech Mahindra' },
  { t:'TITAN',      n:'Titan Company' },
  { t:'ULTRACEMCO', n:'UltraTech Cement' },
  { t:'UPL',        n:'UPL' },
  { t:'WIPRO',      n:'Wipro' },
  // ── Popular Midcaps & Others ───────────────────────────
  { t:'ABBOTINDIA', n:'Abbott India' },
  { t:'ABB',        n:'ABB India' },
  { t:'ADANIGREEN', n:'Adani Green Energy' },
  { t:'ADANIPOWER', n:'Adani Power' },
  { t:'ALKEM',      n:'Alkem Laboratories' },
  { t:'AMBUJACEM',  n:'Ambuja Cements' },
  { t:'AUROPHARMA', n:'Aurobindo Pharma' },
  { t:'BALKRISIND', n:'Balkrishna Industries' },
  { t:'BANDHANBNK', n:'Bandhan Bank' },
  { t:'BANKBARODA', n:'Bank of Baroda' },
  { t:'BERGEPAINT', n:'Berger Paints' },
  { t:'BIOCON',     n:'Biocon' },
  { t:'CANBK',      n:'Canara Bank' },
  { t:'CHOLAFIN',   n:'Cholamandalam Investment' },
  { t:'COFORGE',    n:'Coforge' },
  { t:'COLPAL',     n:'Colgate-Palmolive India' },
  { t:'CONCOR',     n:'Container Corporation of India' },
  { t:'CUMMINSIND', n:'Cummins India' },
  { t:'DABUR',      n:'Dabur India' },
  { t:'DMART',      n:'Avenue Supermarts (DMart)' },
  { t:'ESCORTS',    n:'Escorts Kubota' },
  { t:'EXIDEIND',   n:'Exide Industries' },
  { t:'FEDERALBNK', n:'Federal Bank' },
  { t:'FORTIS',     n:'Fortis Healthcare' },
  { t:'GAIL',       n:'GAIL (India)' },
  { t:'GLENMARK',   n:'Glenmark Pharmaceuticals' },
  { t:'GODREJCP',   n:'Godrej Consumer Products' },
  { t:'GODREJPROP', n:'Godrej Properties' },
  { t:'HAVELLS',    n:'Havells India' },
  { t:'IDFCFIRSTB', n:'IDFC First Bank' },
  { t:'INDIGO',     n:'IndiGo (InterGlobe Aviation)' },
  { t:'INDUSTOWER', n:'Indus Towers' },
  { t:'IOC',        n:'Indian Oil Corporation' },
  { t:'IRCTC',      n:'Indian Railway Catering & Tourism' },
  { t:'IRFC',       n:'Indian Railway Finance Corporation' },
  { t:'JINDALSTEL', n:'Jindal Steel & Power' },
  { t:'JUBLFOOD',   n:'Jubilant FoodWorks (Dominos)' },
  { t:'KPITTECH',   n:'KPIT Technologies' },
  { t:'LALPATHLAB', n:'Dr Lal PathLabs' },
  { t:'LICHSGFIN',  n:'LIC Housing Finance' },
  { t:'LICI',       n:'Life Insurance Corporation' },
  { t:'LTIM',       n:'LTIMindtree' },
  { t:'LTTS',       n:'L&T Technology Services' },
  { t:'LUPIN',      n:'Lupin' },
  { t:'MANAPPURAM', n:'Manappuram Finance' },
  { t:'MARICO',     n:'Marico' },
  { t:'MAXHEALTH',  n:'Max Healthcare' },
  { t:'METROPOLIS', n:'Metropolis Healthcare' },
  { t:'MOTHERSON',  n:'Samvardhana Motherson' },
  { t:'MPHASIS',    n:'Mphasis' },
  { t:'MUTHOOTFIN', n:'Muthoot Finance' },
  { t:'NHPC',       n:'NHPC' },
  { t:'NMDC',       n:'NMDC' },
  { t:'NYKAA',      n:'FSN E-Commerce (Nykaa)' },
  { t:'OBEROIRLTY', n:'Oberoi Realty' },
  { t:'PAGEIND',    n:'Page Industries (Jockey)' },
  { t:'PAYTM',      n:'One97 Communications (Paytm)' },
  { t:'PFC',        n:'Power Finance Corporation' },
  { t:'PERSISTENT', n:'Persistent Systems' },
  { t:'PETRONET',   n:'Petronet LNG' },
  { t:'PIDILITIND', n:'Pidilite Industries' },
  { t:'PNB',        n:'Punjab National Bank' },
  { t:'POLICYBZR',  n:'PB Fintech (PolicyBazaar)' },
  { t:'RECLTD',     n:'REC Limited' },
  { t:'SAIL',       n:'Steel Authority of India' },
  { t:'SIEMENS',    n:'Siemens India' },
  { t:'SJVN',       n:'SJVN' },
  { t:'STAR',       n:'Star Health Insurance' },
  { t:'SUZLON',     n:'Suzlon Energy' },
  { t:'TATACHEM',   n:'Tata Chemicals' },
  { t:'TATACOMM',   n:'Tata Communications' },
  { t:'TATAELXSI',  n:'Tata Elxsi' },
  { t:'TATAPOWER',  n:'Tata Power' },
  { t:'TORNTPHARM', n:'Torrent Pharmaceuticals' },
  { t:'TRENT',      n:'Trent (Westside / Zudio)' },
  { t:'UNIONBANK',  n:'Union Bank of India' },
  { t:'VBL',        n:'Varun Beverages' },
  { t:'VEDL',       n:'Vedanta' },
  { t:'VOLTAS',     n:'Voltas' },
  { t:'YESBANK',    n:'Yes Bank' },
  { t:'ZOMATO',     n:'Zomato' },
  { t:'ZYDUSLIFE',  n:'Zydus Lifesciences' },
];

function initTickerAutocomplete() {
  var pairs = [
    { inputId: 'symbolA', dropId: 'acA' },
    { inputId: 'symbolB', dropId: 'acB' },
  ];

  pairs.forEach(function(pair) {
    var input = document.getElementById(pair.inputId);
    var drop  = document.getElementById(pair.dropId);
    if (!input || !drop) return;

    var activeIdx = -1;

    function getItems() { return drop.querySelectorAll('.ticker-item'); }

    function highlight(idx) {
      getItems().forEach(function(el, i) {
        el.classList.toggle('highlighted', i === idx);
      });
      activeIdx = idx;
    }

    function updateCtaMargin() {
      var cta = document.getElementById('analyzeCta');
      if (!cta) return;
      var openDrop = document.querySelector('.ticker-dropdown:not(.hidden)');
      if (openDrop) {
        cta.style.marginTop = (52 + openDrop.scrollHeight) + 'px';
      } else {
        cta.style.marginTop = '52px';
      }
    }

    function closeDrop() {
      drop.innerHTML = '';
      drop.classList.add('hidden');
      activeIdx = -1;
      updateCtaMargin();
    }

    function selectItem(ticker) {
      input.value = ticker;
      closeDrop();
      input.focus();
    }

    input.addEventListener('input', function() {
      var q = input.value.trim().toUpperCase();
      if (!q) { closeDrop(); return; }

      var matches = NSE_TICKERS.filter(function(item) {
        return item.t.startsWith(q) || item.n.toUpperCase().includes(q);
      }).slice(0, 8);

      if (!matches.length) { closeDrop(); return; }

      drop.innerHTML = '';
      matches.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'ticker-item';
        div.innerHTML =
          '<span class="ticker-symbol">' + item.t + '</span>' +
          '<span class="ticker-name">' + item.n + '</span>';
        div.addEventListener('mousedown', function(e) {
          e.preventDefault();
          selectItem(item.t);
        });
        drop.appendChild(div);
      });

      drop.classList.remove('hidden');
      updateCtaMargin();
      activeIdx = -1;
    });

    input.addEventListener('keydown', function(e) {
      var items = getItems();
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlight(Math.min(activeIdx + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlight(Math.max(activeIdx - 1, 0));
      } else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        items[activeIdx].dispatchEvent(new MouseEvent('mousedown'));
      } else if (e.key === 'Escape') {
        closeDrop();
      }
    });

    input.addEventListener('blur', function() {
      setTimeout(closeDrop, 150);
    });
  });

  document.addEventListener('click', function(e) {
    pairs.forEach(function(pair) {
      var drop  = document.getElementById(pair.dropId);
      var input = document.getElementById(pair.inputId);
      if (drop && input && !input.contains(e.target) && !drop.contains(e.target)) {
        drop.innerHTML = '';
        drop.classList.add('hidden');
      }
    });
  });
}

initTickerAutocomplete();
