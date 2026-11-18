/**
 * Marcusnator Pro Athlete 2.0 By Dr. Hans
 * Camada de integração: Google Apps Script (Sheets) + Cache Local + Gemini AI (3.1 Pro / Flash)
 */

window.MPA_API = (function () {
  const LS_PROFILES_KEY = 'mpa_v2_profiles';
  const LS_DATA_PREFIX = 'mpa_v2_userdata_';
  const LS_CONFIG_KEY = 'mpa_v2_config';

  function getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_CONFIG_KEY) || '{}');
      return {
        appsScriptUrl: saved.appsScriptUrl || window.MPA_DATA.DEFAULT_APPS_SCRIPT_URL,
        geminiApiKey: saved.geminiApiKey || window.MPA_DATA.DEFAULT_GEMINI_KEY,
        geminiModel: saved.geminiModel || 'gemini-2.5-flash'
      };
    } catch {
      return {
        appsScriptUrl: window.MPA_DATA.DEFAULT_APPS_SCRIPT_URL,
        geminiApiKey: window.MPA_DATA.DEFAULT_GEMINI_KEY,
        geminiModel: 'gemini-2.5-flash'
      };
    }
  }

  function saveConfig(partial) {
    const cur = getConfig();
    const next = Object.assign({}, cur, partial);
    try {
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(next));
    } catch {}
    return next;
  }

  async function simpleHash(str) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
      }
      return 'h_' + Math.abs(h).toString(16);
    }
  }

  function getLocalProfiles() {
    try {
      return JSON.parse(localStorage.getItem(LS_PROFILES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveLocalProfiles(list) {
    try {
      localStorage.setItem(LS_PROFILES_KEY, JSON.stringify(list));
    } catch {}
  }

  function getLocalUserData(userId) {
    try {
      const raw = localStorage.getItem(LS_DATA_PREFIX + userId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLocalUserData(userId, data) {
    try {
      localStorage.setItem(LS_DATA_PREFIX + userId, JSON.stringify(data));
    } catch {}
  }

  async function callSheetsPost(payload) {
    const { appsScriptUrl } = getConfig();
    if (!appsScriptUrl) return { ok: false, offline: true };
    try {
      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { ok: res.ok, raw: text };
      }
    } catch (err) {
      return { ok: false, offline: true, error: String(err) };
    }
  }

  async function callSheetsGet(params) {
    const { appsScriptUrl } = getConfig();
    if (!appsScriptUrl) return { ok: false, offline: true };
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${appsScriptUrl}?${qs}`, { method: 'GET' });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { ok: res.ok, raw: text };
      }
    } catch (err) {
      return { ok: false, offline: true, error: String(err) };
    }
  }

  async function listProfiles() {
    const local = getLocalProfiles();
    const remote = await callSheetsGet({ action: 'listProfiles' });
    if (remote && remote.ok && Array.isArray(remote.profiles)) {
      // Merge remoto + local sem perder dados locais
      const byName = new Map();
      local.forEach((p) => byName.set(p.nomeCompleto.toLowerCase(), p));
      remote.profiles.forEach((rp) => {
        const key = rp.nomeCompleto.toLowerCase();
        const existing = byName.get(key) || {};
        byName.set(key, Object.assign({}, existing, rp));
      });
      const merged = Array.from(byName.values());
      saveLocalProfiles(merged);
      return { ok: true, profiles: merged, synced: true };
    }
    return { ok: true, profiles: local, synced: false };
  }

  async function registerProfile({ nomeCompleto, senha, perguntaRecuperacao, respostaRecuperacao }) {
    const nomeTrim = nomeCompleto.trim();
    const senhaHash = await simpleHash(senha);
    const userId = 'usr_' + Date.now();
    const local = getLocalProfiles();
    if (local.some((p) => p.nomeCompleto.toLowerCase() === nomeTrim.toLowerCase())) {
      return { ok: false, error: 'Já existe um perfil com esse nome completo.' };
    }

    const remote = await callSheetsPost({
      action: 'registerProfile',
      userId,
      nomeCompleto: nomeTrim,
      senhaHash,
      senhaPlain: senha,
      perguntaRecuperacao,
      respostaRecuperacao: respostaRecuperacao.trim().toLowerCase()
    });

    if (remote && remote.error && !remote.offline) {
      return { ok: false, error: remote.error };
    }

    const finalId = (remote && remote.userId) || userId;
    const profileObj = {
      userId: finalId,
      nomeCompleto: nomeTrim,
      senhaHash,
      senhaPlain: senha,
      perguntaRecuperacao,
      respostaRecuperacao: respostaRecuperacao.trim().toLowerCase(),
      criadoEm: new Date().toISOString(),
      onboardingConcluido: false
    };
    local.push(profileObj);
    saveLocalProfiles(local);
    return { ok: true, profile: profileObj, synced: !!(remote && remote.ok) };
  }

  async function login({ nomeCompleto, senha }) {
    const nomeTrim = nomeCompleto.trim();
    const senhaHash = await simpleHash(senha);

    // Tenta remoto primeiro
    const remote = await callSheetsPost({
      action: 'login',
      nomeCompleto: nomeTrim,
      senhaHash,
      senhaPlain: senha
    });

    if (remote && remote.ok && remote.profile) {
      const local = getLocalProfiles();
      const idx = local.findIndex((p) => p.nomeCompleto.toLowerCase() === nomeTrim.toLowerCase());
      const merged = Object.assign({}, idx >= 0 ? local[idx] : {}, remote.profile, { senhaHash, senhaPlain: senha });
      if (idx >= 0) local[idx] = merged;
      else local.push(merged);
      saveLocalProfiles(local);
      return { ok: true, profile: merged, synced: true };
    }

    if (remote && !remote.offline && remote.error) {
      // Se o servidor respondeu explicitamente senha incorreta, mas checa local se perfil só existir localmente
      const local = getLocalProfiles();
      const found = local.find((p) => p.nomeCompleto.toLowerCase() === nomeTrim.toLowerCase());
      if (found && (found.senhaHash === senhaHash || found.senhaPlain === senha)) {
        return { ok: true, profile: found, synced: false };
      }
      return { ok: false, error: remote.error };
    }

    // Fallback offline
    const local = getLocalProfiles();
    const found = local.find((p) => p.nomeCompleto.toLowerCase() === nomeTrim.toLowerCase());
    if (!found) return { ok: false, error: 'Perfil não encontrado.' };
    if (found.senhaHash === senhaHash || found.senhaPlain === senha) {
      return { ok: true, profile: found, synced: false };
    }
    return { ok: false, error: 'Senha incorreta.' };
  }

  async function getRecoveryQuestion(nomeCompleto) {
    const nomeTrim = nomeCompleto.trim();
    const remote = await callSheetsPost({ action: 'getRecoveryQuestion', nomeCompleto: nomeTrim });
    if (remote && remote.ok) return remote;
    const local = getLocalProfiles();
    const found = local.find((p) => p.nomeCompleto.toLowerCase() === nomeTrim.toLowerCase());
    if (found) return { ok: true, userId: found.userId, perguntaRecuperacao: found.perguntaRecuperacao };
    return { ok: false, error: 'Perfil não encontrado.' };
  }

  async function verifyRecovery({ nomeCompleto, respostaRecuperacao, mode, novaSenha }) {
    const nomeTrim = nomeCompleto.trim();
    const respNorm = respostaRecuperacao.trim().toLowerCase();
    const novaSenhaHash = novaSenha ? await simpleHash(novaSenha) : '';

    const remote = await callSheetsPost({
      action: 'verifyRecovery',
      nomeCompleto: nomeTrim,
      respostaRecuperacao: respNorm,
      mode,
      novaSenhaHash,
      novaSenhaPlain: novaSenha || ''
    });

    const local = getLocalProfiles();
    const idx = local.findIndex((p) => p.nomeCompleto.toLowerCase() === nomeTrim.toLowerCase());

    if (remote && remote.ok) {
      if (idx >= 0 && mode === 'reset' && novaSenha) {
        local[idx].senhaHash = novaSenhaHash;
        local[idx].senhaPlain = novaSenha;
        saveLocalProfiles(local);
      }
      return remote;
    }

    if (remote && !remote.offline && remote.error) {
      return remote;
    }

    // Fallback offline
    if (idx < 0) return { ok: false, error: 'Perfil não encontrado.' };
    if ((local[idx].respostaRecuperacao || '').trim().toLowerCase() !== respNorm) {
      return { ok: false, error: 'Resposta incorreta.' };
    }
    if (mode === 'reset' && novaSenha) {
      local[idx].senhaHash = novaSenhaHash;
      local[idx].senhaPlain = novaSenha;
      saveLocalProfiles(local);
      return { ok: true, mode: 'reset', message: 'Senha redefinida localmente (será sincronizada quando online).' };
    }
    return { ok: true, mode: 'reveal', senhaRecuperada: local[idx].senhaPlain || '(salva com hash)' };
  }

  async function loadUserData(userId) {
    const local = getLocalUserData(userId);
    const remote = await callSheetsGet({ action: 'loadUserData', userId });
    if (remote && remote.ok && remote.data && Object.keys(remote.data).length > 0) {
      saveLocalUserData(userId, remote.data);
      return { ok: true, data: remote.data, synced: true };
    }
    return { ok: true, data: local, synced: false };
  }

  async function saveUserData(userId, data, logEvent) {
    saveLocalUserData(userId, data);
    if (data.onboardingConcluido) {
      const local = getLocalProfiles();
      const idx = local.findIndex((p) => p.userId === userId);
      if (idx >= 0) {
        local[idx].onboardingConcluido = true;
        saveLocalProfiles(local);
      }
    }
    const remote = await callSheetsPost({
      action: 'saveUserData',
      userId,
      data,
      logEvent: logEvent || null
    });
    return { ok: true, synced: !!(remote && remote.ok) };
  }

  /**
   * Chamada direta à API Gemini (suporta Gemini 3.1 Pro, Gemini 2.5/3.8 Flash com fallback automático)
   */
  async function callGemini({ prompt, systemInstruction, imageBase64, imageMimeType, preferredModel, expectJson }) {
    const cfg = getConfig();
    const apiKey = cfg.geminiApiKey;
    if (!apiKey) {
      return { ok: false, error: 'Chave da API Gemini não configurada.' };
    }

    const modelToTry = preferredModel || cfg.geminiModel || 'gemini-2.5-flash';
    const fallbackModels = [
      modelToTry,
      modelToTry.includes('pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
      'gemini-2.0-flash'
    ].filter((v, i, a) => a.indexOf(v) === i);

    const parts = [];
    if (imageBase64 && imageMimeType) {
      parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
    }
    parts.push({ text: prompt });

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048
      }
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (expectJson) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    let lastErr = '';
    for (const model of fallbackModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok && data.candidates && data.candidates[0] && data.candidates[0].content) {
          const text = data.candidates[0].content.parts.map((p) => p.text || '').join('');
          return { ok: true, text, modelUsed: model };
        }
        lastErr = (data && data.error && data.error.message) ? data.error.message : `HTTP ${res.status}`;
      } catch (err) {
        lastErr = String(err);
      }
    }
    return { ok: false, error: lastErr || 'Não foi possível conectar ao Gemini.' };
  }

  return {
    getConfig,
    saveConfig,
    listProfiles,
    registerProfile,
    login,
    getRecoveryQuestion,
    verifyRecovery,
    loadUserData,
    saveUserData,
    callGemini
  };
})();
