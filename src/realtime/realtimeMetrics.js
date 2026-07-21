'use strict';

function createRealtimeMetrics({ limit = 200 } = {}) {
    const sessions = [];
    const active = new Map();
    return {
        start(sessionId, provider) {
            active.set(sessionId, { sessionId, provider, startedAt: Date.now(), responseStartedAt: null, inputBytes: 0, outputBytes: 0, firstAudioLatencyMs: null, interruptions: 0, interruptionFailures: 0, connectionErrors: 0 });
        },
        response(sessionId) { const item = active.get(sessionId); if (item) item.responseStartedAt = Date.now(); },
        addInput(sessionId, bytes) { const item = active.get(sessionId); if (item) item.inputBytes += bytes; },
        addOutput(sessionId, bytes) {
            const item = active.get(sessionId); if (!item) return;
            item.outputBytes += bytes;
            if (item.firstAudioLatencyMs == null && item.responseStartedAt) item.firstAudioLatencyMs = Date.now() - item.responseStartedAt;
        },
        interrupt(sessionId, failed = false) { const item = active.get(sessionId); if (item) { item.interruptions += 1; if (failed) item.interruptionFailures += 1; } },
        error(sessionId) { const item = active.get(sessionId); if (item) item.connectionErrors += 1; },
        finish(sessionId) {
            const item = active.get(sessionId); if (!item) return;
            active.delete(sessionId);
            item.durationMs = Date.now() - item.startedAt;
            item.inputAudioSeconds = Math.round(item.inputBytes / 32000 * 10) / 10;
            item.outputAudioSeconds = Math.round(item.outputBytes / 48000 * 10) / 10;
            delete item.startedAt; delete item.responseStartedAt; delete item.inputBytes; delete item.outputBytes;
            sessions.push(item); if (sessions.length > limit) sessions.shift();
        },
        summary() {
            const grouped = {};
            for (const item of sessions) {
                const group = grouped[item.provider] ||= { provider: item.provider, sessions: 0, duration_ms: 0, input_audio_seconds: 0, output_audio_seconds: 0, first_audio_latency_ms: 0, interruptions: 0, interruption_failures: 0, connection_errors: 0 };
                group.sessions += 1; group.duration_ms += item.durationMs; group.input_audio_seconds += item.inputAudioSeconds;
                group.output_audio_seconds += item.outputAudioSeconds; group.first_audio_latency_ms += item.firstAudioLatencyMs || 0;
                group.interruptions += item.interruptions; group.interruption_failures += item.interruptionFailures; group.connection_errors += item.connectionErrors;
            }
            return Object.values(grouped).map((group) => ({ ...group, first_audio_latency_ms: group.sessions ? Math.round(group.first_audio_latency_ms / group.sessions) : null, estimated_cost_usd: null }));
        },
    };
}

module.exports = { createRealtimeMetrics };
