'use strict';

const $ = (id) => document.getElementById(id);
const state = {
  config: null,
  socket: null,
  connected: false,
  sessionReady: false,
  mode: 'talk',
  noSave: true,
  holding: false,
  pressActive: false,
  micStream: null,
  inputContext: null,
  processor: null,
  playbackContext: null,
  playbackQueueTime: 0,
  activeSources: [],
  assistantLine: null,
};

function setPresence(next, label, hint) {
  $('presence').dataset.state = next;
  $('statusLabel').textContent = label;
  if (hint) $('statusHint').textContent = hint;
}

function send(payload) {
  if (state.socket?.readyState === WebSocket.OPEN) state.socket.send(JSON.stringify(payload));
}

function setConnectionState(connectionState) {
  const button = $('connectButton');
  button.dataset.state = connectionState;
  button.textContent = connectionState === 'connected'
    ? 'DISCONNECT'
    : connectionState === 'connecting' ? 'CONNECTING…' : 'CONNECT';
  button.setAttribute('aria-pressed', String(connectionState !== 'disconnected'));
}

function addTranscript(role, text, { delta = false } = {}) {
  if (!text) return;
  const box = $('transcript');
  box.querySelector('.empty')?.remove();
  if (delta && state.assistantLine) {
    state.assistantLine.querySelector('span').textContent += text;
  } else {
    const line = document.createElement('p');
    line.className = `line ${role}`;
    const title = document.createElement('strong');
    title.textContent = role === 'user' ? 'Ты' : 'LAURA';
    const body = document.createElement('span');
    body.textContent = text;
    line.append(title, body);
    box.append(line);
    if (role === 'assistant') state.assistantLine = line;
  }
  box.scrollTop = box.scrollHeight;
}

function clearPlayback() {
  for (const source of state.activeSources) {
    try { source.onended = null; source.stop(); } catch { /* already ended */ }
  }
  state.activeSources = [];
  state.playbackQueueTime = state.playbackContext?.currentTime || 0;
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function scheduleAudio(buffer) {
  const context = state.playbackContext;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  const startAt = Math.max(context.currentTime, state.playbackQueueTime);
  source.start(startAt);
  state.playbackQueueTime = startAt + buffer.duration;
  state.activeSources.push(source);
  source.onended = () => { state.activeSources = state.activeSources.filter((item) => item !== source); };
}

async function playAudioChunk(payload) {
  state.playbackContext ||= new (window.AudioContext || window.webkitAudioContext)();
  await state.playbackContext.resume();
  const bytes = decodeBase64(payload.audio_base64);
  if (payload.mime_type === 'audio/wav') {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    try { scheduleAudio(await state.playbackContext.decodeAudioData(copy)); } catch { /* ignore mock decode failures */ }
    return;
  }
  const sampleRate = Number((payload.mime_type || '').match(/rate=(\d+)/)?.[1] || 24000);
  const samples = Math.floor(bytes.byteLength / 2);
  const buffer = state.playbackContext.createBuffer(1, samples, sampleRate);
  const output = buffer.getChannelData(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < samples; index += 1) output[index] = view.getInt16(index * 2, true) / 32768;
  scheduleAudio(buffer);
}

async function ensureMic() {
  if (state.micStream) return;
  state.micStream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  });
  state.inputContext ||= new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  await state.inputContext.resume();
  const source = state.inputContext.createMediaStreamSource(state.micStream);
  state.processor = state.inputContext.createScriptProcessor(2048, 1, 1);
  state.processor.onaudioprocess = (event) => {
    if (!state.holding || state.socket?.readyState !== WebSocket.OPEN) return;
    const input = event.inputBuffer.getChannelData(0);
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    state.socket.send(pcm.buffer);
  };
  source.connect(state.processor);
  state.processor.connect(state.inputContext.destination);
}

async function startTurn(event) {
  event?.preventDefault();
  if (!state.sessionReady || state.holding) return;
  state.pressActive = true;
  event?.currentTarget?.setPointerCapture?.(event.pointerId);
  clearPlayback();
  state.assistantLine = null;
  send({ type: 'session.interrupt', reason: 'user_started_speaking' });
  try {
    await ensureMic();
    if (!state.pressActive || !state.sessionReady) return;
    state.holding = true;
    $('talkButton').classList.add('recording');
    setPresence('listening', 'Слушаю', 'Отпусти кнопку, когда закончишь.');
    send({ type: 'input_audio.start' });
  } catch (error) {
    state.pressActive = false;
    setPresence('idle', 'Нет доступа к микрофону', error.message);
  }
}

function endTurn(event) {
  event?.preventDefault();
  state.pressActive = false;
  if (!state.holding) return;
  state.holding = false;
  $('talkButton').classList.remove('recording');
  setPresence('thinking', 'Думаю', 'Можно перебить меня новой репликой.');
  send({ type: 'input_audio.end' });
}

function handleEvent(payload) {
  switch (payload.type) {
  case 'connection.ready':
    send({
      type: 'session.start',
      adult_confirmed: localStorage.getItem('laura_adult_confirmed') === 'yes',
      mode: state.mode,
      language: 'auto',
      no_save: state.noSave,
      sample_rate: state.inputContext?.sampleRate || 48000,
    });
    break;
  case 'session.ready':
    state.sessionReady = true;
    setConnectionState('connected');
    $('talkButton').disabled = false;
    $('talkButton').classList.add('ready');
    $('providerLabel').textContent = `${payload.provider} · ${payload.voice}`;
    setPresence('idle', 'Я рядом', 'Удерживай кнопку и говори.');
    break;
  case 'response.created': setPresence('thinking', 'Думаю'); break;
  case 'audio.start':
  case 'audio.chunk':
    setPresence('speaking', 'Говорю', 'Нажми и говори, чтобы перебить.');
    $('stopButton').disabled = false;
    if (payload.type === 'audio.chunk') playAudioChunk(payload);
    break;
  case 'audio.end':
    $('stopButton').disabled = true;
    state.assistantLine = null;
    setPresence('idle', 'Я рядом', 'Удерживай кнопку, когда захочешь ответить.');
    break;
  case 'transcript.user':
    if (payload.cumulative) {
      const existing = $('transcript').querySelector('.line.user:last-of-type span');
      if (existing) existing.textContent = payload.text;
      else addTranscript('user', payload.text);
    } else addTranscript('user', payload.text);
    break;
  case 'transcript.model.delta': addTranscript('assistant', payload.text, { delta: true }); break;
  case 'transcript.model':
    if (!state.assistantLine) addTranscript('assistant', payload.text);
    else if (payload.text && state.assistantLine.querySelector('span').textContent !== payload.text) {
      state.assistantLine.querySelector('span').textContent = payload.text;
    }
    break;
  case 'response.cancelled':
    clearPlayback();
    $('stopButton').disabled = true;
    setPresence(state.holding ? 'listening' : 'idle', state.holding ? 'Слушаю' : 'Я рядом');
    break;
  case 'error':
  case 'provider.error':
    setPresence('idle', 'Что-то прервалось', payload.message || payload.code);
    break;
  default: break;
  }
}

async function connect() {
  if (state.socket) {
    send({ type: 'session.stop' });
    state.socket.close();
    return;
  }
  state.inputContext ||= new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}/realtime`);
  state.socket = socket;
  setConnectionState('connecting');
  socket.binaryType = 'arraybuffer';
  setPresence('thinking', 'Подключаюсь', 'Один момент.');
  socket.onopen = () => { state.connected = true; };
  socket.onmessage = (event) => {
    if (typeof event.data !== 'string') return;
    try { handleEvent(JSON.parse(event.data)); } catch { /* ignore malformed events */ }
  };
  socket.onclose = () => {
    state.socket = null;
    state.connected = false;
    state.sessionReady = false;
    state.holding = false;
    state.pressActive = false;
    clearPlayback();
    setConnectionState('disconnected');
    $('talkButton').disabled = true;
    $('talkButton').classList.remove('ready', 'recording');
    $('stopButton').disabled = true;
    setPresence('idle', 'Не подключена', 'Начни разговор, когда будешь готов.');
  };
  socket.onerror = () => setPresence('idle', 'Не удалось подключиться', 'Проверь, запущен ли сервер.');
}

async function init() {
  try {
    state.config = await fetch('/api/config', { cache: 'no-store' }).then((response) => response.json());
    $('providerLabel').textContent = `${state.config.provider} · ${state.config.voice}`;
  } catch { $('providerLabel').textContent = 'provider unavailable'; }

  const gate = $('ageGate');
  if (localStorage.getItem('laura_adult_confirmed') !== 'yes') gate.showModal();
  $('ageCheckbox').addEventListener('change', () => { $('ageContinue').disabled = !$('ageCheckbox').checked; });
  $('ageContinue').addEventListener('click', () => localStorage.setItem('laura_adult_confirmed', 'yes'));
  gate.addEventListener('cancel', (event) => event.preventDefault());

  $('privacyButton').addEventListener('click', () => $('privacyDialog').showModal());
  $('noSaveToggle').addEventListener('change', (event) => { state.noSave = event.target.checked; });
  document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => {
    if (state.sessionReady) return;
    state.mode = button.dataset.mode;
    document.querySelectorAll('.mode').forEach((item) => item.classList.toggle('active', item === button));
  }));

  $('connectButton').addEventListener('click', connect);
  const talk = $('talkButton');
  talk.addEventListener('pointerdown', startTurn);
  talk.addEventListener('pointerup', endTurn);
  talk.addEventListener('pointercancel', endTurn);
  talk.addEventListener('pointerleave', endTurn);
  $('stopButton').addEventListener('click', () => {
    clearPlayback();
    send({ type: 'session.interrupt', reason: 'stop_button' });
  });
  $('textForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('textInput').value.trim();
    if (!text || !state.sessionReady) return;
    clearPlayback();
    state.assistantLine = null;
    send({ type: 'text.send', text });
    $('textInput').value = '';
    setPresence('thinking', 'Думаю');
  });
}

init();
