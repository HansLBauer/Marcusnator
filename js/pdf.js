/**
 * Marcusnator Pro Athlete 2.0 By Dr. Hans
 * Gerador de Relatório Clínico em .PDF para Médico e/ou Nutricionista (com opção de incluir EFCA)
 */

window.MPA_PDF = (function () {
  function generateMedicalReport({ profile, userData, includeEfca }) {
    const jspdfLib = window.jspdf && window.jspdf.jsPDF;
    if (!jspdfLib) {
      window.print();
      return;
    }

    const doc = new jspdfLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = 16;
    const margin = 15;
    const pageW = 210;
    const maxW = pageW - margin * 2;

    function checkPage(needed = 16) {
      if (y + needed > 280) {
        doc.addPage();
        y = 16;
      }
    }

    function addSectionTitle(title) {
      checkPage(16);
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, maxW, 7.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, margin + 3, y + 5.2);
      doc.setTextColor(15, 23, 42);
      y += 11;
    }

    function addLine(label, value) {
      checkPage(7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);
      doc.text(`${label}: `, margin, y);
      const offset = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(value || '—'), maxW - offset);
      doc.text(lines, margin + offset, y);
      y += lines.length * 4.8 + 1.2;
    }

    // Cabeçalho
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Marcusnator Pro Athlete 2.0 By Dr. Hans', margin, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Relatório Clínico de Acompanhamento — Médico / Nutricionista', margin, 17.5);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, pageW - margin, 17.5, { align: 'right' });

    doc.setTextColor(15, 23, 42);
    y = 32;

    const p = userData.onboarding || {};
    const weighIns = [...(userData.weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
    const lastW = weighIns.length ? weighIns[weighIns.length - 1] : null;
    const firstW = weighIns.length ? weighIns[0] : null;
    const curWeight = lastW ? Number(lastW.peso) : Number(p.pesoAtual || 0);
    const heightM = Number(String(p.altura || '0').replace(',', '.'));
    const bmi = heightM > 0 && curWeight > 0 ? (curWeight / (heightM * heightM)) : null;

    // 1. Dados do Paciente e Metas
    addSectionTitle('1. DADOS DO PACIENTE E METAS');
    addLine('Nome completo', profile.nomeCompleto);
    addLine('Idade / Sexo', `${p.idade || '—'} anos · ${p.sexo || '—'}`);
    addLine('Altura / IMC atual', `${p.altura || '—'} m · IMC: ${bmi ? window.fmtBR(bmi, 1) + ' kg/m²' : '—'}`);
    addLine('Peso inicial / atual / meta', `${firstW ? window.fmtBR(firstW.peso, 1) : window.fmtBR(p.pesoAtual, 1)} kg  →  ${window.fmtBR(curWeight, 1)} kg  (Meta: ${window.fmtBR(p.pesoMeta, 1)} kg até ${window.fmtDateBR(p.dataAlvo)})`);
    addLine('Metas diárias', `${p.metaKcal || '—'} kcal/dia · ${p.metaProteina || '—'} g proteína/dia · Água: ${userData.waterMlPerKg || 35} ml/kg`);
    addLine('Rotina e treinos', `Sono: ${p.horarioAcordo || '—'}–${p.horarioDurmo || '—'} | Treinos: ${p.treinosSemana || '—'}`);
    addLine('Suplementos', p.suplementos || 'Nenhum informado');

    // 2. Evolução Ponderal e Bioimpedância
    addSectionTitle('2. EVOLUÇÃO PONDERAL, MEDIDAS E BIOIMPEDÂNCIA');
    const totalLost = (firstW && lastW) ? (Number(lastW.peso) - Number(firstW.peso)) : 0;
    addLine('Variação total de peso', `${totalLost > 0 ? '+' : ''}${window.fmtBR(totalLost, 1)} kg (${weighIns.length} pesagens registradas)`);

    const lastWaist = [...weighIns].reverse().find((w) => w.cintura);
    const firstWaist = weighIns.find((w) => w.cintura);
    if (lastWaist) {
      const wDiff = firstWaist ? (Number(lastWaist.cintura) - Number(firstWaist.cintura)) : 0;
      addLine('Cintura (umbigo)', `Atual: ${window.fmtBR(lastWaist.cintura, 1)} cm (variação: ${wDiff > 0 ? '+' : ''}${window.fmtBR(wDiff, 1)} cm)`);
    }

    const bio = userData.bioimpedance && userData.bioimpedance.length
      ? userData.bioimpedance[userData.bioimpedance.length - 1]
      : null;
    if (bio) {
      const bt = window.MPA_CHARTS.evaluateBodyType(bmi, Number(bio.gorduraPct));
      addLine('Última Bioimpedância (' + window.fmtDateBR(bio.data) + ')',
        `Gordura: ${window.fmtBR(bio.gorduraPct, 1)}% | Massa Muscular: ${window.fmtBR(bio.massaMuscularKg, 1)} kg | Água: ${window.fmtBR(bio.aguaPct, 1)}% | Gordura Visceral: ${bio.visceral || '—'} | Classificação corporal: ${(bt || '—').toUpperCase()}`);
    } else {
      addLine('Bioimpedância', 'Nenhum registro inserido até o momento.');
    }

    // 3. Adesão Nutricional e Treinos (Últimos 7 dias)
    addSectionTitle('3. RESUMO DOS ÚLTIMOS 7 DIAS (DIÁRIO)');
    const cutoffMs = Date.now() - 7 * 86400000;
    const recentMeals = (userData.meals || []).filter((m) => new Date(m.data + 'T12:00:00').getTime() >= cutoffMs);
    const recentWorkouts = (userData.workouts || []).filter((w) => new Date(w.data + 'T12:00:00').getTime() >= cutoffMs);
    const daysWithMeals = new Set(recentMeals.map((m) => m.data)).size || 1;
    const totalKcal7 = recentMeals.reduce((s, m) => s + Number(m.kcal || 0), 0);
    const totalProt7 = recentMeals.reduce((s, m) => s + Number(m.proteina || 0), 0);
    const deliveries7 = recentMeals.filter((m) => m.delivery).length;
    addLine('Média diária (7 dias)', `${window.fmtBR(totalKcal7 / daysWithMeals, 0)} kcal/dia · ${window.fmtBR(totalProt7 / daysWithMeals, 0)} g proteína/dia`);
    addLine('Deliveries / Treinos (7 dias)', `${deliveries7} delivery(s) · ${recentWorkouts.length} treino(s) (${recentWorkouts.reduce((s, w) => s + Number(w.minutos || 0), 0)} min totais)`);

    // 4. Medicação e Farmacocinética
    addSectionTitle('4. FARMACOTERAPIA PARA EMAGRECIMENTO');
    const doses = [...(userData.doses || [])].sort((a, b) => b.dataHora.localeCompare(a.dataHora));
    if (p.usaMedicamento === 'sim' || doses.length > 0) {
      const medId = p.medicacao || (doses[0] ? doses[0].medicacao : 'tirzepatida');
      const medInfo = window.MPA_DATA.MEDICATIONS[medId];
      const curPk = window.MPA_CHARTS.computePKAmountAtTime(doses, medId, Date.now());
      addLine('Medicação em uso', medInfo ? medInfo.label : medId);
      addLine('Nível estimado atual no organismo', `${window.fmtBR(curPk, 2)} mg (${medInfo ? medInfo.pkRef : ''})`);
      if (doses.length > 0) {
        addLine('Última aplicação', `${window.fmtDateBR(doses[0].dataHora)} · Dose: ${window.fmtDoseMg(doses[0].doseMg)} · Local: ${doses[0].local}`);
      }
    } else {
      addLine('Medicação', 'Não utiliza medicação para emagrecimento.');
    }

    // 5. Opcional: EFCA
    if (includeEfca) {
      addSectionTitle('5. ESCALA DE FENÓTIPOS DE COMPORTAMENTO ALIMENTAR (EFCA)');
      const efca = userData.efcaResult;
      if (efca) {
        addLine('Data da avaliação', window.fmtDateBR(efca.date));
        addLine('Escore Total (16 itens)', `${efca.total} pontos — Classificação: ${efca.totalLevel} (Baixo: 16–37 | Médio: 38–48 | Alto: >=49)`);
        Object.keys(window.MPA_DATA.EFCA_SUBSCALES).forEach((k) => {
          const meta = window.MPA_DATA.EFCA_SUBSCALES[k];
          const sc = efca.scores[k];
          addLine(`Fenótipo ${meta.name}`, `${sc.score}/${meta.max} pts (${sc.level}) — ${meta.desc}`);
        });
        addLine('Referência científica', 'Pineda-Wieselberg RJ et al. Validation for Brazilian Portuguese of the EFCA. Arch Endocrinol Metab. 2025;69(3):e240404. Rastreio educativo — não constitui diagnóstico.');
      } else {
        addLine('EFCA', 'Questionário ainda não preenchido pelo paciente.');
      }
    }

    // Aviso legal obrigatório no rodapé
    checkPage(22);
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const disc = 'Aviso: Este aplicativo é apenas uma ferramenta e não substitui profissionais como Nutricionista, Médico, Profissional de Educação Física, Fisioterapeuta e Psicólogos. Pessoas com Doença Renal podem precisar de quantidade diferente de proteína, água e outros nutrientes — consulte seu médico.';
    const dLines = doc.splitTextToSize(disc, maxW);
    doc.text(dLines, margin, y);

    const safeName = (profile.nomeCompleto || 'paciente').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Relatorio_Marcusnator_${safeName}_${window.todayISO()}.pdf`);
  }

  return { generateMedicalReport };
})();
