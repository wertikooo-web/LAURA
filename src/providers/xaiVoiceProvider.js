'use strict';

const WebSocket = require('ws');
const crypto = require('crypto');
const { normalizeProviderError } = require('./providerErrors');

function safeError(error) {
    return String(error?.message || error || 'provider_error').slice(0, 240);
}

function pronunciationReplacements(language = 'ru') {
    const spokenName = language === 'ru' ? 'ЛА́ура' : 'LAU-ra';
    return { LAURA: spokenName, 'Лаура': 'ЛА́ура' };
}

function buildXaiSessionConfig(options, config) {
    return {
        instructions: options.systemInstructionText,
        voice: options.voice || config.voice,
        replace: pronunciationReplacements(options.language),
        turn_detection: null,
        audio: {
            input: {
                format: { type: 'audio/pcm', rate: 16000 },
                transcription: { model: 'grok-transcribe' },
            },
            output: {
                format: { type: 'audio/pcm', rate: 24000 },
                speed: options.speechSpeed,
            },
        },
    };
}

class XaiVoiceProvider {
    constructor(config) {
        this.name = 'grok';
        this.config = config;
    }

    createSession(options = {}) {
        return new XaiVoiceProviderSession({ config: this.config, options });
    }
}

class XaiVoiceProviderSession {
    constructor({ config, options }) {
        this.name = 'grok';
        this.config = config;
        this.options = options;
        this.instanceId = `xai_${crypto.randomBytes(8).toString('hex')}`;
        this.systemInstructionMeta = options.systemInstructionMeta || {};
        this.promptSource = 'laura_default';
        this.closed = false;
        this.socket = null;
        this.connectPromise = null;
        this.activeContext = null;
        this.pendingAudio = [];
    }

    connect(log = () => {}) {
        if (this.connectPromise) return this.connectPromise;
        const url = new URL(this.config.realtimeUrl);
        url.searchParams.set('model', this.config.model);

        this.connectPromise = new Promise((resolve, reject) => {
            const socket = new WebSocket(url, {
                headers: { Authorization: `Bearer ${this.config.apiKey}` },
            });
            this.socket = socket;
            let settled = false;

            const failConnect = (error) => {
                if (settled) return;
                settled = true;
                reject(Object.assign(new Error(safeError(error)), { code: 'xai_connect_failed' }));
            };

            socket.once('error', failConnect);
            socket.once('open', () => {
                if (this.closed) {
                    socket.close();
                    return failConnect(new Error('provider_session_closed'));
                }
                this.sendRaw({
                    type: 'session.update',
                    session: buildXaiSessionConfig(this.options, this.config),
                });
                settled = true;
                socket.off('error', failConnect);
                socket.on('error', (error) => this.emitProviderError(error));
                socket.on('message', (data) => this.handleMessage(data));
                socket.on('close', (code) => {
                    if (!this.closed && this.activeContext) {
                        this.emitProviderError(new Error(`xai_socket_closed:${code}`));
                    }
                });
                log('provider_connected', { provider: this.name, providerInstanceId: this.instanceId });
                for (const chunk of this.pendingAudio.splice(0)) this.sendAudioNow(chunk);
                resolve();
            });
        });
        return this.connectPromise;
    }

    sendRaw(payload) {
        if (this.socket?.readyState !== WebSocket.OPEN) return false;
        this.socket.send(JSON.stringify(payload));
        return true;
    }

    updateInstructions(systemInstructionText, systemInstructionMeta = {}) {
        this.options.systemInstructionText = systemInstructionText;
        this.systemInstructionMeta = systemInstructionMeta;
        return this.sendRaw({
            type: 'session.update',
            session: { instructions: systemInstructionText },
        });
    }

    updateVoiceDelivery(speechSpeed) {
        this.options.speechSpeed = speechSpeed;
        return this.sendRaw({
            type: 'session.update',
            session: { audio: { output: { speed: speechSpeed } } },
        });
    }

    sendAudio(buffer) {
        if (this.closed || !Buffer.isBuffer(buffer) || buffer.length === 0) return;
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.sendAudioNow(buffer);
        } else {
            this.pendingAudio.push(Buffer.from(buffer));
            this.connect().catch(() => {});
        }
    }

    startInput() {
        this.sendRaw({ type: 'input_audio_buffer.clear' });
    }

    sendAudioNow(buffer) {
        this.sendRaw({ type: 'input_audio_buffer.append', audio: buffer.toString('base64') });
    }

    async endInput(context) {
        this.activeContext = context;
        await this.connect(context.log);
        if (context.signal?.cancelled || this.closed) return;
        this.sendRaw({ type: 'input_audio_buffer.commit' });
        this.sendRaw({ type: 'response.create' });
    }

    async sendText(text, context) {
        this.activeContext = context;
        await this.connect(context.log);
        if (context.signal?.cancelled || this.closed) return;
        this.sendRaw({
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: String(text).slice(0, 4000) }],
            },
        });
        this.sendRaw({ type: 'response.create' });
    }

    interrupt(reason = 'interrupt') {
        if (this.activeContext?.signal) {
            this.activeContext.signal.cancelled = true;
            this.activeContext.signal.reason = reason;
        }
        this.sendRaw({ type: 'response.cancel' });
        this.sendRaw({ type: 'input_audio_buffer.clear' });
        this.activeContext = null;
    }

    close() {
        this.closed = true;
        this.activeContext = null;
        this.pendingAudio.length = 0;
        if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
    }

    emitProviderError(error) {
        const normalized = normalizeProviderError(error, this.name);
        this.activeContext?.onEvent?.({
            type: 'provider.error',
            ...normalized,
            provider_instance_id: this.instanceId,
        });
    }

    handleMessage(data) {
        let event;
        try {
            event = JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
        } catch {
            return;
        }
        const context = this.activeContext;
        if (!context || context.signal?.cancelled) return;
        const type = String(event.type || '');

        if (type === 'input_audio_buffer.speech_started') {
            context.onEvent({ type: 'user.speech.started' });
            return;
        }
        if (type === 'conversation.item.input_audio_transcription.updated'
            || type === 'conversation.item.input_audio_transcription.completed') {
            const text = event.transcript || event.text || '';
            if (text) context.onEvent({ type: 'transcript.user', text, cumulative: true });
            return;
        }
        if (type === 'response.output_audio.delta' || type === 'response.audio.delta') {
            const audio = event.delta || event.audio;
            if (audio) {
                context.onAudioChunk({
                    type: 'audio.chunk',
                    response_id: context.responseId,
                    turn_id: context.turnId,
                    mime_type: 'audio/pcm;rate=24000',
                    audio_base64: audio,
                });
            }
            return;
        }
        if (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta') {
            const text = event.delta || event.transcript || '';
            if (text) context.onEvent({ type: 'transcript.model.delta', text });
            return;
        }
        if (type === 'response.output_audio_transcript.done' || type === 'response.audio_transcript.done') {
            const text = event.transcript || event.text || '';
            if (text) context.onEvent({ type: 'transcript.model', text });
            return;
        }
        if (type === 'response.done') {
            context.onEvent({ type: 'audio.end' });
            this.activeContext = null;
            return;
        }
        if (type === 'error') {
            this.emitProviderError(new Error(event.error?.message || event.message || 'xai_error'));
        }
    }
}

module.exports = { XaiVoiceProvider, XaiVoiceProviderSession, buildXaiSessionConfig, pronunciationReplacements };
