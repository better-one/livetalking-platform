/**
 * API 统一封装 — 消除重复的 fetch 调用
 */

async function post<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function get<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  return r.json();
}

// Avatar
export const avatarApi = {
  list: () => get<{ code: number; data: any[] }>('/avatar/list'),
  create: (form: FormData) => fetch('/avatar/create', { method: 'POST', body: form }).then(r => r.json()),
  progress: (avatar_id: string) => post('/avatar/progress', { avatar_id }),
  delete: (avatar_id: string) => post('/avatar/delete', { avatar_id }),
  preview: (id: string) => `/avatar/preview/${id}`,
};

// Session
export const sessionApi = {
  sendText: (sessionid: string, text: string, type: 'echo' | 'chat', ttsVoice?: string) =>
    post('/human', { text, type, interrupt: true, sessionid, tts: { voice: ttsVoice } }),
  sendAudio: (sessionid: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('sessionid', sessionid);
    return fetch('/humanaudio', { method: 'POST', body: form }).then(r => r.json());
  },
  interrupt: (sessionid: string) => post('/interrupt_talk', { sessionid }),
  isSpeaking: (sessionid: string) => post<{ code: number; data: boolean }>('/is_speaking', { sessionid }),
  record: (sessionid: string, start: boolean) =>
    post('/record', { type: start ? 'start_record' : 'end_record', sessionid }),
  setAction: (sessionid: string, audiotype: number) =>
    post('/set_audiotype', { sessionid, audiotype }),
};

// Celebrity
export const celebrityApi = {
  list: () => get<{ code: number; data: any[] }>('/celebrity/list'),
  chat: (celebrity_id: string, text: string, sessionid: string) =>
    post('/celebrity/chat', { celebrity_id, text, sessionid }),
  add: (data: any) => post('/celebrity/add', data),
  detail: (celebrity_id: string) => post('/celebrity/detail', { celebrity_id }),
};

// System
export const systemApi = {
  info: () => get<{ code: number; data: any }>('/system/info'),
  videoList: () => get<{ code: number; data: any[] }>('/video/list'),
  videoDelete: (filename: string) => post('/video/delete', { filename }),
};

// LLM
export const llmApi = {
  getConfig: () => get<{ code: number; data: any }>('/llm/config'),
  setConfig: (config: any) => post('/llm/config', config),
  test: () => post('/llm/test', {}),
};
