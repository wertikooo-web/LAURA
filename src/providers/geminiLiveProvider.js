'use strict';

const crypto = require('crypto');
const { normalizeProviderError } = require('./providerErrors');

const GEMINI_VOICES = Object.freeze([
    { id: 'Aoede', label: 'Aoede' },
    { id: 'Kore', label: 'Kore' },
    { id: 'Leda', label: 'Leda' },
    { id: 'Zephyr', label: 'Zephyr' },
]);

function extractGeminiEvents(message, context) {
    const events = [];
    const serverContent = message?.serverContent;
    if (!serverContent) return events;
    const userText = serverContent.inputTranscription?.text;
    const modelText = serverContent.outputTranscription?.text;
    if (userText) events.push({ type: 'transcript.user', text: userText, cumulative: true });
    if (modelText) events.push({ type: 'transcript.model.delta', text: modelText });
    for (const part of serverContent.modelTurn?.parts || []) {
        const data = part.inlineData?.data;
        if (data) events.push({
            type: 'audio.chunk', response_id: context.responseId, turn_id: context.turnId,
            mime_type: part.inlineData.mimeType || 'audio/pcm;rate=24000', audio_base64: data,
        });
    }
    if (serverContent.interrupted) events.push({ type: 'provider.interrupted' });
    if (serverContent.turnComplete) events.push({ type: 'audio.end' });
    return events;
}

class GeminiLiveProvider {
    constructor(config, dependencies = {}) { this.name = 'gemini'; this.config = config; this.dependencies = dependencies; }
    createSession(options = {}) { return new GeminiLiveProviderSession({ config: this.config, options, dependencies: this.dependencies }); }
}

class GeminiLiveProviderSession {
    constructor({ config, options, dependencies = {} }) {
        this.name = 'gemini'; this.config = config; this.options = options; this.dependencies = dependencies;
        this.instanceId = `gemini_${crypto.randomBytes(8).toString('hex')}`;
        this.session = null; this.connectPromise = null; this.activeContext = null;
        this.pendingAudio = []; this.closed = false; this.inputActivityActive = false; this.log = () => {};
    }

    connect(log = () => {}) {
        if (this.connectPromise) return this.connectPromise;
        this.log = log;
        this.connectPromise = (async () => {
            const GoogleGenAI = this.dependencies.GoogleGenAI || require('@google/genai').GoogleGenAI;
            const ai = this.dependencies.client || new GoogleGenAI({ apiKey: this.config.apiKey });
            let setupSettled = false;
            let resolveSetup;
            let rejectSetup;
            const setupPromise = new Promise((resolve, reject) => { resolveSetup = resolve; rejectSetup = reject; });
            const setupTimer = setTimeout(() => rejectSetup(Object.assign(new Error('gemini_setup_timeout'), { code: 'session_creation_failed' })), 12_000);
            this.session = await ai.live.connect({
                model: this.config.model,
                config: {
                    responseModalities: ['AUDIO'], systemInstruction: this.options.systemInstructionText,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.options.voice || this.config.voice } } },
                    realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
                    inputAudioTranscription: {}, outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {},
                    onmessage: (message) => {
                        if (message?.setupComplete && !setupSettled) {
                            setupSettled = true;
                            resolveSetup();
                            return;
                        }
                        this.handleMessage(message);
                    },
                    onerror: (error) => {
                        if (!setupSettled) rejectSetup(error);
                        this.emitProviderError(error);
                    },
                    onclose: () => {
                        const error = new Error('gemini_connection_closed');
                        if (!setupSettled) rejectSetup(error);
                        if (!this.closed && this.activeContext) this.emitProviderError(error);
                    },
                },
            });
            try { await setupPromise; } finally { clearTimeout(setupTimer); }
            log('provider_connected', { provider: this.name, providerInstanceId: this.instanceId });
            if (this.closed) { this.session.close?.(); throw Object.assign(new Error('provider_session_closed'), { code: 'connection_closed' }); }
            for (const chunk of this.pendingAudio.splice(0)) this.sendAudioNow(chunk);
        })().catch((error) => {
            const normalized = normalizeProviderError(error, this.name);
            throw Object.assign(new Error(normalized.message), { code: normalized.code });
        });
        return this.connectPromise;
    }

    updateInstructions() { return false; }
    updateVoiceDelivery() { return false; }
    async startInput() {
        await this.connect();
        if (!this.closed && !this.inputActivityActive) {
            this.session.sendRealtimeInput({ activityStart: {} });
            this.inputActivityActive = true;
        }
    }
    sendAudio(buffer) {
        if (this.closed || !Buffer.isBuffer(buffer) || buffer.length === 0) return;
        if (this.session) this.sendAudioNow(buffer);
        else { this.pendingAudio.push(Buffer.from(buffer)); this.connect().catch(() => {}); }
    }
    sendAudioNow(buffer) { this.session?.sendRealtimeInput({ audio: { data: buffer.toString('base64'), mimeType: 'audio/pcm;rate=16000' } }); }
    async endInput(context) {
        this.activeContext = context; await this.connect(context.log);
        if (!context.signal?.cancelled && !this.closed && this.inputActivityActive) {
            this.session.sendRealtimeInput({ activityEnd: {} });
            this.inputActivityActive = false;
        }
    }
    async sendText(text, context) {
        this.activeContext = context; await this.connect(context.log);
        if (!context.signal?.cancelled && !this.closed) this.session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: String(text).slice(0, 4000) }] }], turnComplete: true });
    }
    interrupt(reason = 'interrupt') {
        if (this.activeContext?.signal) { this.activeContext.signal.cancelled = true; this.activeContext.signal.reason = reason; }
        this.activeContext = null;
        try {
            if (!this.inputActivityActive) {
                this.session?.sendRealtimeInput({ activityStart: {} });
                this.inputActivityActive = true;
            }
            if (reason !== 'user_started_speaking') {
                this.session?.sendRealtimeInput({ activityEnd: {} });
                this.inputActivityActive = false;
            }
        } catch { /* closing */ }
    }
    close() {
        this.closed = true; this.activeContext = null; this.inputActivityActive = false; this.pendingAudio.length = 0;
        try { this.session?.close?.(); } catch { /* already closed */ }
    }
    emitProviderError(error) {
        const normalized = normalizeProviderError(error, this.name);
        this.log('provider_error', { provider: this.name, code: normalized.code, providerInstanceId: this.instanceId });
        this.activeContext?.onEvent?.({ type: 'provider.error', ...normalized, provider_instance_id: this.instanceId });
    }
    handleMessage(message) {
        const context = this.activeContext;
        if (!context || context.signal?.cancelled) return;
        for (const event of extractGeminiEvents(message, context)) {
            if (event.type === 'audio.chunk') context.onAudioChunk(event); else context.onEvent(event);
            if (event.type === 'audio.end') this.activeContext = null;
        }
    }
}

module.exports = { GeminiLiveProvider, GeminiLiveProviderSession, GEMINI_VOICES, extractGeminiEvents };
