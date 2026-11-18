/**
 * Marcusnator Pro Athlete 2.0 By Dr. Hans
 * Controlador principal da aplicação (Auth, Onboarding, Placar, 6 Abas, IA Gemini, EFCA, Notificações, PWA).
 */

(function () {
  const state = {
    profile: null,
    userData: null,
    activeTab: 'cardapio',
    menuDate: window.todayISO(),
    diaryDate: window.todayISO(),
    scoreboardVisible: true,
    pkMed: 'tirzepatida',
    pkDays: 90,
    pkShowAvg7: true,
    studyKey: 'tirzepatida_72',
    studyUnit: 'pct',
    studyShowDoses: true,
    evo1ShowStudy: false,
    evo1ShowDoses: false,
    evo2ShowStudy: false,
    evo2ShowDoses: false,
    obTempMeasures: [],
    deferredInstallPrompt: null,
    confirmCallback: null,
    notifTimer: null
  };

  function $(id) { return document.getElementById(id); }

  function showToast(msg) {
    const c = $('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3400);
  }

  function openConfirm(msg, onConfirm) {
    $('confirm-message').textContent = msg;
    state.confirmCallback = onConfirm;
    $('modal-confirm').classList.remove('hidden');
  }

  function defaultUserData() {
    return {
      onboardingConcluido: false,
      onboarding: {},
      meals: [],
      menus: {}, // keyed by YYYY-MM-DD -> array of planned meals
      weighIns: [], // { id, data, peso, cintura }
      bioimpedance: [], // { id, data, gorduraPct, massaMuscularKg, aguaPct, visceral }
      workouts: [], // { id, data, atividade, minutos }
      doses: [], // { id, dataHora, medicacao, doseMg, local }
      events: [], // { id, title, date }
      waterLog: {}, // YYYY-MM-DD -> ml
      waterMlPerKg: 35,
      efcaResult: null,
      notifications: {
        tone: 'moderada',
        items: window.MPA_DATA.NOTIFICATION_TYPES.map((n) => ({
          id: n.id,
          label: n.label,
          enabled: n.id === 'agua' || n.id === 'medicoes',
          time: n.defaultTime,
          reason: n.defaultReason
        }))
      }
    };
  }

  async function persist(logEvent) {
    if (!state.profile || !state.userData) return;
    const badge = $('sync-status-badge');
    if (badge) badge.textContent = 'Salvando...';
    const res = await window.MPA_API.saveUserData(state.profile.userId, state.userData, logEvent);
    if (badge) {
      badge.textContent = res.synced ? 'Planilha OK' : 'Salvo local';
      badge.className = res.synced ? 'badge badge-teal' : 'badge badge-warn';
    }
  }

  /* ==================== TEMA CLARO / ESCURO ==================== */
  function initTheme() {
    let saved = 'light';
    try { saved = localStorage.getItem('mpa_v2_theme') || 'light'; } catch {}
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeLabel();
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem('mpa_v2_theme', cur); } catch {}
    updateThemeLabel();
    if (state.profile && state.userData) renderActiveTab();
  }
  function updateThemeLabel() {
    const btn = $('btn-toggle-theme');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? 'Claro' : 'Escuro';
  }

  /* ==================== PWA SERVICE WORKER & INSTALAÇÃO ==================== */
  function initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      $('pwa-install-native-wrap').classList.remove('hidden');
    });
    $('btn-trigger-pwa-install').addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      $('pwa-install-native-wrap').classList.add('hidden');
      $('modal-install').classList.add('hidden');
    });
  }

  /* ==================== TELA 1: AUTENTICAÇÃO E RECUPERAÇÃO ==================== */
  function initAuthUI() {
    // Popula perguntas padrão
    const qSel = $('reg-pergunta-select');
    window.MPA_DATA.RECOVERY_QUESTIONS.forEach((q) => {
      const opt = document.createElement('option');
      opt.value = q;
      opt.textContent = q;
      qSel.appendChild(opt);
    });
    qSel.addEventListener('change', () => {
      const isCustom = qSel.value.startsWith('Personalizada');
      $('reg-pergunta-custom-wrap').classList.toggle('hidden', !isCustom);
    });

    // Abas Auth
    document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-auth-tab]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.authTab;
        $('form-login').classList.toggle('hidden', tab !== 'login');
        $('form-register').classList.toggle('hidden', tab !== 'register');
        $('form-recover').classList.toggle('hidden', tab !== 'recover');
      });
    });

    // Login
    $('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nomeCompleto = $('login-nome').value.trim();
      const senha = $('login-senha').value;
      const res = await window.MPA_API.login({ nomeCompleto, senha });
      if (!res.ok) {
        showToast(res.error || 'Erro ao entrar.');
        return;
      }
      await enterSession(res.profile);
    });

    // Registro
    $('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nomeCompleto = $('reg-nome').value.trim();
      const senha = $('reg-senha').value;
      let pergunta = $('reg-pergunta-select').value;
      if (pergunta.startsWith('Personalizada')) {
        pergunta = $('reg-pergunta-custom').value.trim();
        if (!pergunta) { showToast('Digite sua pergunta personalizada.'); return; }
      }
      const respostaRecuperacao = $('reg-resposta').value.trim();
      const res = await window.MPA_API.registerProfile({ nomeCompleto, senha, perguntaRecuperacao: pergunta, respostaRecuperacao });
      if (!res.ok) {
        showToast(res.error || 'Erro ao criar perfil.');
        return;
      }
      showToast('Perfil criado e salvo na planilha!');
      await enterSession(res.profile);
    });

    // Recuperar senha
    $('btn-buscar-pergunta').addEventListener('click', async () => {
      const nome = $('rec-nome').value.trim();
      if (!nome) { showToast('Informe seu nome completo.'); return; }
      const res = await window.MPA_API.getRecoveryQuestion(nome);
      if (!res.ok) { showToast(res.error || 'Perfil não encontrado.'); return; }
      $('rec-pergunta-texto').textContent = res.perguntaRecuperacao || 'Pergunta não cadastrada.';
      $('rec-step-2').classList.remove('hidden');
      $('rec-resultado').classList.add('hidden');
    });

    $('rec-modo').addEventListener('change', () => {
      $('rec-nova-senha-wrap').classList.toggle('hidden', $('rec-modo').value !== 'reset');
    });

    $('btn-confirmar-recuperacao').addEventListener('click', async () => {
      const nomeCompleto = $('rec-nome').value.trim();
      const respostaRecuperacao = $('rec-resposta').value.trim();
      const mode = $('rec-modo').value;
      const novaSenha = $('rec-nova-senha').value;
      if (mode === 'reset' && novaSenha.length < 4) {
        showToast('A nova senha precisa ter pelo menos 4 caracteres.');
        return;
      }
      const res = await window.MPA_API.verifyRecovery({ nomeCompleto, respostaRecuperacao, mode, novaSenha });
      const box = $('rec-resultado');
      box.classList.remove('hidden');
      if (!res.ok) {
        box.textContent = res.error || 'Resposta incorreta.';
        return;
      }
      if (mode === 'reset') {
        box.textContent = 'Senha redefinida com sucesso e atualizada na planilha! Você já pode fazer login.';
      } else {
        box.textContent = `Sua senha cadastrada é: ${res.senhaRecuperada}`;
      }
    });

    $('btn-auth-install').addEventListener('click', () => $('modal-install').classList.remove('hidden'));
    loadProfilesList();
  }

  async function loadProfilesList() {
    const res = await window.MPA_API.listProfiles();
    const wrap = $('saved-profiles-wrap');
    const list = $('saved-profiles-list');
    if (!res.ok || !res.profiles || res.profiles.length === 0) {
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');
    list.innerHTML = '';
    res.profiles.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary btn-sm';
      b.textContent = p.nomeCompleto;
      b.addEventListener('click', () => {
        $('login-nome').value = p.nomeCompleto;
        $('login-senha').focus();
      });
      list.appendChild(b);
    });
  }

  async function enterSession(profile) {
    state.profile = profile;
    try { localStorage.setItem('mpa_v2_active_profile', JSON.stringify(profile)); } catch {}
    const loaded = await window.MPA_API.loadUserData(profile.userId);
    state.userData = Object.assign(defaultUserData(), loaded.data || {});
    if (!state.userData.notifications || !state.userData.notifications.items) {
      state.userData.notifications = defaultUserData().notifications;
    }

    $('view-auth').classList.add('hidden');
    if (!state.userData.onboardingConcluido && !profile.onboardingConcluido) {
      openOnboarding(false);
    } else {
      openMainApp();
    }
  }

  /* ==================== TELA 2: ONBOARDING ==================== */
  function initOnboardingUI() {
    // Altura com vírgula automática (ex: 178 -> 1,78)
    $('ob-altura').addEventListener('input', (e) => {
      let digits = e.target.value.replace(/\D/g, '').slice(0, 3);
      if (digits.length > 1) {
        e.target.value = digits[0] + ',' + digits.slice(1);
      } else {
        e.target.value = digits;
      }
    });

    // Tipos de medidas
    const mSel = $('ob-medida-tipo');
    window.MPA_DATA.BODY_MEASUREMENT_TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      mSel.appendChild(opt);
    });

    $('btn-add-ob-medida').addEventListener('click', () => {
      const tipo = $('ob-medida-tipo').value;
      const val = parseFloat($('ob-medida-valor').value);
      if (!val || val <= 0) { showToast('Informe um valor em cm.'); return; }
      state.obTempMeasures.push({ tipo, valor: val });
      $('ob-medida-valor').value = '';
      renderObMeasures();
    });

    // Calcular Kcal automaticamente (Mifflin-St Jeor + fator moderado - déficit seguro)
    $('btn-calc-kcal').addEventListener('click', () => {
      const h = parseFloat($('ob-altura').value.replace(',', '.')) * 100;
      const w = parseFloat($('ob-peso-atual').value);
      const age = parseFloat($('ob-idade').value);
      const sex = $('ob-sexo').value;
      if (!h || !w || !age) { showToast('Preencha altura, peso atual e idade primeiro.'); return; }
      const bmr = sex === 'Masculino'
        ? (10 * w + 6.25 * h - 5 * age + 5)
        : (10 * w + 6.25 * h - 5 * age - 161);
      const tdee = bmr * 1.45;
      const targetKcal = Math.max(1200, Math.round((tdee - 500) / 10) * 10);
      $('ob-meta-kcal').value = targetKcal;
      showToast(`Meta calculada: ${targetKcal} kcal/dia (déficit de ~500 kcal).`);
    });

    // Calcular Proteína automaticamente (1,8 g/kg peso meta)
    $('btn-calc-prot').addEventListener('click', () => {
      const goalW = parseFloat($('ob-peso-meta').value) || parseFloat($('ob-peso-atual').value);
      if (!goalW) { showToast('Preencha peso atual ou peso meta primeiro.'); return; }
      const prot = Math.round(goalW * 1.8);
      $('ob-meta-prot').value = prot;
      showToast(`Meta calculada: ${prot} g/dia (~1,8 g/kg do peso meta).`);
    });

    // Medicação toggle & doses dinâmicas
    $('ob-usa-med').addEventListener('change', () => {
      $('ob-med-fields').classList.toggle('hidden', $('ob-usa-med').value !== 'sim');
    });
    $('ob-medicacao').addEventListener('change', () => populateDoseSelect('ob-dose', $('ob-medicacao').value));
    populateDoseSelect('ob-dose', 'semaglutida');

    const siteSel = $('ob-local-aplicacao');
    window.MPA_DATA.INJECTION_SITES.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.label;
      opt.textContent = s.label;
      siteSel.appendChild(opt);
    });

    $('btn-cancel-onboarding').addEventListener('click', () => {
      $('view-onboarding').classList.add('hidden');
      $('view-app').classList.remove('hidden');
    });

    $('form-onboarding').addEventListener('submit', async (e) => {
      e.preventDefault();
      const idade = parseInt($('ob-idade').value, 10) || 30;
      const ob = {
        altura: $('ob-altura').value,
        idade,
        sexo: $('ob-sexo').value,
        pesoAtual: parseFloat($('ob-peso-atual').value),
        pesoMeta: parseFloat($('ob-peso-meta').value),
        dataAlvo: $('ob-data-alvo').value,
        dataInicio: $('ob-data-inicio').value || window.todayISO(),
        medidasIniciais: [...state.obTempMeasures],
        metaKcal: parseInt($('ob-meta-kcal').value, 10),
        metaProteina: parseInt($('ob-meta-prot').value, 10),
        usaMedicamento: $('ob-usa-med').value,
        medicacao: $('ob-medicacao').value,
        doseMg: parseFloat($('ob-dose').value),
        intervaloDias: parseInt($('ob-intervalo').value, 10) || 7,
        ultimaDose: $('ob-ultima-dose').value,
        localUltimaAplicacao: $('ob-local-aplicacao').value,
        horarioAcordo: $('ob-acordo').value,
        horarioDurmo: $('ob-durmo').value,
        treinosSemana: $('ob-treinos').value.trim(),
        horarioTrabalho: $('ob-trabalho').value.trim(),
        comeHoje: $('ob-come-hoje').value.trim(),
        comidasGosta: $('ob-gosta').value.trim(),
        comidasNaoCome: $('ob-nao-come').value.trim(),
        tempoCozinhar: $('ob-tempo-cozinhar').value.trim(),
        deliveryFreq: $('ob-delivery').value.trim(),
        suplementos: $('ob-suplementos').value.trim()
      };

      state.userData.onboarding = ob;
      state.userData.onboardingConcluido = true;

      // Define regra automática de água por faixa etária
      state.userData.waterMlPerKg = getRecommendedWaterMlPerKg(idade);

      // Lança peso inicial se não houver pesagens
      if (!state.userData.weighIns.length && ob.pesoAtual) {
        const waistInit = ob.medidasIniciais.find((m) => m.tipo.toLowerCase().includes('cintura'));
        state.userData.weighIns.push({
          id: 'w_' + Date.now(),
          data: ob.dataInicio,
          peso: ob.pesoAtual,
          cintura: waistInit ? waistInit.valor : null
        });
      }

      // Lança dose inicial se usa medicamento e não há doses lançadas
      if (ob.usaMedicamento === 'sim' && ob.ultimaDose && !state.userData.doses.length) {
        state.userData.doses.push({
          id: 'd_' + Date.now(),
          dataHora: ob.ultimaDose,
          medicacao: ob.medicacao,
          doseMg: ob.doseMg,
          local: ob.localUltimaAplicacao
        });
      }

      if (ob.usaMedicamento === 'sim') {
        state.pkMed = ob.medicacao;
        state.studyKey = ob.medicacao === 'semaglutida' ? 'semaglutida_72' : 'tirzepatida_72';
      }

      await persist();
      showToast('Perfil e metas salvos na planilha!');
      openMainApp();
    });
  }

  function populateDoseSelect(selectId, medId) {
    const sel = $(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    const med = window.MPA_DATA.MEDICATIONS[medId] || window.MPA_DATA.MEDICATIONS.tirzepatida;
    med.doses.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = window.fmtDoseMg(d);
      sel.appendChild(opt);
    });
  }

  function renderObMeasures() {
    const list = $('ob-medidas-list');
    list.innerHTML = '';
    state.obTempMeasures.forEach((m, idx) => {
      const tag = document.createElement('span');
      tag.className = 'badge badge-slate';
      tag.style.gap = '6px';
      tag.innerHTML = `${m.tipo}: ${window.fmtBR(m.valor, 1)} cm <button type="button" style="border:none;background:none;color:var(--danger);cursor:pointer;font-weight:700;">×</button>`;
      tag.querySelector('button').addEventListener('click', () => {
        state.obTempMeasures.splice(idx, 1);
        renderObMeasures();
      });
      list.appendChild(tag);
    });
  }

  function openOnboarding(allowCancel) {
    $('view-app').classList.add('hidden');
    $('view-onboarding').classList.remove('hidden');
    $('btn-cancel-onboarding').classList.toggle('hidden', !allowCancel);

    const ob = state.userData.onboarding || {};
    $('ob-altura').value = ob.altura || '';
    $('ob-idade').value = ob.idade || '';
    $('ob-sexo').value = ob.sexo || 'Masculino';
    $('ob-peso-atual').value = ob.pesoAtual || '';
    $('ob-peso-meta').value = ob.pesoMeta || '';
    $('ob-data-alvo').value = ob.dataAlvo || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    $('ob-data-inicio').value = ob.dataInicio || window.todayISO();
    $('ob-meta-kcal').value = ob.metaKcal || '';
    $('ob-meta-prot').value = ob.metaProteina || '';
    $('ob-usa-med').value = ob.usaMedicamento || 'nao';
    $('ob-med-fields').classList.toggle('hidden', $('ob-usa-med').value !== 'sim');
    if (ob.medicacao) {
      $('ob-medicacao').value = ob.medicacao;
      populateDoseSelect('ob-dose', ob.medicacao);
      if (ob.doseMg) $('ob-dose').value = String(ob.doseMg);
    }
    $('ob-intervalo').value = ob.intervaloDias || 7;
    $('ob-ultima-dose').value = ob.ultimaDose || '';
    if (ob.localUltimaAplicacao) $('ob-local-aplicacao').value = ob.localUltimaAplicacao;
    $('ob-acordo').value = ob.horarioAcordo || '06:30';
    $('ob-durmo').value = ob.horarioDurmo || '23:00';
    $('ob-treinos').value = ob.treinosSemana || '';
    $('ob-trabalho').value = ob.horarioTrabalho || '';
    $('ob-come-hoje').value = ob.comeHoje || '';
    $('ob-gosta').value = ob.comidasGosta || '';
    $('ob-nao-come').value = ob.comidasNaoCome || '';
    $('ob-tempo-cozinhar').value = ob.tempoCozinhar || '';
    $('ob-delivery').value = ob.deliveryFreq || '';
    $('ob-suplementos').value = ob.suplementos || '';

    state.obTempMeasures = [...(ob.medidasIniciais || [])];
    renderObMeasures();
  }

  function getRecommendedWaterMlPerKg(age) {
    if (age <= 17) return 40;
    if (age <= 55) return 35;
    if (age <= 65) return 30;
    return 25;
  }

  /* ==================== APLICATIVO PRINCIPAL ==================== */
  function openMainApp() {
    $('view-onboarding').classList.add('hidden');
    $('view-auth').classList.add('hidden');
    $('view-app').classList.remove('hidden');

    $('header-user-name').textContent = state.profile.nomeCompleto;
    $('drawer-user-name').textContent = state.profile.nomeCompleto;
    $('diary-date-picker').value = state.diaryDate;

    const ob = state.userData.onboarding || {};
    if (ob.medicacao) {
      state.pkMed = ob.medicacao;
      $('pk-med-select').value = ob.medicacao;
      $('dose-med').value = ob.medicacao;
      populateDoseSelect('dose-mg', ob.medicacao);
    }

    renderScoreboard();
    renderActiveTab();
    startNotificationLoop();
  }

  function renderScoreboard() {
    const today = window.todayISO();
    $('sb-date-label').textContent = window.fmtDateBR(today);
    const ob = state.userData.onboarding || {};
    const weighIns = [...(state.userData.weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
    const cutoff7 = Date.now() - 7 * 86400000;
    const last7W = weighIns.filter((w) => new Date(w.data + 'T12:00:00').getTime() >= cutoff7);
    const lastW = weighIns.length ? Number(weighIns[weighIns.length - 1].peso) : Number(ob.pesoAtual || 0);
    const avg7 = last7W.length
      ? last7W.reduce((s, w) => s + Number(w.peso), 0) / last7W.length
      : lastW;

    $('sb-peso-avg').textContent = avg7 ? `${window.fmtBR(avg7, 1)} kg` : '— kg';
    $('sb-peso-last').textContent = `Última: ${lastW ? window.fmtBR(lastW, 1) + ' kg' : '—'}`;
    const diffMeta = lastW && ob.pesoMeta ? (lastW - Number(ob.pesoMeta)) : null;
    $('sb-peso-meta-diff').textContent = diffMeta !== null
      ? `Meta: ${window.fmtBR(ob.pesoMeta, 1)} kg (faltam ${window.fmtBR(Math.max(0, diffMeta), 1)} kg)`
      : 'Meta não definida';

    // Kcal e Proteína do dia (hoje)
    const todayMeals = (state.userData.meals || []).filter((m) => m.data === today);
    const kcalTot = todayMeals.reduce((s, m) => s + Number(m.kcal || 0), 0);
    const protTot = todayMeals.reduce((s, m) => s + Number(m.proteina || 0), 0);
    const metaKcal = Number(ob.metaKcal || 2000);
    const metaProt = Number(ob.metaProteina || 140);

    $('sb-kcal-meta').textContent = `Meta: ${window.fmtBR(metaKcal, 0)}`;
    $('sb-kcal-val').textContent = `${window.fmtBR(kcalTot, 0)} kcal`;
    const kcalPct = Math.min(100, Math.round((kcalTot / Math.max(1, metaKcal)) * 100));
    const kcalBar = $('sb-kcal-bar');
    kcalBar.style.width = `${kcalPct}%`;
    const isOver5Pct = kcalTot > metaKcal * 1.05;
    kcalBar.classList.toggle('over-limit', isOver5Pct);

    const kcalRem = metaKcal - kcalTot;
    const kcalRemEl = $('sb-kcal-rem');
    if (kcalRem >= 0) {
      kcalRemEl.textContent = `Restam ${window.fmtBR(kcalRem, 0)} kcal`;
      kcalRemEl.classList.remove('danger-text');
    } else {
      kcalRemEl.textContent = `Excedeu ${window.fmtBR(Math.abs(kcalRem), 0)} kcal${isOver5Pct ? ' (>5% da meta!)' : ''}`;
      kcalRemEl.classList.toggle('danger-text', isOver5Pct);
    }

    $('sb-prot-meta').textContent = `Meta: ${window.fmtBR(metaProt, 0)} g`;
    $('sb-prot-val').textContent = `${window.fmtBR(protTot, 0)} g`;
    const protPct = Math.min(100, Math.round((protTot / Math.max(1, metaProt)) * 100));
    $('sb-prot-bar').style.width = `${protPct}%`;
    const protRem = Math.max(0, metaProt - protTot);
    $('sb-prot-rem').textContent = protRem > 0 ? `Faltam ${window.fmtBR(protRem, 0)} g` : 'Meta de proteína atingida!';
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.toggle('hidden', p.id !== `tab-${tabId}`);
    });
    renderActiveTab();
  }

  function renderActiveTab() {
    renderScoreboard();
    if (state.activeTab === 'cardapio') renderCardapioTab();
    else if (state.activeTab === 'diario') renderDiarioTab();
    else if (state.activeTab === 'evolucao') renderEvolucaoTab();
    else if (state.activeTab === 'semana') renderSemanaTab();
    else if (state.activeTab === 'plano') renderPlanoTab();
    else if (state.activeTab === 'medicacao') renderMedicacaoTab();
  }

  /* ==================== ABA 1: CARDÁPIO + GEMINI ==================== */
  function getDefaultDayMenu() {
    const ob = state.userData.onboarding || {};
    const k = Number(ob.metaKcal || 1900);
    const p = Number(ob.metaProteina || 140);
    return [
      { id: 'pm_1', hora: '07:30', nome: 'Café da manhã', status: 'a comer', itens: [{ nome: 'Ovos mexidos (3 un) + pão integral (2 fatias) + café', qtd: '1 porção', kcal: Math.round(k * 0.22), prot: Math.round(p * 0.22) }] },
      { id: 'pm_2', hora: '12:30', nome: 'Almoço', status: 'a comer', itens: [{ nome: 'Peito de frango grelhado + arroz + feijão + salada', qtd: '1 prato balanceado', kcal: Math.round(k * 0.35), prot: Math.round(p * 0.36) }] },
      { id: 'pm_3', hora: '16:30', nome: 'Lanche da tarde', status: 'a comer', itens: [{ nome: 'Iogurte proteico / Whey + 1 fruta', qtd: '1 porção', kcal: Math.round(k * 0.16), prot: Math.round(p * 0.18) }] },
      { id: 'pm_4', hora: '20:00', nome: 'Jantar', status: 'a comer', itens: [{ nome: 'Patinho moído ou peixe grelhado + legumes + batata', qtd: '1 prato', kcal: Math.round(k * 0.27), prot: Math.round(p * 0.24) }] }
    ];
  }

  function renderCardapioTab() {
    $('menu-date-display').textContent = window.fmtDateBR(state.menuDate);
    if (!state.userData.menus[state.menuDate]) {
      state.userData.menus[state.menuDate] = getDefaultDayMenu();
    }
    const dayMeals = state.userData.menus[state.menuDate];
    const ob = state.userData.onboarding || {};

    let planKcal = 0;
    let planProt = 0;
    dayMeals.forEach((m) => {
      (m.itens || []).forEach((it) => {
        planKcal += Number(it.kcal || 0);
        planProt += Number(it.prot || 0);
      });
    });

    const eatenKcal = (state.userData.meals || [])
      .filter((m) => m.data === state.menuDate)
      .reduce((s, m) => s + Number(m.kcal || 0), 0);

    $('menu-sum-kcal').textContent = `${window.fmtBR(planKcal, 0)} kcal`;
    $('menu-sum-meta').textContent = `${window.fmtBR(ob.metaKcal || 2000, 0)} kcal`;
    $('menu-sum-eaten').textContent = `${window.fmtBR(eatenKcal, 0)} kcal`;
    $('menu-sum-prot').textContent = `${window.fmtBR(planProt, 0)} g`;

    const list = $('menu-meals-list');
    list.innerHTML = '';
    dayMeals.forEach((meal, idx) => {
      const mKcal = (meal.itens || []).reduce((s, i) => s + Number(i.kcal || 0), 0);
      const mProt = (meal.itens || []).reduce((s, i) => s + Number(i.prot || 0), 0);
      const el = document.createElement('div');
      el.className = 'meal-item';
      const itemsHtml = (meal.itens || []).map((it) =>
        `<li style="margin:3px 0;font-size:0.84rem;">${it.nome} <span style="color:var(--text-soft);">(${it.qtd}) — ${window.fmtBR(it.kcal, 0)} kcal · ${window.fmtBR(it.prot, 0)} g prot</span></li>`
      ).join('');

      el.innerHTML = `
        <div class="meal-head">
          <div>
            <div class="meal-title">${meal.hora} · ${meal.nome}</div>
            <div class="meal-meta">${window.fmtBR(mKcal, 0)} kcal · ${window.fmtBR(mProt, 0)} g proteína</div>
          </div>
          <div class="input-row">
            <select class="menu-status-sel" data-idx="${idx}" style="width:auto;padding:5px 8px;font-size:0.8rem;">
              <option value="a comer" ${meal.status === 'a comer' ? 'selected' : ''}>A comer</option>
              <option value="feito" ${meal.status === 'feito' ? 'selected' : ''}>Feito</option>
              <option value="ajustado" ${meal.status === 'ajustado' ? 'selected' : ''}>Ajustado</option>
              <option value="pulado" ${meal.status === 'pulado' ? 'selected' : ''}>Pulado</option>
            </select>
          </div>
        </div>
        <ul style="padding-left:18px;margin-top:6px;">${itemsHtml}</ul>
      `;

      el.querySelector('.menu-status-sel').addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        const prevStatus = meal.status;
        meal.status = newStatus;
        if (newStatus === 'feito' && prevStatus !== 'feito') {
          // Lança no diário automaticamente ao marcar como feito
          state.userData.meals.push({
            id: 'm_' + Date.now(),
            data: state.menuDate,
            hora: meal.hora,
            refeicao: meal.nome,
            descricao: (meal.itens || []).map((i) => `${i.nome} (${i.qtd})`).join(', '),
            kcal: mKcal,
            proteina: mProt,
            delivery: false,
            estimadoIA: false
          });
          showToast(`${meal.nome} marcado como feito e lançado no Diário.`);
        }
        await persist();
        renderScoreboard();
        renderCardapioTab();
      });

      list.appendChild(el);
    });
  }

  async function sendMenuAiMessage(userText) {
    if (!userText.trim()) return;
    const msgs = $('menu-ai-messages');
    const uDiv = document.createElement('div');
    uDiv.className = 'ai-msg user';
    uDiv.textContent = userText;
    msgs.appendChild(uDiv);

    const bDiv = document.createElement('div');
    bDiv.className = 'ai-msg bot';
    bDiv.textContent = 'Pensando e calculando seu cardápio...';
    msgs.appendChild(bDiv);
    msgs.scrollTop = msgs.scrollHeight;

    const ob = state.userData.onboarding || {};
    const curMenu = state.userData.menus[state.menuDate] || [];
    const model = $('gemini-model-select').value;

    const systemInstruction = `Você é o nutricionista esportivo assistente do aplicativo Marcusnator Pro Athlete 2.0 By Dr. Hans.
Retorne EXCLUSIVAMENTE um JSON válido com a estrutura:
{
  "resposta": "mensagem curta em português explicando o cardápio ou o ajuste feito",
  "refeicoes": [
    {
      "hora": "07:30",
      "nome": "Café da manhã",
      "status": "a comer",
      "itens": [
        { "nome": "Alimento", "qtd": "quantidade", "kcal": 350, "prot": 25 }
      ]
    }
  ]
}
Regras:
- Respeite a meta diária de ${ob.metaKcal || 1900} kcal e ${ob.metaProteina || 140} g de proteína.
- Perfil do paciente: ${JSON.stringify(ob)}
- Cardápio atual do dia ${state.menuDate}: ${JSON.stringify(curMenu)}
- Se o paciente pedir para ajustar refeições restantes, mantenha intactas as que já estão como "feito" ou "pulado" e ajuste as demais.`;

    const res = await window.MPA_API.callGemini({
      prompt: userText,
      systemInstruction,
      preferredModel: model,
      expectJson: true
    });

    if (!res.ok) {
      bDiv.textContent = `Não foi possível chamar a API Gemini (${res.error}). Verifique sua chave nas Configurações.`;
      return;
    }

    try {
      const clean = res.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      bDiv.textContent = `${parsed.resposta || 'Cardápio atualizado!'} (${res.modelUsed})`;
      if (Array.isArray(parsed.refeicoes) && parsed.refeicoes.length > 0) {
        state.userData.menus[state.menuDate] = parsed.refeicoes.map((r, i) => ({
          id: 'pm_' + Date.now() + '_' + i,
          hora: r.hora || '12:00',
          nome: r.nome || 'Refeição',
          status: r.status || 'a comer',
          itens: Array.isArray(r.itens) ? r.itens : []
        }));
        await persist();
        renderCardapioTab();
      }
    } catch {
      bDiv.textContent = res.text;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  /* ==================== ABA 2: DIÁRIO + ESTIMADOR IA ==================== */
  function renderDiarioTab() {
    $('diary-date-sub').textContent = `Registros de ${window.fmtDateBR(state.diaryDate)}`;
    const meals = (state.userData.meals || []).filter((m) => m.data === state.diaryDate);
    const list = $('diary-meals-list');
    list.innerHTML = '';

    if (!meals.length) {
      list.innerHTML = '<p style="font-size:0.86rem;color:var(--text-soft);">Nenhuma refeição lançada nesta data.</p>';
    } else {
      meals.forEach((m) => {
        const div = document.createElement('div');
        div.className = 'meal-item';
        div.innerHTML = `
          <div class="meal-head">
            <div>
              <div class="meal-title">${m.hora} · ${m.refeicao}</div>
              <div style="font-size:0.85rem;margin-top:2px;">${m.descricao}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;">
                <span class="badge badge-teal">${window.fmtBR(m.kcal, 0)} kcal</span>
                <span class="badge badge-slate">${window.fmtBR(m.proteina, 0)} g prot</span>
                ${m.delivery ? '<span class="badge badge-warn">Delivery</span>' : ''}
                ${m.estimadoIA ? '<span class="badge badge-slate">Estimado pela IA</span>' : ''}
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm btn-rm-meal">Remover</button>
          </div>
        `;
        div.querySelector('.btn-rm-meal').addEventListener('click', () => {
          openConfirm(`Deseja remover "${m.refeicao} — ${m.descricao}" do diário?`, async () => {
            state.userData.meals = state.userData.meals.filter((x) => x.id !== m.id);
            await persist();
            renderScoreboard();
            renderDiarioTab();
            showToast('Refeição removida.');
          });
        });
        list.appendChild(div);
      });
    }

    // Treinos do dia
    const wks = (state.userData.workouts || []).filter((w) => w.data === state.diaryDate);
    const wkList = $('diary-workouts-list');
    wkList.innerHTML = wks.length
      ? wks.map((w) => `<div class="site-pill"><span>${w.atividade}</span><strong>${w.minutos} min</strong></div>`).join('')
      : '<p style="font-size:0.8rem;color:var(--text-soft);">Nenhum treino registrado nesta data.</p>';
  }

  async function estimateMealWithAI() {
    const desc = $('ai-food-desc').value.trim();
    const photoInput = $('ai-food-photo');
    const isDelivery = $('ai-food-delivery').checked;
    const fb = $('ai-estimate-feedback');

    if (!desc && (!photoInput.files || !photoInput.files.length)) {
      showToast('Descreva a refeição ou selecione uma foto.');
      return;
    }

    fb.classList.remove('hidden');
    fb.textContent = 'Analisando alimento pronto/cozido (cenário conservador mais calórico)...';

    let imageBase64 = null;
    let imageMimeType = null;
    if (photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      imageMimeType = file.type || 'image/jpeg';
      imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(file);
      });
    }

    const systemInstruction = `Você é um nutricionista especialista em estimativa calórica.
REGRAS OBRIGATÓRIAS:
1. Considere sempre o alimento JÁ PRONTO/COZIDO (incluindo óleos, molhos e preparo).
2. Na dúvida, escolha SEMPRE o cenário MAIS CALÓRICO (especialmente para comida de restaurante ou delivery).
3. Responda EXCLUSIVAMENTE em JSON válido:
{
  "refeicao": "Almoço",
  "descricao": "descrição resumida dos itens identificados",
  "kcal": 680,
  "proteina": 38,
  "observacao": "breve explicação da estimativa conservadora"
}`;

    const prompt = `Estime calorias e proteína desta refeição${isDelivery ? ' (DELIVERY / RESTAURANTE — considere gorduras de preparo)' : ''}. Descrição do usuário: ${desc || 'Analise a foto enviada.'}`;
    const res = await window.MPA_API.callGemini({
      prompt,
      systemInstruction,
      imageBase64,
      imageMimeType,
      expectJson: true
    });

    if (!res.ok) {
      fb.textContent = `Erro na IA: ${res.error}`;
      return;
    }

    try {
      const clean = res.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const nowHora = new Date().toTimeString().slice(0, 5);
      const mealObj = {
        id: 'm_' + Date.now(),
        data: state.diaryDate,
        hora: nowHora,
        refeicao: parsed.refeicao || 'Refeição',
        descricao: parsed.descricao || desc || 'Refeição por foto',
        kcal: Math.round(Number(parsed.kcal || 0)),
        proteina: Math.round(Number(parsed.proteina || 0)),
        delivery: isDelivery,
        estimadoIA: true
      };
      state.userData.meals.push(mealObj);
      await persist({
        sheet: 'DiarioRefeicoes',
        row: [mealObj.id, state.profile.userId, mealObj.data, mealObj.hora, mealObj.refeicao, mealObj.descricao, mealObj.kcal, mealObj.proteina, mealObj.delivery, mealObj.estimadoIA, new Date().toISOString()]
      });
      fb.textContent = `Lançado: ${mealObj.descricao} — ${mealObj.kcal} kcal · ${mealObj.proteina} g prot. (${parsed.observacao || ''})`;
      $('ai-food-desc').value = '';
      photoInput.value = '';
      $('ai-food-preview').innerHTML = '';
      renderScoreboard();
      renderDiarioTab();
    } catch {
      fb.textContent = `Resposta recebida: ${res.text}`;
    }
  }

  /* ==================== ABA 3: EVOLUÇÃO ==================== */
  function renderEvolucaoTab() {
    const ob = state.userData.onboarding || {};
    const weighIns = [...(state.userData.weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
    const firstW = weighIns.length ? Number(weighIns[0].peso) : Number(ob.pesoAtual || 0);
    const lastObj = weighIns.length ? weighIns[weighIns.length - 1] : null;
    const lastW = lastObj ? Number(lastObj.peso) : firstW;
    const goalW = Number(ob.pesoMeta || 0);

    $('evo-last-weight').textContent = lastW ? `${window.fmtBR(lastW, 1)} kg` : '— kg';
    $('evo-last-date').textContent = lastObj ? window.fmtDateBR(lastObj.data) : '';

    const diffStart = lastW - firstW;
    const pctStart = firstW > 0 ? (diffStart / firstW) * 100 : 0;
    $('evo-total-lost').textContent = `${diffStart > 0 ? '+' : ''}${window.fmtBR(diffStart, 1)} kg`;
    $('evo-pct-lost').textContent = `${pctStart > 0 ? '+' : ''}${window.fmtBR(pctStart, 1)}% do peso inicial`;

    // Ritmo semanal
    let weeklyRate = 0;
    if (weighIns.length >= 2) {
      const days = Math.max(1, (new Date(lastObj.data) - new Date(weighIns[0].data)) / 86400000);
      weeklyRate = (diffStart / days) * 7;
    }
    $('evo-weekly-rate').textContent = `${weeklyRate > 0 ? '+' : ''}${window.fmtBR(weeklyRate, 2)} kg/sem`;
    const remKg = Math.max(0, lastW - goalW);
    $('evo-remaining').textContent = `Faltam ${window.fmtBR(remKg, 1)} kg para a meta`;

    // Previsão de chegada à meta
    if (weeklyRate < -0.05 && remKg > 0) {
      const weeksNeeded = remKg / Math.abs(weeklyRate);
      const etaDate = new Date(Date.now() + weeksNeeded * 7 * 86400000);
      $('evo-eta').textContent = etaDate.toLocaleDateString('pt-BR');
    } else if (remKg <= 0 && goalW > 0) {
      $('evo-eta').textContent = 'Meta atingida!';
    } else {
      $('evo-eta').textContent = 'Aguardando ritmo';
    }
    $('evo-target-date').textContent = ob.dataAlvo ? `Alvo: ${window.fmtDateBR(ob.dataAlvo)}` : '';

    // Gráficos
    window.MPA_CHARTS.renderRealityProjectedChart('chart-reality-projected', {
      weighIns,
      doses: state.userData.doses,
      profile: ob,
      userEvents: state.userData.events,
      showStudy: state.evo1ShowStudy,
      studyKey: state.studyKey,
      showDoses: state.evo1ShowDoses
    });

    window.MPA_CHARTS.renderRealisticProjectedChart('chart-realistic-projected', {
      weighIns,
      doses: state.userData.doses,
      profile: ob,
      userEvents: state.userData.events,
      showStudy: state.evo2ShowStudy,
      studyKey: state.studyKey,
      showDoses: state.evo2ShowDoses
    });

    // Tabela de Avaliação do Tipo de Corpo (IMC × % Gordura)
    const heightM = parseFloat(String(ob.altura || '0').replace(',', '.'));
    const bmi = heightM > 0 && lastW > 0 ? lastW / (heightM * heightM) : null;
    const latestBio = state.userData.bioimpedance && state.userData.bioimpedance.length
      ? state.userData.bioimpedance[state.userData.bioimpedance.length - 1]
      : null;
    const fatPct = latestBio ? Number(latestBio.gorduraPct) : null;
    const activeZone = window.MPA_CHARTS.evaluateBodyType(bmi, fatPct);

    document.querySelectorAll('#body-type-grid .bt-cell').forEach((cell) => {
      cell.classList.toggle('active', cell.dataset.bt === activeZone);
    });

    $('bt-summary-text').textContent = bmi
      ? `IMC atual: ${window.fmtBR(bmi, 1)} kg/m²${fatPct ? ' · Gordura: ' + window.fmtBR(fatPct, 1) + '%' : ' (registre bioimpedância no Diário para destacar sua zona)'}`
      : 'Informe altura e peso para calcular IMC.';

    const bioBadges = $('bio-latest-badges');
    if (latestBio) {
      bioBadges.innerHTML = `
        <span class="badge badge-teal">Gordura: ${window.fmtBR(latestBio.gorduraPct, 1)}%</span>
        <span class="badge badge-slate">Músculo: ${window.fmtBR(latestBio.massaMuscularKg, 1)} kg</span>
        <span class="badge badge-slate">Água: ${window.fmtBR(latestBio.aguaPct, 1)}%</span>
        <span class="badge badge-slate">Visceral: ${latestBio.visceral || '—'}</span>
      `;
    } else {
      bioBadges.innerHTML = '<span style="font-size:0.78rem;color:var(--text-soft);">Sem registros de bioimpedância ainda.</span>';
    }

    // Histórico de cintura com variação
    const waistRows = weighIns.filter((w) => w.cintura || w.peso);
    const tbody = $('waist-history-tbody');
    tbody.innerHTML = '';
    let prevWaist = null;
    waistRows.forEach((w) => {
      let diffStr = '—';
      if (w.cintura && prevWaist !== null) {
        const d = Number(w.cintura) - prevWaist;
        diffStr = `${d > 0 ? '+' : ''}${window.fmtBR(d, 1)} cm`;
      }
      if (w.cintura) prevWaist = Number(w.cintura);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${window.fmtDateBR(w.data)}</td>
        <td>${w.cintura ? window.fmtBR(w.cintura, 1) + ' cm' : '—'}</td>
        <td>${diffStr}</td>
        <td>${w.peso ? window.fmtBR(w.peso, 1) + ' kg' : '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ==================== ABA 4: SEMANA ==================== */
  function renderSemanaTab() {
    const tbody = $('week-table-tbody');
    tbody.innerHTML = '';
    let sumKcal = 0, sumProt = 0, sumDeliv = 0, sumTrain = 0, activeDays = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dayMeals = (state.userData.meals || []).filter((m) => m.data === iso);
      const dayKcal = dayMeals.reduce((s, m) => s + Number(m.kcal || 0), 0);
      const dayProt = dayMeals.reduce((s, m) => s + Number(m.proteina || 0), 0);
      const dayDeliv = dayMeals.filter((m) => m.delivery).length;
      const dayWks = (state.userData.workouts || []).filter((w) => w.data === iso);
      const dayWeight = (state.userData.weighIns || []).find((w) => w.data === iso);

      if (dayMeals.length > 0) {
        sumKcal += dayKcal;
        sumProt += dayProt;
        activeDays++;
      }
      sumDeliv += dayDeliv;
      sumTrain += dayWks.length;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${window.fmtDateBR(iso)}</strong></td>
        <td>${dayKcal ? window.fmtBR(dayKcal, 0) + ' kcal' : '—'}</td>
        <td>${dayProt ? window.fmtBR(dayProt, 0) + ' g' : '—'}</td>
        <td>${dayDeliv}</td>
        <td>${dayWks.length ? dayWks.map((w) => `${w.atividade} (${w.minutos}m)`).join(', ') : '—'}</td>
        <td>${dayWeight && dayWeight.peso ? window.fmtBR(dayWeight.peso, 1) + ' kg' : '—'}</td>
      `;
      tbody.appendChild(tr);
    }

    const denom = activeDays || 1;
    $('wk-avg-kcal').textContent = `${window.fmtBR(sumKcal / denom, 0)} kcal`;
    $('wk-avg-prot').textContent = `${window.fmtBR(sumProt / denom, 0)} g`;
    $('wk-deliveries').textContent = String(sumDeliv);
    $('wk-trainings').textContent = String(sumTrain);
  }

  /* ==================== ABA 5: PLANO ==================== */
  function renderPlanoTab() {
    const ob = state.userData.onboarding || {};
    const weighIns = [...(state.userData.weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
    const curW = weighIns.length ? Number(weighIns[weighIns.length - 1].peso) : Number(ob.pesoAtual || 80);
    const idade = Number(ob.idade || 30);
    const recRate = getRecommendedWaterMlPerKg(idade);
    const mlKg = state.userData.waterMlPerKg || recRate;

    $('water-age-rule').textContent = `Recomendado (${idade} anos): ${recRate} ml/kg`;
    $('water-slider').value = mlKg;
    $('water-ml-kg-label').textContent = `${mlKg} ml/kg`;
    const totalMl = Math.round(curW * mlKg);
    $('water-total-target').textContent = `${window.fmtBR(totalMl / 1000, 2)} L (${window.fmtBR(totalMl, 0)} ml)`;
    const todayWater = state.userData.waterLog[window.todayISO()] || 0;
    $('water-consumed-label').textContent = `${window.fmtBR(todayWater, 0)} ml hoje`;

    // Semana de treinos com meta calórica
    const baseK = Number(ob.metaKcal || 1900);
    const daysPlan = [
      { dia: 'Segunda', foco: 'Treino de força + Revisão semanal', kcal: baseK + 100, dica: 'Revise a média de peso dos últimos 7 dias e organize as proteínas da semana.' },
      { dia: 'Terça', foco: 'Cardio moderado / Funcional', kcal: baseK, dica: 'Capriche na hidratação e fibras no almoço.' },
      { dia: 'Quarta', foco: 'Treino de força (pesado)', kcal: baseK + 150, dica: 'Concentre carboidratos limpos no pré e pós-treino.' },
      { dia: 'Quinta', foco: 'Recuperação ativa / Mobilidade', kcal: baseK - 100, dica: 'Dia ideal para manter déficit mais limpo e sono antecipado.' },
      { dia: 'Sexta', foco: 'Treino de força (pesado)', kcal: baseK + 150, dica: 'Bata a proteína antes do jantar para evitar exageros à noite.' },
      { dia: 'Sábado', foco: 'Cardio longo / Livre', kcal: baseK + 100, dica: 'Planeje sua refeição flexível com antecedência.' },
      { dia: 'Domingo', foco: 'Descanso + Preparo de marmitas', kcal: baseK - 50, dica: `Reserve ${ob.tempoCozinhar || '2h'} para preparar proteínas e vegetais da semana.` }
    ];
    $('plan-training-tbody').innerHTML = daysPlan.map((d) =>
      `<tr><td><strong>${d.dia}</strong></td><td>${d.foco}</td><td>${window.fmtBR(d.kcal, 0)} kcal</td><td>${d.dica}</td></tr>`
    ).join('');

    // Próximos eventos (eventos do usuário + próximos 3 feriados do Brasil)
    const today = window.todayISO();
    const upcomingHolidays = window.MPA_DATA.BRAZIL_HOLIDAYS.filter((h) => h.date >= today).slice(0, 3);
    const allEvs = [
      ...(state.userData.events || []).map((e) => ({ title: e.title, date: e.date, user: true, id: e.id })),
      ...upcomingHolidays.map((h) => ({ title: `Feriado BR: ${h.name}`, date: h.date, user: false }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    $('plan-events-list').innerHTML = allEvs.map((ev) => `
      <div class="meal-item">
        <div class="meal-head">
          <div class="meal-title">${window.fmtDateBR(ev.date)} — ${ev.title}</div>
          ${ev.user ? `<button type="button" class="btn btn-secondary btn-sm btn-del-ev" data-id="${ev.id}">Remover</button>` : '<span class="badge badge-slate">Feriado Nacional</span>'}
        </div>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-top:6px;">
          <strong>Antes:</strong> Mantenha proteína alta e não chegue em jejum prolongado.<br/>
          <strong>No dia:</strong> Comece por proteínas/salada, intercale álcool com água e escolha o que realmente vale a pena.<br/>
          <strong>Depois:</strong> Retome a rotina normal imediatamente — não faça jejuns punitivos; a subida de 0,5–1 kg na balança é retenção hídrica.
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-del-ev').forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.userData.events = state.userData.events.filter((x) => x.id !== btn.dataset.id);
        await persist();
        renderPlanoTab();
      });
    });

    // Cardápio base
    const baseMeals = getDefaultDayMenu();
    let totK = 0, totP = 0;
    $('plan-base-menu').innerHTML = baseMeals.map((m) => {
      const mk = m.itens.reduce((s, i) => s + i.kcal, 0);
      const mp = m.itens.reduce((s, i) => s + i.prot, 0);
      totK += mk; totP += mp;
      return `<div class="site-pill" style="margin-bottom:6px;"><span><strong>${m.hora} ${m.nome}:</strong> ${m.itens[0].nome}</span><span>${mk} kcal · ${mp}g P</span></div>`;
    }).join('') + `<div style="font-weight:700;font-size:0.86rem;margin-top:8px;">Total do dia base: ${window.fmtBR(totK, 0)} kcal · ${window.fmtBR(totP, 0)} g proteína</div>`;

    // Trocas equivalentes
    const sw = window.MPA_DATA.FOOD_SWAPS;
    $('plan-swaps-list').innerHTML = `
      <p style="font-weight:700;font-size:0.82rem;color:var(--primary);margin-bottom:4px;">Proteínas</p>
      ${sw.proteinas.map((x) => `<p style="font-size:0.8rem;margin-bottom:6px;"><strong>${x.base}</strong> ⇄ ${x.swap} <span style="color:var(--text-soft);">(${x.macros})</span></p>`).join('')}
      <p style="font-weight:700;font-size:0.82rem;color:var(--primary);margin:8px 0 4px;">Carboidratos</p>
      ${sw.carboidratos.map((x) => `<p style="font-size:0.8rem;margin-bottom:6px;"><strong>${x.base}</strong> ⇄ ${x.swap} <span style="color:var(--text-soft);">(${x.macros})</span></p>`).join('')}
      <p style="font-weight:700;font-size:0.82rem;color:var(--primary);margin:8px 0 4px;">Lanches</p>
      ${sw.lanches.map((x) => `<p style="font-size:0.8rem;margin-bottom:6px;"><strong>${x.base}</strong> ⇄ ${x.swap} <span style="color:var(--text-soft);">(${x.macros})</span></p>`).join('')}
    `;

    // Regras
    $('plan-rules-box').innerHTML = `
      <p style="font-weight:700;color:var(--primary);margin-bottom:4px;">Regras do Dia a Dia</p>
      <ul style="padding-left:18px;margin-bottom:10px;">
        <li>Proteína magra em todas as refeições principais (meta: ${ob.metaProteina || 140} g/dia).</li>
        <li>Água meta: ${window.fmtBR(totalMl / 1000, 2)} L distribuídos ao longo do dia.</li>
        <li>Sono regular: dormir próximo de ${ob.horarioDurmo || '23:00'} e acordar às ${ob.horarioAcordo || '06:30'}.</li>
      </ul>
      <p style="font-weight:700;color:var(--primary);margin-bottom:4px;">Regras para o Fim de Semana</p>
      <ul style="padding-left:18px;">
        <li>Suas preferências preservadas: <em>${ob.comidasGosta || 'Pizza, doces e saídas sociais com moderação'}</em>.</li>
        <li>Pizza: prefira 2–3 fatias acompanhadas de proteína antes, evitando borda recheada.</li>
        <li>Bebidas alcoólicas: 1 copo de água para cada dose; prefira destilados com gelo/água com gás ou vinho seco.</li>
        <li>Doces: porção individual planejada logo após refeição rica em proteína.</li>
      </ul>
    `;

    // Marmitas & Delivery
    $('plan-prep-delivery-box').innerHTML = `
      <p style="font-weight:700;color:var(--primary);margin-bottom:4px;">Marmitas (${ob.tempoCozinhar || '2h no domingo'})</p>
      <ul style="padding-left:18px;margin-bottom:10px;">
        <li><strong>Compras:</strong> 1,5 kg peito de frango, 1 kg patinho moído, 30 ovos, arroz/batata, legumes variados e frutas.</li>
        <li><strong>Ordem de preparo:</strong> 1) Coloque arroz e legumes no vapor/forno; 2) Grelhe frango e refogue patinho simultaneamente; 3) Porcione em potes pesados já prontos.</li>
      </ul>
      <p style="font-weight:700;color:var(--primary);margin-bottom:4px;">Guia do Delivery</p>
      <ul style="padding-left:18px;">
        <li><strong>Pedir:</strong> Grelhados (frango/peixe/filé) + arroz + feijão + salada, poke com proteína extra e molho à parte, temaki sem cream cheese, hambúrguer artesanal sem batata frita.</li>
        <li><strong>Evitar:</strong> Frituras empanadas, molhos cremosos/quatro queijos, combos com refrigerante açucarado e rodízios sem planejamento.</li>
      </ul>
    `;
  }

  /* ==================== ABA 6: MEDICAÇÃO ==================== */
  function renderMedicacaoTab() {
    const doses = [...(state.userData.doses || [])].sort((a, b) => a.dataHora.localeCompare(b.dataHora));
    const medInfo = window.MPA_DATA.MEDICATIONS[state.pkMed];
    $('pk-citation').textContent = `Referência farmacocinética: ${medInfo ? medInfo.pkRef : ''}`;

    window.MPA_CHARTS.renderPKChart('chart-pk', {
      doses,
      medId: state.pkMed,
      rangeDays: state.pkDays,
      showAvg7: state.pkShowAvg7,
      onHoverUpdate: ({ currentAmt, currentAvg7, currentPctOfPeak, hovered }) => {
        $('pk-header-summary').textContent = `Nível atual: ${window.fmtBR(currentAmt, 2)} mg (${currentPctOfPeak}%) · Média 7 dias: ${window.fmtBR(currentAvg7, 2)} mg`;
        const bar = $('pk-compare-bar');
        if (hovered) {
          const diff = hovered.diffFromCurrent;
          const sign = diff > 0 ? '+' : '';
          bar.innerHTML = `
            <span><strong>Hoje:</strong> ${window.fmtBR(currentAmt, 2)} mg (Média 7d: ${window.fmtBR(currentAvg7, 2)} mg)</span>
            <span class="pk-compare-highlight">Selecionado (${hovered.dateStr}): ${window.fmtBR(hovered.amt, 2)} mg (${sign}${window.fmtBR(diff, 2)} mg vs hoje)</span>
          `;
        } else {
          bar.innerHTML = `
            <span><strong>Hoje:</strong> ${window.fmtBR(currentAmt, 2)} mg (${currentPctOfPeak}% do pico)</span>
            <span><strong>Média 7 dias:</strong> ${window.fmtBR(currentAvg7, 2)} mg · Arraste o dedo ou mouse no gráfico para comparar</span>
          `;
        }
      }
    });

    // Gráfico Peso vs Estudos
    const study = window.MPA_DATA.CLINICAL_STUDIES[state.studyKey];
    $('study-citation').textContent = study ? `Fonte: ${study.citation}` : '';
    window.MPA_CHARTS.renderStudyComparisonChart('chart-study-compare', {
      weighIns: state.userData.weighIns,
      doses,
      studyKey: state.studyKey,
      unitMode: state.studyUnit,
      showDoses: state.studyShowDoses
    });

    // Rodízio inteligente de locais de aplicação
    const sites = window.MPA_DATA.INJECTION_SITES;
    const lastDose = doses.length ? doses[doses.length - 1] : null;
    let nextSiteIdx = 0;
    if (lastDose && lastDose.local) {
      const idx = sites.findIndex((s) => s.label === lastDose.local);
      nextSiteIdx = idx >= 0 ? (idx + 1) % sites.length : 0;
    }
    const suggestedSite = sites[nextSiteIdx];

    const rotBox = $('site-rotation-box');
    rotBox.innerHTML = `
      <div class="site-pill">
        <span>Último local aplicado</span>
        <strong>${lastDose ? lastDose.local : 'Nenhum registro'}</strong>
      </div>
      <div class="site-pill recommended">
        <span>Próximo local sugerido (rodízio)</span>
        <span>${suggestedSite.label}</span>
      </div>
    `;

    // Pré-seleciona o local sugerido no formulário
    if ($('dose-site')) $('dose-site').value = suggestedSite.label;

    // Histórico recente
    const hList = $('doses-history-list');
    hList.innerHTML = '';
    const rev = [...doses].reverse().slice(0, 8);
    if (!rev.length) {
      hList.innerHTML = '<p style="font-size:0.8rem;color:var(--text-soft);">Nenhuma aplicação registrada ainda.</p>';
    } else {
      rev.forEach((d) => {
        const col = window.MPA_CHARTS.getDoseColor(d.medicacao, d.doseMg);
        const row = document.createElement('div');
        row.className = 'site-pill';
        row.innerHTML = `
          <div>
            <span class="badge" style="background:${col};color:#fff;margin-right:6px;">${window.fmtDoseMg(d.doseMg)}</span>
            <strong>${window.fmtDateBR(d.dataHora)}</strong>
            <div style="font-size:0.74rem;color:var(--text-soft);">${d.medicacao} · ${d.local}</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-del-dose">×</button>
        `;
        row.querySelector('.btn-del-dose').addEventListener('click', () => {
          openConfirm(`Remover aplicação de ${window.fmtDoseMg(d.doseMg)} em ${window.fmtDateBR(d.dataHora)}?`, async () => {
            state.userData.doses = state.userData.doses.filter((x) => x.id !== d.id);
            await persist();
            renderMedicacaoTab();
          });
        });
        hList.appendChild(row);
      });
    }
  }

  /* ==================== EFCA (COMPULSÃO / FENÓTIPOS ALIMENTARES) ==================== */
  function openEfcaModal() {
    const body = $('efca-body');
    const existing = state.userData.efcaResult;
    let html = '';

    if (existing) {
      html += renderEfcaResultHtml(existing);
      html += `<button type="button" id="btn-redo-efca" class="btn btn-secondary btn-block" style="margin-top:10px;">Refazer Questionário EFCA</button>`;
      body.innerHTML = html;
      $('btn-redo-efca').addEventListener('click', () => renderEfcaForm());
    } else {
      renderEfcaForm();
    }
    $('modal-efca').classList.remove('hidden');
  }

  function renderEfcaForm() {
    const body = $('efca-body');
    const qs = window.MPA_DATA.EFCA_QUESTIONS;
    const likert = window.MPA_DATA.EFCA_LIKERT;
    const formHtml = qs.map((q) => `
      <div class="meal-item">
        <div style="font-weight:600;font-size:0.88rem;margin-bottom:8px;">${q.num}. ${q.text}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${likert.map((opt) => `
            <label style="flex:1 1 85px;display:flex;align-items:center;gap:4px;font-size:0.78rem;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">
              <input type="radio" name="efca_q_${q.num}" value="${opt.value}" required /> ${opt.label}
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    body.innerHTML = `
      <form id="form-efca">
        ${formHtml}
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:10px;">Calcular Meu Perfil Alimentar (EFCA)</button>
      </form>
    `;

    $('form-efca').addEventListener('submit', async (e) => {
      e.preventDefault();
      const answers = {};
      qs.forEach((q) => {
        const checked = document.querySelector(`input[name="efca_q_${q.num}"]:checked`);
        answers[q.num] = checked ? parseInt(checked.value, 10) : 1;
      });

      const scores = {};
      let total = 0;
      Object.keys(window.MPA_DATA.EFCA_SUBSCALES).forEach((key) => {
        const sub = window.MPA_DATA.EFCA_SUBSCALES[key];
        let sum = 0;
        sub.items.forEach((itemNum) => {
          const qObj = qs.find((x) => x.num === itemNum);
          const raw = answers[itemNum];
          sum += qObj && qObj.reversed ? (6 - raw) : raw;
        });
        total += sum;
        let level = 'Baixo';
        if (sum > sub.medMax) level = 'Alto';
        else if (sum > sub.lowMax) level = 'Médio';
        scores[key] = { score: sum, max: sub.max, level };
      });

      let totalLevel = 'Baixo';
      if (total >= 49) totalLevel = 'Alto';
      else if (total >= 38) totalLevel = 'Médio';

      const result = {
        id: 'efca_' + Date.now(),
        date: window.todayISO(),
        total,
        totalLevel,
        scores,
        answers
      };
      state.userData.efcaResult = result;
      await persist({
        sheet: 'EFCA',
        row: [result.id, state.profile.userId, result.date, result.total, scores.hiperfagico.score, scores.hedonico.score, scores.emocional.score, scores.desorganizado.score, scores.compulsivo.score, JSON.stringify(answers)]
      });
      showToast('Resultado EFCA calculado e salvo na planilha!');
      openEfcaModal();
    });
  }

  function renderEfcaResultHtml(res) {
    const cards = Object.keys(window.MPA_DATA.EFCA_SUBSCALES).map((key) => {
      const meta = window.MPA_DATA.EFCA_SUBSCALES[key];
      const sc = res.scores[key];
      const badgeCls = sc.level === 'Alto' ? 'badge-danger' : sc.level === 'Médio' ? 'badge-warn' : 'badge-success';
      const pct = Math.round((sc.score / meta.max) * 100);
      return `
        <div class="meal-item">
          <div class="meal-head">
            <span class="meal-title">${meta.name}</span>
            <span class="badge ${badgeCls}">${sc.score}/${meta.max} · ${sc.level}</span>
          </div>
          <div class="progress-track" style="margin:6px 0;"><div class="progress-fill ${sc.level === 'Alto' ? 'over-limit' : ''}" style="width:${pct}%"></div></div>
          <p style="font-size:0.8rem;color:var(--text-soft);">${meta.desc}</p>
        </div>
      `;
    }).join('');

    return `
      <div class="alert-box info" style="margin-bottom:12px;">
        <strong>Escore Total (${window.fmtDateBR(res.date)}):</strong> ${res.total} pontos — <strong>${res.totalLevel}</strong> (Baixo: 16–37 | Médio: 38–48 | Alto: ≥49).<br/>
        <span style="font-size:0.78rem;">Instrumento educativo de rastreio (Pineda-Wieselberg et al., Arch Endocrinol Metab 2025). Não substitui diagnóstico médico/psicológico.</span>
      </div>
      ${cards}
    `;
  }

  /* ==================== NOTIFICAÇÕES PERSONALIZADAS ==================== */
  function openNotificationsModal() {
    const cfg = state.userData.notifications;
    $('notif-tone').value = cfg.tone || 'moderada';
    const list = $('notif-list');
    list.innerHTML = '';

    cfg.items.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'meal-item';
      div.innerHTML = `
        <div class="meal-head" style="margin-bottom:6px;">
          <label style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:0.88rem;cursor:pointer;">
            <input type="checkbox" class="notif-en" data-idx="${idx}" ${item.enabled ? 'checked' : ''} />
            ${item.label}
          </label>
          <input type="time" class="notif-time" data-idx="${idx}" value="${item.time}" style="width:auto;padding:4px 8px;" />
        </div>
        <input type="text" class="notif-reason" data-idx="${idx}" value="${item.reason}" placeholder="Motivo personalizado da notificação..." />
      `;
      list.appendChild(div);
    });

    $('modal-notifications').classList.remove('hidden');
  }

  function fireNotification(title, reason) {
    const toneKey = (state.userData.notifications && state.userData.notifications.tone) || 'moderada';
    const prefix = window.MPA_DATA.NOTIFICATION_TONES[toneKey].prefix;
    const body = `${prefix} ${reason}`;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Marcusnator 2.0 · ${title}`, { body, icon: './icons/icon-192.png' });
    } else {
      showToast(`${title}: ${body}`);
    }
  }

  function startNotificationLoop() {
    if (state.notifTimer) clearInterval(state.notifTimer);
    state.notifTimer = setInterval(() => {
      if (!state.userData || !state.userData.notifications) return;
      const nowHM = new Date().toTimeString().slice(0, 5);
      state.userData.notifications.items.forEach((it) => {
        if (it.enabled && it.time === nowHM) {
          fireNotification(it.label, it.reason);
        }
      });
    }, 60000);
  }

  /* ==================== EVENTOS GERAIS E INICIALIZAÇÃO ==================== */
  function bindEvents() {
    // Placar toggle
    $('btn-toggle-scoreboard').addEventListener('click', () => {
      state.scoreboardVisible = !state.scoreboardVisible;
      $('scoreboard-wrap').classList.toggle('hidden', !state.scoreboardVisible);
      $('btn-toggle-scoreboard').textContent = state.scoreboardVisible ? 'Ocultar Placar' : 'Mostrar Placar';
    });

    $('btn-toggle-theme').addEventListener('click', toggleTheme);

    // Drawer 2 riscos
    $('btn-open-drawer').addEventListener('click', () => $('drawer-backdrop').classList.remove('hidden'));
    $('btn-close-drawer').addEventListener('click', () => $('drawer-backdrop').classList.add('hidden'));
    $('drawer-backdrop').addEventListener('click', (e) => {
      if (e.target === $('drawer-backdrop')) $('drawer-backdrop').classList.add('hidden');
    });

    $('menu-switch-profile').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      $('view-app').classList.add('hidden');
      $('view-auth').classList.remove('hidden');
      loadProfilesList();
    });
    $('menu-logout').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      state.profile = null;
      state.userData = null;
      try { localStorage.removeItem('mpa_v2_active_profile'); } catch {}
      $('view-app').classList.add('hidden');
      $('view-auth').classList.remove('hidden');
      showToast('Logout realizado.');
    });
    $('menu-edit-onboarding').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      openOnboarding(true);
    });
    $('menu-open-efca').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      openEfcaModal();
    });
    $('btn-open-efca-inline').addEventListener('click', openEfcaModal);

    $('menu-open-pdf').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      $('modal-pdf').classList.remove('hidden');
    });
    $('btn-generate-pdf-now').addEventListener('click', () => {
      const includeEfca = $('pdf-include-efca').checked;
      window.MPA_PDF.generateMedicalReport({
        profile: state.profile,
        userData: state.userData,
        includeEfca
      });
      $('modal-pdf').classList.add('hidden');
      showToast('Relatório PDF gerado!');
    });

    $('menu-open-notifications').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      openNotificationsModal();
    });
    $('btn-request-notif-perm').addEventListener('click', async () => {
      if (!('Notification' in window)) {
        showToast('Seu navegador não suporta notificações nativas; usaremos avisos no app.');
        return;
      }
      const perm = await Notification.requestPermission();
      showToast(perm === 'granted' ? 'Notificações ativadas!' : 'Permissão negada pelo navegador.');
    });
    $('btn-test-notif').addEventListener('click', () => {
      state.userData.notifications.tone = $('notif-tone').value;
      fireNotification('Beber água', 'Beba um copo de água agora para bater sua meta diária.');
    });
    $('btn-save-notifs').addEventListener('click', async () => {
      state.userData.notifications.tone = $('notif-tone').value;
      document.querySelectorAll('.notif-en').forEach((el) => {
        const i = Number(el.dataset.idx);
        state.userData.notifications.items[i].enabled = el.checked;
      });
      document.querySelectorAll('.notif-time').forEach((el) => {
        const i = Number(el.dataset.idx);
        state.userData.notifications.items[i].time = el.value;
      });
      document.querySelectorAll('.notif-reason').forEach((el) => {
        const i = Number(el.dataset.idx);
        state.userData.notifications.items[i].reason = el.value;
      });
      await persist();
      $('modal-notifications').classList.add('hidden');
      showToast('Notificações salvas!');
    });

    $('menu-open-settings').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      const cfg = window.MPA_API.getConfig();
      $('cfg-script-url').value = cfg.appsScriptUrl;
      $('cfg-gemini-key').value = cfg.geminiApiKey;
      $('cfg-gemini-model').value = cfg.geminiModel;
      $('modal-settings').classList.remove('hidden');
    });
    $('btn-save-settings').addEventListener('click', () => {
      window.MPA_API.saveConfig({
        appsScriptUrl: $('cfg-script-url').value.trim(),
        geminiApiKey: $('cfg-gemini-key').value.trim(),
        geminiModel: $('cfg-gemini-model').value.trim()
      });
      $('modal-settings').classList.add('hidden');
      showToast('Configurações atualizadas!');
    });

    $('menu-install-pwa').addEventListener('click', () => {
      $('drawer-backdrop').classList.add('hidden');
      $('modal-install').classList.remove('hidden');
    });

    // Changelog SemVer
    $('btn-open-changelog').addEventListener('click', () => {
      $('changelog-body').innerHTML = window.MPA_DATA.CHANGELOG.map((c) => `
        <div class="meal-item">
          <div class="meal-head">
            <strong>v${c.version} (${c.type})</strong>
            <span class="badge badge-slate">${window.fmtDateBR(c.date)}</span>
          </div>
          <ul style="padding-left:18px;margin-top:6px;font-size:0.84rem;">
            ${c.items.map((it) => `<li>${it}</li>`).join('')}
          </ul>
        </div>
      `).join('');
      $('modal-changelog').classList.remove('hidden');
    });

    // Fechar modais
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => $(btn.dataset.closeModal).classList.add('hidden'));
    });

    // Modal confirmação
    $('btn-confirm-cancel').addEventListener('click', () => $('modal-confirm').classList.add('hidden'));
    $('btn-confirm-ok').addEventListener('click', () => {
      $('modal-confirm').classList.add('hidden');
      if (state.confirmCallback) state.confirmCallback();
      state.confirmCallback = null;
    });

    // Abas principais
    document.querySelectorAll('.tabs-nav .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Cardápio navegação de dias e IA
    $('btn-menu-prev').addEventListener('click', () => {
      const d = new Date(state.menuDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      state.menuDate = d.toISOString().slice(0, 10);
      renderCardapioTab();
    });
    $('btn-menu-next').addEventListener('click', () => {
      const d = new Date(state.menuDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      state.menuDate = d.toISOString().slice(0, 10);
      renderCardapioTab();
    });
    $('btn-menu-ai-send').addEventListener('click', () => {
      const inp = $('menu-ai-input');
      const txt = inp.value;
      inp.value = '';
      sendMenuAiMessage(txt);
    });
    document.querySelectorAll('.quick-ai-btn').forEach((b) => {
      b.addEventListener('click', () => sendMenuAiMessage(b.dataset.prompt));
    });

    // Diário
    $('diary-date-picker').addEventListener('change', (e) => {
      state.diaryDate = e.target.value || window.todayISO();
      renderDiarioTab();
    });
    $('ai-food-photo').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      $('ai-food-preview').innerHTML = `<img src="${url}" alt="Prato" style="max-height:110px;border-radius:8px;border:1px solid var(--border);" />`;
    });
    $('btn-ai-estimate').addEventListener('click', estimateMealWithAI);

    $('form-manual-meal').addEventListener('submit', async (e) => {
      e.preventDefault();
      const m = {
        id: 'm_' + Date.now(),
        data: state.diaryDate,
        hora: $('mm-hora').value,
        refeicao: $('mm-tipo').value,
        descricao: $('mm-desc').value.trim(),
        kcal: parseInt($('mm-kcal').value, 10) || 0,
        proteina: parseInt($('mm-prot').value, 10) || 0,
        delivery: $('mm-delivery').checked,
        estimadoIA: false
      };
      state.userData.meals.push(m);
      await persist({
        sheet: 'DiarioRefeicoes',
        row: [m.id, state.profile.userId, m.data, m.hora, m.refeicao, m.descricao, m.kcal, m.proteina, m.delivery, m.estimadoIA, new Date().toISOString()]
      });
      e.target.reset();
      renderScoreboard();
      renderDiarioTab();
      showToast('Refeição adicionada ao Diário!');
    });

    $('form-weighin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const peso = parseFloat($('wi-peso').value) || null;
      const cintura = parseFloat($('wi-cintura').value) || null;
      const gorduraPct = parseFloat($('bio-gordura').value) || null;
      const massaMuscularKg = parseFloat($('bio-musculo').value) || null;
      const aguaPct = parseFloat($('bio-agua').value) || null;
      const visceral = parseInt($('bio-visceral').value, 10) || null;

      if (!peso && !cintura && !gorduraPct) {
        showToast('Informe peso, cintura ou dados de bioimpedância.');
        return;
      }

      const id = 'wi_' + Date.now();
      if (peso || cintura) {
        const existingIdx = state.userData.weighIns.findIndex((w) => w.data === state.diaryDate);
        if (existingIdx >= 0) {
          if (peso) state.userData.weighIns[existingIdx].peso = peso;
          if (cintura) state.userData.weighIns[existingIdx].cintura = cintura;
        } else {
          state.userData.weighIns.push({ id, data: state.diaryDate, peso, cintura });
        }
      }
      if (gorduraPct || massaMuscularKg || aguaPct || visceral) {
        state.userData.bioimpedance.push({
          id: 'bio_' + Date.now(),
          data: state.diaryDate,
          gorduraPct,
          massaMuscularKg,
          aguaPct,
          visceral
        });
      }

      await persist({
        sheet: 'PesagensMedidas',
        row: [id, state.profile.userId, state.diaryDate, peso || '', cintura || '', '', JSON.stringify({ gorduraPct, massaMuscularKg, aguaPct, visceral }), new Date().toISOString()]
      });
      e.target.reset();
      renderScoreboard();
      showToast('Medição registrada na planilha!');
    });

    $('form-workout').addEventListener('submit', async (e) => {
      e.preventDefault();
      const wk = {
        id: 'wk_' + Date.now(),
        data: state.diaryDate,
        atividade: $('wk-atividade').value.trim(),
        minutos: parseInt($('wk-minutos').value, 10) || 0
      };
      state.userData.workouts.push(wk);
      await persist({
        sheet: 'Treinos',
        row: [wk.id, state.profile.userId, wk.data, wk.atividade, wk.minutos, new Date().toISOString()]
      });
      e.target.reset();
      renderDiarioTab();
      showToast('Treino registrado!');
    });

    // Evolução toggles + Revisão de Segunda
    $('toggle-evo1-study').addEventListener('click', (e) => {
      state.evo1ShowStudy = !state.evo1ShowStudy;
      e.target.classList.toggle('active', state.evo1ShowStudy);
      renderEvolucaoTab();
    });
    $('toggle-evo1-doses').addEventListener('click', (e) => {
      state.evo1ShowDoses = !state.evo1ShowDoses;
      e.target.classList.toggle('active', state.evo1ShowDoses);
      renderEvolucaoTab();
    });
    $('toggle-evo2-study').addEventListener('click', (e) => {
      state.evo2ShowStudy = !state.evo2ShowStudy;
      e.target.classList.toggle('active', state.evo2ShowStudy);
      renderEvolucaoTab();
    });
    $('toggle-evo2-doses').addEventListener('click', (e) => {
      state.evo2ShowDoses = !state.evo2ShowDoses;
      e.target.classList.toggle('active', state.evo2ShowDoses);
      renderEvolucaoTab();
    });
    $('btn-monday-review').addEventListener('click', () => {
      const ws = [...(state.userData.weighIns || [])].sort((a, b) => a.data.localeCompare(b.data));
      const now = Date.now();
      const wThis = ws.filter((x) => new Date(x.data).getTime() >= now - 7 * 86400000);
      const wPrev = ws.filter((x) => {
        const t = new Date(x.data).getTime();
        return t < now - 7 * 86400000 && t >= now - 14 * 86400000;
      });
      if (!wThis.length || !wPrev.length) {
        showToast('Registre pesagens em pelo menos 2 semanas para a revisão automática de segunda-feira.');
        return;
      }
      const avgThis = wThis.reduce((s, x) => s + Number(x.peso), 0) / wThis.length;
      const avgPrev = wPrev.reduce((s, x) => s + Number(x.peso), 0) / wPrev.length;
      const delta = avgThis - avgPrev;
      if (delta >= -0.1) {
        showToast(`Média semanal estagnada (${delta >= 0 ? '+' : ''}${window.fmtBR(delta, 2)} kg). Considere revisar calorias ou passos com seu profissional.`);
      } else {
        showToast(`Ótima evolução semanal: ${window.fmtBR(delta, 2)} kg na média dos últimos 7 dias!`);
      }
    });

    // Plano: Água e Eventos
    $('water-slider').addEventListener('input', async (e) => {
      state.userData.waterMlPerKg = parseInt(e.target.value, 10);
      renderPlanoTab();
      await persist();
    });
    $('btn-water-add').addEventListener('click', async () => {
      const today = window.todayISO();
      state.userData.waterLog[today] = (state.userData.waterLog[today] || 0) + 250;
      renderPlanoTab();
      await persist();
      showToast('+250 ml de água registrados!');
    });
    $('form-add-event').addEventListener('submit', async (e) => {
      e.preventDefault();
      state.userData.events.push({
        id: 'ev_' + Date.now(),
        title: $('ev-title').value.trim(),
        date: $('ev-date').value
      });
      e.target.reset();
      await persist();
      renderPlanoTab();
      showToast('Evento adicionado ao plano!');
    });

    // Medicação
    $('pk-med-select').addEventListener('change', (e) => {
      state.pkMed = e.target.value;
      renderMedicacaoTab();
    });
    $('btn-pk-avg7').addEventListener('click', (e) => {
      state.pkShowAvg7 = !state.pkShowAvg7;
      e.target.classList.toggle('active', state.pkShowAvg7);
      renderMedicacaoTab();
    });
    document.querySelectorAll('#pk-period-bar [data-pk-days]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#pk-period-bar [data-pk-days]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.pkDays = parseInt(btn.dataset.pkDays, 10);
        renderMedicacaoTab();
      });
    });

    $('study-select').addEventListener('change', (e) => {
      state.studyKey = e.target.value;
      renderMedicacaoTab();
    });
    $('btn-study-unit').addEventListener('click', (e) => {
      state.studyUnit = state.studyUnit === 'pct' ? 'kg' : 'pct';
      e.target.textContent = state.studyUnit === 'pct' ? '%' : 'kg';
      renderMedicacaoTab();
    });
    $('btn-study-doses').addEventListener('click', (e) => {
      state.studyShowDoses = !state.studyShowDoses;
      e.target.classList.toggle('active', state.studyShowDoses);
      renderMedicacaoTab();
    });

    // Formulário de aplicação
    $('dose-med').addEventListener('change', () => populateDoseSelect('dose-mg', $('dose-med').value));
    populateDoseSelect('dose-mg', 'tirzepatida');
    const ds = $('dose-site');
    window.MPA_DATA.INJECTION_SITES.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.label;
      opt.textContent = s.label;
      ds.appendChild(opt);
    });
    $('dose-datetime').value = new Date().toISOString().slice(0, 16);

    $('form-add-dose').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dObj = {
        id: 'd_' + Date.now(),
        dataHora: $('dose-datetime').value,
        medicacao: $('dose-med').value,
        doseMg: parseFloat($('dose-mg').value),
        local: $('dose-site').value
      };
      state.userData.doses.push(dObj);
      state.pkMed = dObj.medicacao;
      $('pk-med-select').value = dObj.medicacao;
      await persist({
        sheet: 'Aplicacoes',
        row: [dObj.id, state.profile.userId, dObj.dataHora, dObj.medicacao, dObj.doseMg, dObj.local, '', new Date().toISOString()]
      });
      renderMedicacaoTab();
      showToast(`Aplicação de ${window.fmtDoseMg(dObj.doseMg)} registrada!`);
    });
  }

  /* ==================== BOOT ==================== */
  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initPWA();
    initAuthUI();
    initOnboardingUI();
    bindEvents();

    // Restaura sessão ativa se existir
    try {
      const saved = JSON.parse(localStorage.getItem('mpa_v2_active_profile') || 'null');
      if (saved && saved.userId) {
        await enterSession(saved);
      }
    } catch {}
  });
})();
