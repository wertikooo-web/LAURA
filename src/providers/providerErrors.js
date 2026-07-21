'use strict';

const CODES = new Set([
    'authentication_failed', 'configuration_invalid', 'connection_failed',
    'connection_closed', 'rate_limited', 'provider_unavailable',
    'audio_format_invalid', 'session_creation_failed', 'interruption_failed', 'unknown',
]);
const MESSAGES = {
    authentication_failed: 'Provider authentication failed.', configuration_invalid: 'Provider configuration is invalid.',
    connection_failed: 'Could not connect to the provider.', connection_closed: 'The provider connection closed.',
    rate_limited: 'The provider rate limit was reached.', provider_unavailable: 'The provider is unavailable.',
    audio_format_invalid: 'The provider rejected the audio format.', session_creation_failed: 'Could not create the provider session.',
    interruption_failed: 'The provider could not interrupt the response.', unknown: 'The voice provider returned an error.',
};

function normalizeProviderError(error, provider = 'unknown') {
    const message = String(error?.message || error || 'provider_error').slice(0, 240);
    const status = Number(error?.status || error?.code || 0);
    let code = CODES.has(error?.code) ? error.code : 'unknown';
    if (/api.?key|unauthor|forbidden|401|403/i.test(message) || status === 401 || status === 403) code = 'authentication_failed';
    else if (/rate.?limit|quota|429/i.test(message) || status === 429) code = 'rate_limited';
    else if (/closed|disconnect/i.test(message)) code = 'connection_closed';
    else if (/connect|socket|network|timeout/i.test(message)) code = 'connection_failed';
    else if (/config|model|voice|unsupported/i.test(message)) code = 'configuration_invalid';
    return { code, provider, message: MESSAGES[code] };
}

module.exports = { normalizeProviderError };
