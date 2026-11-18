/**
 * Marcusnator Pro Athlete 2.0 By Dr. Hans
 * Dados clínicos, farmacocinéticos, feriados brasileiros, EFCA e tabelas de referência.
 */

window.MPA_DATA = {
  APP_NAME: 'Marcusnator Pro Athlete 2.0 By Dr. Hans',
  APP_VERSION: '2.0.0',
  SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1lM9dHsrdv59n_HkY5Oa75UBzbabNDUfdCvgOMgCWxxc/edit?usp=drivesdk',
  DEFAULT_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw5-2vvg04kQTUSJ5AJBPK3gsPZcq3K6cvmYKc5Xpl28efEhM-J-9YAQ8kwmYUhUBkf/exec',
  DEFAULT_GEMINI_KEY: 'AQ.Ab8RN6IMaEckm-G_YTozsI5lOeVlltBaTGAHZFyi0y-_16lGjg',

  RECOVERY_QUESTIONS: [
    'Qual é o nome do seu primeiro animal de estimação?',
    'Em qual cidade você nasceu?',
    'Qual o nome da sua escola primária?',
    'Qual é o nome do meio da sua mãe?',
    'Qual foi o modelo do seu primeiro carro?',
    'Qual é o seu prato favorito de infância?',
    'Personalizada (digite sua própria pergunta)'
  ],

  BODY_MEASUREMENT_TYPES: [
    'Cintura (umbigo)',
    'Abdômen',
    'Quadril',
    'Pescoço',
    'Tórax',
    'Braço Direito',
    'Braço Esquerdo',
    'Coxa Direita',
    'Coxa Esquerda',
    'Panturrilha Direita',
    'Panturrilha Esquerda'
  ],

  /**
   * Parâmetros farmacocinéticos (modelo 1-compartimento com absorção e eliminação de 1ª ordem)
   * Semaglutida: Petri et al., Diabetes Ther 2018 (ka = 0,0286 h^-1, t1/2 ≈ 168 h)
   * Tirzepatida: PMC10962491 / StatPearls NBK585056 (ka = 0,0373 h^-1, t1/2 ≈ 120 h)
   */
  MEDICATIONS: {
    semaglutida: {
      id: 'semaglutida',
      label: 'Semaglutida (Ozempic / Wegovy)',
      shortLabel: 'semaglutida',
      ka: 0.0286,
      halfLifeHours: 168, // ~7 dias
      ke: Math.LN2 / 168,
      doses: [0.25, 0.5, 1.0, 1.7, 2.4],
      doseColors: {
        '0.25': '#64748B',
        '0.5': '#9333EA',
        '1': '#0D9488',
        '1.7': '#E11D48',
        '2.4': '#1D4ED8'
      },
      pkRef: 'Petri et al., Diabetes Ther (2018) — ka = 0,0286 h⁻¹, t½ ≈ 7 dias (168 h).'
    },
    tirzepatida: {
      id: 'tirzepatida',
      label: 'Tirzepatida (Mounjaro)',
      shortLabel: 'tirzepatida',
      ka: 0.0373,
      halfLifeHours: 120, // ~5 dias
      ke: Math.LN2 / 120,
      doses: [2.5, 5, 7.5, 10, 12.5, 15],
      doseColors: {
        '2.5': '#64748B',
        '5': '#A855F7',
        '7.5': '#0D9488',
        '10': '#E11D48',
        '12.5': '#D97706',
        '15': '#1D4ED8'
      },
      pkRef: 'PopPK Tirzepatida (PMC10962491 / StatPearls) — ka = 0,0373 h⁻¹, t½ ≈ 5 dias (120 h).'
    }
  },

  /**
   * Locais de aplicação em ordem de rodízio recomendado
   */
  INJECTION_SITES: [
    { id: 'abd_sup_dir', label: 'Abdômen — Quadrante Superior Direito', area: 'Abdômen' },
    { id: 'abd_sup_esq', label: 'Abdômen — Quadrante Superior Esquerdo', area: 'Abdômen' },
    { id: 'abd_inf_esq', label: 'Abdômen — Quadrante Inferior Esquerdo', area: 'Abdômen' },
    { id: 'abd_inf_dir', label: 'Abdômen — Quadrante Inferior Direito', area: 'Abdômen' },
    { id: 'coxa_dir', label: 'Coxa Direita (face anterior/lateral)', area: 'Coxas' },
    { id: 'coxa_esq', label: 'Coxa Esquerda (face anterior/lateral)', area: 'Coxas' },
    { id: 'braco_dir', label: 'Braço Direito (face posterior)', area: 'Braços' },
    { id: 'braco_esq', label: 'Braço Esquerdo (face posterior)', area: 'Braços' }
  ],

  /**
   * Estudos clínicos enviados pelo usuário (média das doses ativas — sem seletor de dose)
   * Pontos em dias desde o início (dia = semana * 7) e % de variação de peso.
   */
  CLINICAL_STUDIES: {
    tirzepatida_72: {
      id: 'tirzepatida_72',
      med: 'tirzepatida',
      label: 'Tirzepatida · SURMOUNT-5 · 72 semanas',
      shortLabel: 'SURMOUNT-5 (72 sem)',
      durationWeeks: 72,
      finalPct: -21.6,
      citation: 'Aronne et al., NEJM 2025 (SURMOUNT-5, MTD 10/15 mg: -20,2% tratamento / -21,6% eficácia em 72 sem).',
      points: [
        { day: 0, pct: 0 },
        { day: 28, pct: -3.2 },
        { day: 56, pct: -6.2 },
        { day: 84, pct: -9.0 },
        { day: 112, pct: -11.4 },
        { day: 140, pct: -13.3 },
        { day: 168, pct: -14.8 },
        { day: 252, pct: -18.0 },
        { day: 336, pct: -20.2 },
        { day: 364, pct: -20.6 },
        { day: 420, pct: -21.2 },
        { day: 504, pct: -21.6 }
      ]
    },
    tirzepatida_176: {
      id: 'tirzepatida_176',
      med: 'tirzepatida',
      label: 'Tirzepatida · SURMOUNT-1 · 176 semanas',
      shortLabel: 'SURMOUNT-1 (176 sem)',
      durationWeeks: 176,
      finalPct: -19.2,
      citation: 'Jastreboff et al., NEJM 2025 (SURMOUNT-1, média 5/10/15 mg: -16,9% tratamento / -19,2% eficácia em 176 sem).',
      points: [
        { day: 0, pct: 0 },
        { day: 28, pct: -2.9 },
        { day: 56, pct: -5.4 },
        { day: 112, pct: -9.8 },
        { day: 168, pct: -13.0 },
        { day: 252, pct: -16.1 },
        { day: 336, pct: -18.0 },
        { day: 420, pct: -19.2 },
        { day: 504, pct: -19.7 },
        { day: 595, pct: -19.9 },
        { day: 686, pct: -19.8 },
        { day: 777, pct: -19.7 },
        { day: 868, pct: -19.5 },
        { day: 959, pct: -19.3 },
        { day: 1050, pct: -19.1 },
        { day: 1141, pct: -19.0 },
        { day: 1232, pct: -19.2 }
      ]
    },
    semaglutida_72: {
      id: 'semaglutida_72',
      med: 'semaglutida',
      label: 'Semaglutida · STEP UP · 72 semanas',
      shortLabel: 'STEP UP (72 sem)',
      durationWeeks: 72,
      finalPct: -17.2,
      citation: 'Wharton et al., Lancet Diabetes Endocrinol 2025 (STEP UP, média 2,4 mg e 7,2 mg: -17,2% em 72 sem).',
      points: [
        { day: 0, pct: 0 },
        { day: 28, pct: -2.2 },
        { day: 56, pct: -4.8 },
        { day: 84, pct: -7.1 },
        { day: 112, pct: -9.5 },
        { day: 140, pct: -11.4 },
        { day: 168, pct: -13.0 },
        { day: 224, pct: -14.7 },
        { day: 280, pct: -15.8 },
        { day: 336, pct: -16.5 },
        { day: 392, pct: -16.9 },
        { day: 448, pct: -17.1 },
        { day: 504, pct: -17.2 }
      ]
    },
    semaglutida_208: {
      id: 'semaglutida_208',
      med: 'semaglutida',
      label: 'Semaglutida · SELECT · 208 semanas',
      shortLabel: 'SELECT (208 sem)',
      durationWeeks: 208,
      finalPct: -10.2,
      citation: 'Ryan et al., Nature Medicine 2024 (SELECT, semaglutida 2,4 mg: -10,2% in-trial em 208 sem).',
      points: [
        { day: 0, pct: 0 },
        { day: 84, pct: -4.1 },
        { day: 182, pct: -7.6 },
        { day: 273, pct: -9.0 },
        { day: 364, pct: -9.7 },
        { day: 455, pct: -10.2 },
        { day: 546, pct: -10.1 },
        { day: 637, pct: -10.1 },
        { day: 728, pct: -9.7 },
        { day: 819, pct: -9.8 },
        { day: 910, pct: -9.7 },
        { day: 1001, pct: -9.6 },
        { day: 1092, pct: -9.5 },
        { day: 1183, pct: -9.8 },
        { day: 1274, pct: -9.9 },
        { day: 1365, pct: -10.0 },
        { day: 1456, pct: -10.2 }
      ]
    }
  },

  /**
   * Principais Feriados Nacionais do Brasil (ANBIMA 2026–2027)
   * impact: 'high' (Natal/Ano Novo/Carnaval/Páscoa: +0,4% a +0,6%), 'medium' (feriados prolongados: +0,2% a +0,3%)
   */
  BRAZIL_HOLIDAYS: [
    { date: '2026-01-01', name: 'Confraternização Universal (Ano Novo)', impact: 'high' },
    { date: '2026-02-16', name: 'Carnaval (Segunda)', impact: 'high' },
    { date: '2026-02-17', name: 'Carnaval (Terça)', impact: 'high' },
    { date: '2026-04-03', name: 'Paixão de Cristo', impact: 'medium' },
    { date: '2026-04-05', name: 'Páscoa', impact: 'high' },
    { date: '2026-04-21', name: 'Tiradentes', impact: 'medium' },
    { date: '2026-05-01', name: 'Dia do Trabalho', impact: 'medium' },
    { date: '2026-06-04', name: 'Corpus Christi', impact: 'medium' },
    { date: '2026-09-07', name: 'Independência do Brasil', impact: 'medium' },
    { date: '2026-10-12', name: 'Nossa Sra. Aparecida', impact: 'medium' },
    { date: '2026-11-02', name: 'Finados', impact: 'medium' },
    { date: '2026-11-15', name: 'Proclamação da República', impact: 'medium' },
    { date: '2026-11-20', name: 'Consciência Negra', impact: 'medium' },
    { date: '2026-12-25', name: 'Natal', impact: 'high' },
    { date: '2026-12-31', name: 'Véspera de Ano Novo', impact: 'high' },
    { date: '2027-01-01', name: 'Confraternização Universal (Ano Novo)', impact: 'high' },
    { date: '2027-02-08', name: 'Carnaval (Segunda)', impact: 'high' },
    { date: '2027-02-09', name: 'Carnaval (Terça)', impact: 'high' },
    { date: '2027-03-26', name: 'Paixão de Cristo', impact: 'medium' },
    { date: '2027-03-28', name: 'Páscoa', impact: 'high' },
    { date: '2027-04-21', name: 'Tiradentes', impact: 'medium' },
    { date: '2027-05-01', name: 'Dia do Trabalho', impact: 'medium' },
    { date: '2027-05-27', name: 'Corpus Christi', impact: 'medium' },
    { date: '2027-09-07', name: 'Independência do Brasil', impact: 'medium' },
    { date: '2027-10-12', name: 'Nossa Sra. Aparecida', impact: 'medium' },
    { date: '2027-11-02', name: 'Finados', impact: 'medium' },
    { date: '2027-11-15', name: 'Proclamação da República', impact: 'medium' },
    { date: '2027-11-20', name: 'Consciência Negra', impact: 'medium' },
    { date: '2027-12-25', name: 'Natal', impact: 'high' },
    { date: '2027-12-31', name: 'Véspera de Ano Novo', impact: 'high' }
  ],

  /**
   * Escala de Fenótipos de Comportamento Alimentar (EFCA) — Versão Validada em Português do Brasil
   * Pineda-Wieselberg RJ, Soares AH, Napoli TF, et al. Arch Endocrinol Metab. 2025;69(3):e240404.
   * Escala Likert 1 (Nunca) a 5 (Sempre). Questão 9 tem pontuação invertida (6 - resposta).
   */
  EFCA_LIKERT: [
    { value: 1, label: 'Nunca' },
    { value: 2, label: 'Raramente' },
    { value: 3, label: 'Às vezes' },
    { value: 4, label: 'Quase sempre' },
    { value: 5, label: 'Sempre' }
  ],

  EFCA_QUESTIONS: [
    { num: 1, text: 'Eu como até ficar muito cheio.', subscale: 'hiperfagico', reversed: false },
    { num: 2, text: 'Acalmo as minhas emoções com comida.', subscale: 'emocional', reversed: false },
    { num: 3, text: 'Peço mais comida quando termino meu prato.', subscale: 'hiperfagico', reversed: false },
    { num: 4, text: 'Tenho o hábito de petiscar (fazer pequenas refeições entre as refeições principais – café da manhã, almoço, café da tarde e jantar – sem medir a quantidade do que se come).', subscale: 'emocional', reversed: false },
    { num: 5, text: 'Quando começo a comer algo que gosto muito, tenho dificuldade em parar.', subscale: 'hedonico', reversed: false },
    { num: 6, text: 'Costumo comer mais de um prato nas refeições principais.', subscale: 'hiperfagico', reversed: false },
    { num: 7, text: 'Faço lanches entre as refeições devido à ansiedade, tédio, solidão, medo, raiva, tristeza e/ou cansaço.', subscale: 'emocional', reversed: false },
    { num: 8, text: 'Sinto-me tentado a comer quando vejo/cheiro comida que gosto e/ou quando passo por um quiosque, uma padaria, uma pizzaria ou um estabelecimento de fast food.', subscale: 'hedonico', reversed: false },
    { num: 9, text: 'Tomo café da manhã todos os dias.', subscale: 'desorganizado', reversed: true },
    { num: 10, text: 'Como nos momentos em que estou: entediado, ansioso, nervoso, triste, cansado, irritado e solitário.', subscale: 'emocional', reversed: false },
    { num: 11, text: 'Pulo algumas – ou pelo menos uma – das refeições principais (café da manhã, almoço, café da tarde ou jantar).', subscale: 'desorganizado', reversed: false },
    { num: 12, text: 'Quando me deparo com uma comida que gosto muito, mesmo sem sentir fome, acabo comendo.', subscale: 'hedonico', reversed: false },
    { num: 13, text: 'Como muita comida em pouco tempo.', subscale: 'compulsivo', reversed: false },
    { num: 14, text: 'Quando como algo que gosto, finalizo toda a porção.', subscale: 'hedonico', reversed: false },
    { num: 15, text: 'Quando como algo que gosto muito, como muito rápido.', subscale: 'compulsivo', reversed: false },
    { num: 16, text: 'Passo mais de 5 horas por dia sem comer.', subscale: 'desorganizado', reversed: false }
  ],

  EFCA_SUBSCALES: {
    hiperfagico: {
      name: 'Hiperfágico',
      items: [1, 3, 6],
      max: 15,
      lowMax: 5,
      medMax: 8,
      desc: 'Dificuldade em comer porções menores: grandes volumes, repetir o prato e comer até ficar muito cheio.'
    },
    hedonico: {
      name: 'Hedônico',
      items: [5, 8, 12, 14],
      max: 20,
      lowMax: 11,
      medMax: 14,
      desc: 'Desejo de comer despertado pelo prazer e estímulos sensoriais (ver ou cheirar comidas palatáveis), mesmo sem fome física.'
    },
    emocional: {
      name: 'Emocional',
      items: [2, 4, 7, 10],
      max: 20,
      lowMax: 8,
      medMax: 12,
      desc: 'Uso da comida para lidar com emoções (ansiedade, tédio, tristeza, cansaço) e hábito de petiscar entre refeições.'
    },
    desorganizado: {
      name: 'Desorganizado',
      items: [9, 11, 16],
      max: 15,
      lowMax: 4,
      medMax: 6,
      desc: 'Falta de rotina alimentar: pular refeições principais ou ficar mais de 5 horas sem se alimentar.'
    },
    compulsivo: {
      name: 'Compulsivo',
      items: [13, 15],
      max: 10,
      lowMax: 3,
      medMax: 6,
      desc: 'Ingestão rápida e excessiva de comida em curtos períodos. Não substitui diagnóstico clínico — sinal para investigação profissional.'
    }
  },

  FOOD_SWAPS: {
    proteinas: [
      { base: '100 g de peito de frango grelhado', swap: '110 g de tilápia ou pescada assada · 100 g de patinho moído · 3 ovos inteiros · 30 g de whey protein', macros: '~165 kcal | 31 g prot' },
      { base: '170 g de iogurte grego zero', swap: '150 g de queijo cottage · 200 ml de iogurte natural desnatado + 15 g whey · 4 claras mexidas', macros: '~100 kcal | 15 g prot' },
      { base: '120 g de lombo suíno magro', swap: '120 g de filé mignon · 130 g de camarão grelhado · 150 g de tofu firme grelhado', macros: '~190 kcal | 32 g prot' }
    ],
    carboidratos: [
      { base: '100 g de arroz branco cozido', swap: '120 g de batata inglesa cozida · 100 g de batata-doce · 90 g de macarrão cozido · 80 g de mandioca', macros: '~130 kcal | 28 g carb' },
      { base: '2 fatias de pão integral (50 g)', swap: '1 pão francês sem miolo · 40 g de aveia em flocos · 2 tapiocas finas (45 g goma) · 1 wrap integral', macros: '~130 kcal | 24 g carb' },
      { base: '1 banana média (90 g)', swap: '1 maçã média · 150 g de mamão papaia · 200 g de morangos · 120 g de manga', macros: '~80 kcal | 20 g carb' }
    ],
    lanches: [
      { base: '1 scoop de whey + 1 fruta', swap: 'Iogurte proteico (15 g prot) + canela · 2 ovos cozidos + 1 torrada integral', macros: '~200 kcal | 24 g prot' },
      { base: '20 g de castanhas ou amendoim', swap: '15 g de pasta de amendoim integral · 80 g de abacate · 25 g de chocolate 70% cacau', macros: '~125 kcal | gordura boa' }
    ]
  },

  NOTIFICATION_TYPES: [
    { id: 'agua', label: 'Beber água', defaultTime: '10:00', defaultReason: 'Manter hidratação em dia e controlar falsa fome.' },
    { id: 'alimentacao', label: 'Se alimentar / Refeição', defaultTime: '12:30', defaultReason: 'Evitar ficar mais de 5h sem comer e bater a meta de proteína.' },
    { id: 'medicoes', label: 'Registrar peso e medidas', defaultTime: '07:00', defaultReason: 'Pesagem em jejum (3×/semana) e cintura a cada 15 dias.' },
    { id: 'medicacao', label: 'Aplicação da medicação', defaultTime: '09:00', defaultReason: 'Manter a constância farmacocinética e rodízio de local.' },
    { id: 'treino', label: 'Hora do treino', defaultTime: '18:00', defaultReason: 'Preservar massa muscular magra durante o emagrecimento.' },
    { id: 'revisao_segunda', label: 'Revisão de Segunda-feira', defaultTime: '08:30', defaultReason: 'Revisar média semanal de peso e ajustar o plano se estagnado.' },
    { id: 'sono', label: 'Higiene do sono', defaultTime: '22:30', defaultReason: 'Dormir bem regula grelina, leptina e reduz compulsão no dia seguinte.' }
  ],

  NOTIFICATION_TONES: {
    suave: {
      label: 'Suave (gentil)',
      prefix: 'Lembrete gentil:'
    },
    moderada: {
      label: 'Moderada (direta)',
      prefix: 'Hora de agir:'
    },
    incisiva: {
      label: 'Incisiva (modo Coach)',
      prefix: 'FOCO TOTAL — NÃO PULE:'
    }
  },

  CHANGELOG: [
    {
      version: '2.0.0',
      date: '2026-11-18',
      type: 'MAJOR',
      items: [
        'Lançamento do Marcusnator Pro Athlete 2.0 By Dr. Hans como PWA instalável (Android, iPhone, Mac e Windows).',
        'Integração completa com Google Sheets via Apps Script para perfis, recuperação de senha, onboarding, diário, evolução, aplicações e EFCA.',
        'Integração com Gemini 3.1 Pro e Flash para criação/ajuste de cardápios e estimativa de calorias por foto ou descrição.',
        'Aba Medicação com curva farmacocinética (Semaglutida e Tirzepatida), comparação com estudos (STEP UP 72s, SELECT 208s, SURMOUNT-5 72s, SURMOUNT-1 176s) e rodízio inteligente de locais.',
        'Gráficos Realidade × Projetado e Projetado Realístico baseados em feriados nacionais do Brasil e evidências científicas.',
        'Tabela de Avaliação do Tipo de Corpo (IMC × Bioimpedância), Questionário EFCA completo (16 itens), Notificações configuráveis e Relatório Clínico em PDF.'
      ]
    },
    {
      version: '1.1.0',
      date: '2026-10-05',
      type: 'MINOR',
      items: [
        'Adicionada calculadora de hidratação ajustável por faixa etária (15 a 60 ml/kg) com alerta para doença renal.',
        'Incluído modo escuro/claro e placar superior recolhível.'
      ]
    },
    {
      version: '1.0.0',
      date: '2026-09-01',
      type: 'MAJOR',
      items: [
        'Versão inicial do rastreador de peso, calorias, proteínas e rotina semanal.'
      ]
    }
  ]
};

/**
 * Formatação brasileira de números e doses
 * Garante que 2.5 -> "2,5 mg" (nunca "25mg")
 */
window.fmtBR = function (num, decimals = 1) {
  if (num === null || num === undefined || isNaN(Number(num))) return '—';
  return Number(num).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

window.fmtDoseMg = function (dose) {
  const n = Number(dose);
  if (isNaN(n)) return '—';
  const str = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return `${str} mg`;
};

window.fmtDateBR = function (isoDate) {
  if (!isoDate) return '—';
  const parts = String(isoDate).slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

window.todayISO = function () {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
