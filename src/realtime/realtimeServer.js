'use strict';

const crypto = require('crypto');
const {
    acceptWebSocket,
    createFrameParser,
    sendJson,
    sendPong,
    sendClose,
} = require('./wsProtocol');
const { buildRealtimeSystemInstruction } = require('./realtimePrompt');
const { resolveInputSampleRate, createInputResampler } = require('./inputAudioResampling');
const { normalizeSessionOptions } = require('../config/env');

const MAX_INPUT_BYTES_PER_TURN = 8 * 1024 * 1024;

function id(prefix) {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function attachRealtimeServer(server, { providerFactory, providerMetadata, allowTranscriptLogging = false } = {}) {
    if (typeof providerFactory !== 'function') throw new TypeError('providerFactory is required');

    server.on('upgrade', (request, socket) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname !== '/realtime') {
            socket.destroy();
            return;
        }
        if (!acceptWebSocket(request, socket)) return;

        const sessionId = id('session');
        let started = false;
        let closed = false;
        let providerSession = null;
        let inputActive = false;
        let inputBytes = 0;
        let inputResampler = null;
        let currentGeneration = null;
        let transcriptDelta = '';

        const send = (payload) => sendJson(socket, {
            ...payload,
            session_id: sessionId,
            server_time_ms: Date.now(),
        });

        const log = (event, meta = {}) => {
            const safe = { event, sessionId, provider: providerMetadata.name, ...meta };
            delete safe.text;
            delete safe.audio;
            console.log(JSON.stringify(safe));
        };

        const fail = (code, message, { close = false } = {}) => {
            send({ type: 'error', code, message });
            if (close) {
                closed = true;
                providerSession?.close?.();
                sendClose(socket);
            }
        };

        const cancelCurrent = (reason = 'client_interrupt') => {
            if (!currentGeneration || currentGeneration.status === 'cancelled') return;
            currentGeneration.status = 'cancelled';
            currentGeneration.signal.cancelled = true;
            currentGeneration.signal.reason = reason;
            providerSession?.interrupt?.(reason);
            send({
                type: 'response.cancelled',
                response_id: currentGeneration.responseId,
                turn_id: currentGeneration.turnId,
                generation_id: currentGeneration.generationId,
                reason,
            });
            currentGeneration = null;
            transcriptDelta = '';
        };

        const eventContext = (generation) => ({
            responseId: generation.responseId,
            turnId: generation.turnId,
            generationId: generation.generationId,
            turnInputBytes: inputBytes,
            sessionInputBytes: inputBytes,
            signal: generation.signal,
            log,
            onEvent(event) {
                if (generation.signal.cancelled || generation !== currentGeneration) return;
                const type = event.type;
                if (type === 'transcript.model.delta') transcriptDelta += String(event.text || '');
                if (type === 'transcript.model' && !event.text && transcriptDelta) event.text = transcriptDelta;
                if (type === 'transcript.user' || type.startsWith('transcript.model')) {
                    if (allowTranscriptLogging) log(type, { chars: String(event.text || '').length });
                }
                send({
                    ...event,
                    response_id: event.response_id || generation.responseId,
                    turn_id: event.turn_id || generation.turnId,
                    generation_id: event.generation_id || generation.generationId,
                });
                if (type === 'audio.end' || type === 'provider.error') {
                    generation.status = type === 'audio.end' ? 'completed' : 'failed';
                    currentGeneration = null;
                    transcriptDelta = '';
                }
            },
            onAudioChunk(event) {
                if (generation.signal.cancelled || generation !== currentGeneration) return;
                send({
                    ...event,
                    response_id: generation.responseId,
                    turn_id: generation.turnId,
                    generation_id: generation.generationId,
                });
            },
        });

        async function startSession(payload) {
            if (started) return fail('session_already_started', 'The session has already started.');
            const options = normalizeSessionOptions(payload, { defaultVoice: providerMetadata.voice });
            if (!options.adultConfirmed) {
                return fail('adult_confirmation_required', 'LAURA is available only after 18+ confirmation.', { close: true });
            }

            let inputSampleRate;
            try {
                inputSampleRate = resolveInputSampleRate(payload);
            } catch (error) {
                return fail(error.code || 'invalid_audio_config', error.message, { close: true });
            }
            inputResampler = createInputResampler(inputSampleRate);
            const prompt = buildRealtimeSystemInstruction(options);
            providerSession = providerFactory({
                systemInstructionText: prompt.text,
                systemInstructionMeta: prompt.meta,
                voice: options.voice,
            });
            try {
                if (typeof providerSession.connect === 'function') await providerSession.connect(log);
            } catch (error) {
                return fail(error.code || 'provider_connect_failed', 'Could not connect the voice provider.', { close: true });
            }
            started = true;
            send({
                type: 'session.ready',
                provider: providerMetadata.name,
                model: providerMetadata.model,
                voice: options.voice,
                mode: options.mode,
                language: options.language,
                no_save: options.noSave,
                input_sample_rate: inputSampleRate,
                provider_sample_rate: 16000,
            });
        }

        function startInput() {
            if (!started) return fail('session_not_started', 'Start the session first.');
            cancelCurrent('user_started_speaking');
            inputActive = true;
            inputBytes = 0;
            inputResampler?.reset?.();
            send({ type: 'input_audio.started' });
        }

        async function endInput() {
            if (!inputActive) return fail('input_not_active', 'No active microphone turn.');
            inputActive = false;
            try {
                const tail = inputResampler?.flush?.();
                if (tail?.length) providerSession.sendAudio(tail);
            } catch (error) {
                inputResampler?.reset?.();
                return fail(error.code || 'invalid_audio', 'The audio frame was invalid.');
            }
            const generation = {
                generationId: id('generation'),
                turnId: id('turn'),
                responseId: id('response'),
                status: 'active',
                signal: { cancelled: false, reason: null },
            };
            currentGeneration = generation;
            send({
                type: 'response.created',
                generation_id: generation.generationId,
                turn_id: generation.turnId,
                response_id: generation.responseId,
                input_bytes: inputBytes,
            });
            providerSession.endInput(eventContext(generation)).catch((error) => {
                if (generation === currentGeneration) {
                    fail(error.code || 'provider_error', 'LAURA could not answer this turn.');
                    currentGeneration = null;
                }
            });
        }

        async function sendTextMessage(payload) {
            if (!started) return fail('session_not_started', 'Start the session first.');
            const text = String(payload.text || '').trim().slice(0, 4000);
            if (!text) return;
            cancelCurrent('new_text_turn');
            const generation = {
                generationId: id('generation'),
                turnId: id('turn'),
                responseId: id('response'),
                status: 'active',
                signal: { cancelled: false, reason: null },
            };
            currentGeneration = generation;
            send({ type: 'transcript.user', text, turn_id: generation.turnId, generation_id: generation.generationId });
            await providerSession.sendText(text, eventContext(generation));
        }

        async function onText(raw) {
            let payload;
            try {
                payload = JSON.parse(raw);
            } catch {
                return fail('invalid_json', 'Control messages must be valid JSON.');
            }
            switch (payload.type) {
            case 'ping': send({ type: 'pong', timestamp_ms: payload.timestamp_ms || Date.now() }); break;
            case 'session.start': await startSession(payload); break;
            case 'input_audio.start': startInput(); break;
            case 'input_audio.end': await endInput(); break;
            case 'session.interrupt': cancelCurrent(payload.reason || 'client_interrupt'); break;
            case 'text.send': await sendTextMessage(payload); break;
            case 'session.stop':
                closed = true;
                providerSession?.close?.();
                sendClose(socket);
                break;
            default: fail('unsupported_message', `Unsupported message type: ${payload.type || 'missing'}`);
            }
        }

        function onBinary(buffer) {
            if (!started || !inputActive || closed) return;
            if (inputBytes + buffer.length > MAX_INPUT_BYTES_PER_TURN) {
                inputActive = false;
                inputResampler?.reset?.();
                return fail('audio_turn_too_large', 'The microphone turn is too long.');
            }
            inputBytes += buffer.length;
            try {
                const outgoing = inputResampler ? inputResampler.process(buffer) : buffer;
                if (outgoing.length) providerSession.sendAudio(outgoing);
            } catch (error) {
                inputActive = false;
                inputResampler?.reset?.();
                fail(error.code || 'invalid_audio', 'The audio frame was invalid.');
            }
        }

        const parser = createFrameParser({
            onText: (raw) => onText(raw).catch((error) => fail('internal_error', error.message)),
            onBinary,
            onPing: (payload) => sendPong(socket, payload),
            onClose: () => {
                closed = true;
                providerSession?.close?.();
            },
            onError: () => fail('websocket_frame_error', 'Invalid WebSocket frame.', { close: true }),
        });
        socket.on('data', (chunk) => parser.push(chunk));
        socket.on('error', () => {
            closed = true;
            providerSession?.close?.();
        });
        socket.on('close', () => {
            closed = true;
            providerSession?.close?.();
        });

        send({ type: 'connection.ready', requires_adult_confirmation: true });
    });
}

module.exports = { attachRealtimeServer, MAX_INPUT_BYTES_PER_TURN };
