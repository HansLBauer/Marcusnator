/**
 * Marcusnator Pro Athlete 2.0 By Dr. Hans
 * Motor de gráficos clínicos, farmacocinética (Bateman 1-compartimento), projeções e avaliação corporal.
 */

window.MPA_CHARTS = (function () {
  const instances = {};

  function destroyChart(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function getThemeColors() {
    const dark = isDark();
    return {
      text: dark ? '#CBD5E1' : '#334155',
      grid: dark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)',
      linePrimary: dark ? '#14B8A6' : '#0F766E',
      lineReal: dark ? '#F8FAFC' : '#0F172A',
      lineProj: '#3B82F6',
      lineRealistic: '#D97706',
      lineStudy: '#C026D3',
      pkGreen: '#16A34A',
      pkFill: dark ? 'rgba(22, 163, 74, 0.30)' : 'rgba(22, 163, 74, 0.35)',
      pkFutureFill: dark ? 'rgba(22, 163, 74, 0.12)' : 'rgba(22, 163, 74, 0.15)',
      pkAvgLine: dark ? '#F8FAFC' : '#14532D'
    };
  }

  function getDoseColor(medId, doseMg) {
    const med = window.MPA_DATA.MEDICATIONS[medId] || window.MPA_DATA.MEDICATIONS.tirzepatida;
    const key = String(Number(doseMg));
    return med.doseColors[key] || '#0D9488';
  }

  /**
   * Interpola a curva percentual do estudo clínico para qualquer dia d >= 0
   */
  function interpolateStudyPct(studyKey, day) {
    const study = window.MPA_DATA.CLINICAL_STUDIES[studyKey];
    if (!study) return null;
    const pts = study.points;
    if (day <= pts[0].day) return pts[0].pct;
    if (day >= pts[pts.length - 1].day) return pts[pts.length - 1].pct;
    for (let i = 0; i < pts.length - 1; i++) {
      if (day >= pts[i].day && day <= pts[i + 1].day) {
        const frac = (day - pts[i].day) / (pts[i + 1].day - pts[i].day);
        return pts[i].pct + frac * (pts[i + 1].pct - pts[i].pct);
      }
    }
    return pts[pts.length - 1].pct;
  }

  /**
   * Modelo farmacocinético Bateman (1 compartimento, absorção e eliminação de 1ª ordem)
   * A(t) = D * (ka / (ka - ke)) * (e^(-ke*t) - e^(-ka*t))
   */
  function computePKAmountAtTime(doses, medId, targetMs) {
    const med = window.MPA_DATA.MEDICATIONS[medId] || window.MPA_DATA.MEDICATIONS.tirzepatida;
    const ka = med.ka;
    const ke = med.ke;
    let total = 0;
    for (const d of doses) {
      if (d.medicacao !== medId) continue;
      const doseMs = new Date(d.dataHora).getTime();
      if (isNaN(doseMs) || targetMs < doseMs) continue;
      const dtHours = (targetMs - doseMs) / 3600000;
      if (dtHours > 1200) continue; // > 50 dias, residual desprezível
      const amt = Number(d.doseMg) * (ka / (ka - ke)) * (Math.exp(-ke * dtHours) - Math.exp(-ka * dtHours));
      if (amt > 0) total += amt;
    }
    return total;
  }

  /**
   * Gráfico 1 (Medicação): Nível Estimado do Medicamento (PK) + Média 7 dias + Projeção futura + Hover/Touch Comparativo
   */
  function renderPKChart(canvasId, { doses, medId, rangeDays, showAvg7, onHoverUpdate }) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const colors = getThemeColors();

    const nowMs = Date.now();
    const filteredDoses = (doses || []).filter((d) => d.medicacao === medId);
    let earliestMs = nowMs - (rangeDays || 90) * 86400000;
    if (rangeDays === 0 && filteredDoses.length > 0) {
      const minD = Math.min(...filteredDoses.map((d) => new Date(d.dataHora).getTime()));
      earliestMs = Math.min(minD - 3 * 86400000, nowMs - 14 * 86400000);
    }
    const endFutureMs = nowMs + 28 * 86400000; // +28 dias de decaimento futuro

    // Passo de 12 horas para curva suave e leve
    const stepMs = 12 * 3600000;
    const timestamps = [];
    for (let t = earliestMs; t <= endFutureMs; t += stepMs) {
      timestamps.push(t);
    }

    const pastValues = [];
    const futureValues = [];
    const avg7Values = [];
    const allAmounts = timestamps.map((t) => computePKAmountAtTime(filteredDoses, medId, t));

    let currentIdx = 0;
    let minDiff = Infinity;
    timestamps.forEach((t, idx) => {
      const diff = Math.abs(t - nowMs);
      if (diff < minDiff) {
        minDiff = diff;
        currentIdx = idx;
      }
    });

    for (let i = 0; i < timestamps.length; i++) {
      const val = Number(allAmounts[i].toFixed(2));
      if (i <= currentIdx) {
        pastValues.push(val);
        futureValues.push(i === currentIdx ? val : null);
        // Média móvel de 7 dias (14 passos de 12h)
        const startWin = Math.max(0, i - 13);
        let sum = 0;
        let cnt = 0;
        for (let j = startWin; j <= i; j++) {
          sum += allAmounts[j];
          cnt++;
        }
        avg7Values.push(Number((sum / cnt).toFixed(2)));
      } else {
        pastValues.push(null);
        futureValues.push(val);
        avg7Values.push(null);
      }
    }

    const currentAmt = allAmounts[currentIdx] || 0;
    const currentAvg7 = avg7Values[currentIdx] || 0;
    const peakAmt = Math.max(...allAmounts.slice(0, currentIdx + 1), 0.01);
    const currentPctOfPeak = Math.round((currentAmt / peakAmt) * 100);

    if (onHoverUpdate) {
      onHoverUpdate({
        currentAmt,
        currentAvg7,
        currentPctOfPeak,
        hovered: null
      });
    }

    const labels = timestamps.map((t) => {
      const d = new Date(t);
      return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    });

    const datasets = [
      {
        label: window.MPA_DATA.MEDICATIONS[medId]?.shortLabel || medId,
        data: pastValues,
        borderColor: colors.pkGreen,
        backgroundColor: colors.pkFill,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2.2
      },
      {
        label: 'Decaimento projetado',
        data: futureValues,
        borderColor: 'rgba(22, 163, 74, 0.45)',
        backgroundColor: colors.pkFutureFill,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 1.8,
        borderDash: [4, 4]
      }
    ];

    if (showAvg7) {
      datasets.push({
        label: 'Média 7 dias',
        data: avg7Values,
        borderColor: colors.pkAvgLine,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2.2
      });
    }

    instances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onHover: (event, elements) => {
          if (!onHoverUpdate) return;
          if (elements && elements.length > 0) {
            const idx = elements[0].index;
            const t = timestamps[idx];
            const amt = allAmounts[idx] || 0;
            const avg = avg7Values[idx];
            onHoverUpdate({
              currentAmt,
              currentAvg7,
              currentPctOfPeak,
              hovered: {
                dateStr: new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                amt,
                avg,
                diffFromCurrent: amt - currentAmt
              }
            });
          } else {
            onHoverUpdate({ currentAmt, currentAvg7, currentPctOfPeak, hovered: null });
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: { color: colors.text, boxWidth: 14, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${window.fmtBR(ctx.parsed.y, 2)} mg`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: colors.text, maxTicksLimit: 7, font: { size: 11 } },
            grid: { color: colors.grid }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: colors.text,
              font: { size: 11 },
              callback: (v) => `${window.fmtBR(v, v < 2 ? 1 : 0)} mg`
            },
            grid: { color: colors.grid }
          }
        }
      }
    });
  }

  /**
   * Gráfico 2 (Medicação): Peso vs Estudos Clínicos (média das doses, sem seletor de dose) + toggle % / kg + aplicações coloridas
   */
  function renderStudyComparisonChart(canvasId, { weighIns, doses, studyKey, unitMode, showDoses }) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const colors = getThemeColors();
    const study = window.MPA_DATA.CLINICAL_STUDIES[studyKey] || window.MPA_DATA.CLINICAL_STUDIES.tirzepatida_72;

    const sortedW = [...(weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
    const startWeight = sortedW.length > 0 ? Number(sortedW[0].peso) : 90;
    const startMs = sortedW.length > 0 ? new Date(sortedW[0].data + 'T00:00:00').getTime() : Date.now();

    const maxStudyDay = study.points[study.points.length - 1].day;
    const studyPoints = study.points.map((p) => ({
      x: p.day,
      y: unitMode === 'pct' ? p.pct : Number((startWeight * (1 + p.pct / 100)).toFixed(1))
    }));

    const userPoints = sortedW.map((w) => {
      const dMs = new Date(w.data + 'T00:00:00').getTime();
      const day = Math.max(0, Math.round((dMs - startMs) / 86400000));
      const pct = ((Number(w.peso) - startWeight) / startWeight) * 100;
      return {
        x: day,
        y: unitMode === 'pct' ? Number(pct.toFixed(1)) : Number(Number(w.peso).toFixed(1)),
        date: w.data
      };
    });

    const datasets = [
      {
        label: `Perda média do estudo (${study.shortLabel})`,
        data: studyPoints,
        borderColor: colors.lineStudy,
        backgroundColor: 'transparent',
        borderWidth: 3.5,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        label: 'Seu peso',
        data: userPoints,
        borderColor: colors.lineReal,
        backgroundColor: colors.lineReal,
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ];

    if (showDoses && doses && doses.length > 0) {
      const byDose = {};
      doses.forEach((d) => {
        const dMs = new Date(d.dataHora).getTime();
        const day = Math.max(0, Math.round((dMs - startMs) / 86400000));
        // Encontra peso mais próximo para posicionar o marcador sobre a curva do usuário
        let yVal = unitMode === 'pct' ? 0 : startWeight;
        if (userPoints.length > 0) {
          let best = userPoints[0];
          let minD = Infinity;
          userPoints.forEach((pt) => {
            const diff = Math.abs(pt.x - day);
            if (diff < minD) { minD = diff; best = pt; }
          });
          yVal = best.y;
        }
        const key = `${d.medicacao}_${d.doseMg}`;
        if (!byDose[key]) {
          byDose[key] = {
            med: d.medicacao,
            doseMg: d.doseMg,
            color: getDoseColor(d.medicacao, d.doseMg),
            points: []
          };
        }
        byDose[key].points.push({ x: day, y: yVal, site: d.local, date: d.dataHora.slice(0, 10) });
      });

      Object.values(byDose).forEach((grp) => {
        datasets.push({
          label: `Dose ${window.fmtDoseMg(grp.doseMg)}`,
          data: grp.points,
          borderColor: grp.color,
          backgroundColor: grp.color,
          showLine: false,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointStyle: 'circle'
        });
      });
    }

    instances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: colors.text, boxWidth: 12, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              title: (items) => items[0] ? `Dia ${items[0].parsed.x} (~${Math.round(items[0].parsed.x / 7)} sem)` : '',
              label: (ctx) => {
                const suffix = unitMode === 'pct' ? '%' : ' kg';
                return `${ctx.dataset.label}: ${window.fmtBR(ctx.parsed.y, 1)}${suffix}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: Math.max(maxStudyDay, userPoints.length ? userPoints[userPoints.length - 1].x + 14 : 90),
            ticks: {
              color: colors.text,
              font: { size: 11 },
              callback: (v) => `${v} d`
            },
            grid: { color: colors.grid }
          },
          y: {
            ticks: {
              color: colors.text,
              font: { size: 11 },
              callback: (v) => unitMode === 'pct' ? `${v}%` : `${window.fmtBR(v, 0)} kg`
            },
            grid: { color: colors.grid }
          }
        }
      }
    });
  }

  /**
   * Gera mapa de feriados brasileiros e eventos do usuário para projeções realistas
   */
  function buildHolidayMap(userEvents) {
    const map = {};
    window.MPA_DATA.BRAZIL_HOLIDAYS.forEach((h) => {
      map[h.date] = h;
    });
    (userEvents || []).forEach((ev) => {
      if (ev.date) map[ev.date] = { date: ev.date, name: ev.title, impact: 'high' };
    });
    return map;
  }

  /**
   * Gráfico 3 (Evolução): Realidade × Projetado (imita flutuação de fim de semana, feriados do Brasil e eventos)
   */
  function renderRealityProjectedChart(canvasId, { weighIns, doses, profile, userEvents, showStudy, studyKey, showDoses }) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const colors = getThemeColors();

    const sortedW = [...(weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
    const startDateStr = profile.dataInicio || (sortedW[0] ? sortedW[0].data : window.todayISO());
    const targetDateStr = profile.dataAlvo || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const startWeight = sortedW.length > 0 ? Number(sortedW[0].peso) : Number(profile.pesoAtual || 85);
    const lastWeight = sortedW.length > 0 ? Number(sortedW[sortedW.length - 1].peso) : startWeight;
    const lastDateStr = sortedW.length > 0 ? sortedW[sortedW.length - 1].data : startDateStr;
    const goalWeight = Number(profile.pesoMeta || startWeight - 10);

    const startMs = new Date(startDateStr + 'T00:00:00').getTime();
    const lastMs = new Date(lastDateStr + 'T00:00:00').getTime();
    const targetMs = Math.max(new Date(targetDateStr + 'T00:00:00').getTime(), lastMs + 28 * 86400000);
    const totalDays = Math.min(400, Math.max(30, Math.round((targetMs - startMs) / 86400000)));
    const holidayMap = buildHolidayMap(userEvents);

    const labels = [];
    const realSeries = [];
    const projSeries = [];
    const studySeries = [];
    const doseMarkers = [];

    const weighMap = {};
    sortedW.forEach((w) => { weighMap[w.data] = Number(w.peso); });

    const doseMap = {};
    (doses || []).forEach((d) => {
      const dt = String(d.dataHora).slice(0, 10);
      doseMap[dt] = d;
    });

    // Ritmo necessário recalculado a partir da última pesagem até a data-alvo
    const remDays = Math.max(1, Math.round((targetMs - lastMs) / 86400000));
    const dailyDelta = (goalWeight - lastWeight) / remDays;

    let currentProj = startWeight;
    let passedLast = false;

    for (let i = 0; i <= totalDays; i++) {
      const curMs = startMs + i * 86400000;
      const dObj = new Date(curMs);
      const iso = dObj.toISOString().slice(0, 10);
      const dow = dObj.getDay(); // 0=Dom, 1=Seg, 6=Sab
      labels.push(dObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

      if (weighMap[iso] !== undefined) {
        realSeries.push(weighMap[iso]);
      } else {
        realSeries.push(null);
      }

      if (iso === lastDateStr) {
        currentProj = lastWeight;
        passedLast = true;
      }

      if (!passedLast) {
        const frac = Math.max(0, (curMs - startMs) / Math.max(1, lastMs - startMs));
        currentProj = startWeight + (lastWeight - startWeight) * frac;
      } else if (i > 0) {
        currentProj += dailyDelta;
      }

      // Flutuação fisiológica semanal (Orsama et al. 2014: sobe sábado/domingo/segunda, cai ter–sex)
      let osc = 0;
      if (dow === 0) osc += 0.35;
      else if (dow === 1) osc += 0.45;
      else if (dow === 2) osc += 0.10;
      else if (dow === 4) osc -= 0.15;
      else if (dow === 5) osc -= 0.25;
      else if (dow === 6) osc += 0.15;

      // Retenção hídrica em feriados nacionais / eventos (Helander et al. NEJM 2016)
      if (holidayMap[iso]) {
        osc += holidayMap[iso].impact === 'high' ? 0.65 : 0.35;
      }
      const prevIso = new Date(curMs - 86400000).toISOString().slice(0, 10);
      if (holidayMap[prevIso]) {
        osc += holidayMap[prevIso].impact === 'high' ? 0.45 : 0.20;
      }

      const projVal = Number((currentProj + osc).toFixed(2));
      projSeries.push(projVal);

      if (showStudy) {
        const sPct = interpolateStudyPct(studyKey, i);
        studySeries.push(sPct !== null ? Number((startWeight * (1 + sPct / 100)).toFixed(2)) : null);
      }

      if (showDoses && doseMap[iso]) {
        doseMarkers.push({
          idx: i,
          y: weighMap[iso] !== undefined ? weighMap[iso] : projVal,
          dose: doseMap[iso]
        });
      }
    }

    const datasets = [
      {
        label: 'Pesagens reais (kg)',
        data: realSeries,
        borderColor: colors.lineReal,
        backgroundColor: colors.lineReal,
        spanGaps: true,
        borderWidth: 2.5,
        pointRadius: 4,
        tension: 0.2
      },
      {
        label: 'Projetado (com ciclo semanal e feriados)',
        data: projSeries,
        borderColor: colors.lineProj,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 0,
        tension: 0.3
      }
    ];

    if (showStudy) {
      const st = window.MPA_DATA.CLINICAL_STUDIES[studyKey];
      datasets.push({
        label: `Estudo: ${st ? st.shortLabel : ''}`,
        data: studySeries,
        borderColor: colors.lineStudy,
        backgroundColor: 'transparent',
        borderWidth: 2.4,
        pointRadius: 0,
        tension: 0.3
      });
    }

    if (showDoses && doseMarkers.length > 0) {
      const grouped = {};
      doseMarkers.forEach((m) => {
        const k = `${m.dose.medicacao}_${m.dose.doseMg}`;
        if (!grouped[k]) {
          grouped[k] = {
            label: `Aplicação ${window.fmtDoseMg(m.dose.doseMg)}`,
            color: getDoseColor(m.dose.medicacao, m.dose.doseMg),
            arr: new Array(labels.length).fill(null)
          };
        }
        grouped[k].arr[m.idx] = m.y;
      });
      Object.values(grouped).forEach((g) => {
        datasets.push({
          label: g.label,
          data: g.arr,
          borderColor: g.color,
          backgroundColor: g.color,
          showLine: false,
          pointRadius: 6,
          pointHoverRadius: 8
        });
      });
    }

    instances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: colors.text, boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.parsed.y !== null ? `${ctx.dataset.label}: ${window.fmtBR(ctx.parsed.y, 1)} kg` : null
            }
          }
        },
        scales: {
          x: { ticks: { color: colors.text, maxTicksLimit: 8, font: { size: 11 } }, grid: { color: colors.grid } },
          y: {
            ticks: { color: colors.text, font: { size: 11 }, callback: (v) => `${window.fmtBR(v, 0)} kg` },
            grid: { color: colors.grid }
          }
        }
      }
    });
  }

  /**
   * Gráfico 4 (Evolução): Projetado Realístico (com recaídas, platôs metabólicos e atraso em feriados brasileiros)
   * Baseado em Helander et al. (NEJM 2016), Yanovski et al. (NEJM 2000) e Orsama et al. (Obesity Facts 2014).
   */
  function renderRealisticProjectedChart(canvasId, { weighIns, doses, profile, userEvents, showStudy, studyKey, showDoses }) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const colors = getThemeColors();

    const sortedW = [...(weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
    const startDateStr = profile.dataInicio || (sortedW[0] ? sortedW[0].data : window.todayISO());
    const targetDateStr = profile.dataAlvo || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const startWeight = sortedW.length > 0 ? Number(sortedW[0].peso) : Number(profile.pesoAtual || 85);
    const goalWeight = Number(profile.pesoMeta || startWeight - 10);

    const startMs = new Date(startDateStr + 'T00:00:00').getTime();
    const targetMs = Math.max(new Date(targetDateStr + 'T00:00:00').getTime(), startMs + 90 * 86400000);
    const totalDays = Math.min(400, Math.max(60, Math.round((targetMs - startMs) / 86400000)));
    const holidayMap = buildHolidayMap(userEvents);

    const labels = [];
    const idealLinear = [];
    const realisticCurve = [];
    const studySeries = [];
    const doseMarkers = [];

    const doseMap = {};
    (doses || []).forEach((d) => { doseMap[String(d.dataHora).slice(0, 10)] = d; });

    const baseDailyLoss = (startWeight - goalWeight) / totalDays;
    let realW = startWeight;

    for (let i = 0; i <= totalDays; i++) {
      const curMs = startMs + i * 86400000;
      const dObj = new Date(curMs);
      const iso = dObj.toISOString().slice(0, 10);
      const dow = dObj.getDay();
      labels.push(dObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

      idealLinear.push(Number((startWeight - baseDailyLoss * i).toFixed(2)));

      if (i > 0) {
        // Adaptação metabólica gradual (platôs a cada ~45 dias)
        const weekNum = Math.floor(i / 7);
        const isPlateauWeek = (weekNum > 0 && weekNum % 7 === 0);
        const effectiveLoss = isPlateauWeek ? baseDailyLoss * 0.15 : baseDailyLoss * 0.92;

        // Oscilação semanal (Orsama 2014)
        let delta = -effectiveLoss;
        if (dow === 0 || dow === 6) delta += 0.14;
        else if (dow === 1) delta += 0.08;
        else delta -= 0.06;

        // Recaída / atraso realístico em feriados nacionais (Helander NEJM 2016: +0,4-0,6% Natal/Carnaval/Páscoa, +0,2-0,3% outros)
        if (holidayMap[iso]) {
          const bumpPct = holidayMap[iso].impact === 'high' ? 0.0055 : 0.0025;
          delta += realW * bumpPct;
        }
        // Pequena recaída comportamental mensal realista
        if (i % 34 === 0) {
          delta += 0.45;
        }

        realW = Math.max(goalWeight - 1, realW + delta);
      }

      realisticCurve.push(Number(realW.toFixed(2)));

      if (showStudy) {
        const sPct = interpolateStudyPct(studyKey, i);
        studySeries.push(sPct !== null ? Number((startWeight * (1 + sPct / 100)).toFixed(2)) : null);
      }

      if (showDoses && doseMap[iso]) {
        doseMarkers.push({ idx: i, y: Number(realW.toFixed(2)), dose: doseMap[iso] });
      }
    }

    const datasets = [
      {
        label: 'Projetado Realístico (platôs, recaídas e feriados BR)',
        data: realisticCurve,
        borderColor: colors.lineRealistic,
        backgroundColor: 'rgba(217, 119, 6, 0.10)',
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.25
      },
      {
        label: 'Trajetória linear teórica',
        data: idealLinear,
        borderColor: colors.text,
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0
      }
    ];

    if (showStudy) {
      const st = window.MPA_DATA.CLINICAL_STUDIES[studyKey];
      datasets.push({
        label: `Estudo: ${st ? st.shortLabel : ''}`,
        data: studySeries,
        borderColor: colors.lineStudy,
        borderWidth: 2.2,
        pointRadius: 0,
        tension: 0.3
      });
    }

    if (showDoses && doseMarkers.length > 0) {
      const grouped = {};
      doseMarkers.forEach((m) => {
        const k = `${m.dose.medicacao}_${m.dose.doseMg}`;
        if (!grouped[k]) {
          grouped[k] = {
            label: `Aplicação ${window.fmtDoseMg(m.dose.doseMg)}`,
            color: getDoseColor(m.dose.medicacao, m.dose.doseMg),
            arr: new Array(labels.length).fill(null)
          };
        }
        grouped[k].arr[m.idx] = m.y;
      });
      Object.values(grouped).forEach((g) => {
        datasets.push({
          label: g.label,
          data: g.arr,
          borderColor: g.color,
          backgroundColor: g.color,
          showLine: false,
          pointRadius: 6
        });
      });
    }

    instances[canvasId] = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: colors.text, boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.parsed.y !== null ? `${ctx.dataset.label}: ${window.fmtBR(ctx.parsed.y, 1)} kg` : null
            }
          }
        },
        scales: {
          x: { ticks: { color: colors.text, maxTicksLimit: 8, font: { size: 11 } }, grid: { color: colors.grid } },
          y: {
            ticks: { color: colors.text, font: { size: 11 }, callback: (v) => `${window.fmtBR(v, 0)} kg` },
            grid: { color: colors.grid }
          }
        }
      }
    });
  }

  /**
   * Avaliação do Tipo de Corpo (IMC × % Gordura Corporal — fiel à imagem enviada)
   */
  function evaluateBodyType(bmi, fatPct) {
    if (!bmi || !fatPct) return null;
    if (bmi >= 25.0) {
      if (fatPct < 23.0) return 'atletas';
      if (fatPct < 28.0) return 'gordura_muscular';
      return 'obesidade';
    }
    if (bmi >= 21.7) {
      if (fatPct < 23.0) return 'musculo';
      if (fatPct < 28.0) return 'ajuste';
      return 'excesso';
    }
    if (bmi >= 18.5) {
      if (fatPct < 18.0) return 'muscular_magro';
      if (fatPct < 23.0) return 'slim';
      if (fatPct < 28.0) return 'ajuste';
      return 'gordura_invisivel';
    }
    // bmi < 18.5
    if (fatPct < 18.0) return 'marasmo';
    if (fatPct < 28.0) return 'fino';
    return 'gordura_invisivel';
  }

  return {
    computePKAmountAtTime,
    renderPKChart,
    renderStudyComparisonChart,
    renderRealityProjectedChart,
    renderRealisticProjectedChart,
    evaluateBodyType,
    getDoseColor
  };
})();
