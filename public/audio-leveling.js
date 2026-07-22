(function exposeAudioLeveling(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LauraAudioLeveling = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const TARGET_RMS = 0.14;
  const NOISE_FLOOR = 0.01;
  const MIN_GAIN = 0.72;
  const MAX_GAIN = 2.15;
  const PEAK_CEILING = 0.9;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function computeAdaptivePlaybackGain(audioBuffer, previousGain) {
    const fallback = Number.isFinite(previousGain) ? previousGain : 1;
    if (!audioBuffer || !Number.isInteger(audioBuffer.numberOfChannels) || audioBuffer.numberOfChannels < 1) {
      return { gain: fallback, rms: 0, peak: 0 };
    }

    let sumSquares = 0;
    let activeSamples = 0;
    let peak = 0;
    const stride = Math.max(1, Math.floor((audioBuffer.length || 0) / 24_000));
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const samples = audioBuffer.getChannelData(channel);
      for (let index = 0; index < samples.length; index += stride) {
        const absolute = Math.abs(samples[index]);
        if (absolute > peak) peak = absolute;
        if (absolute >= NOISE_FLOOR) {
          sumSquares += absolute * absolute;
          activeSamples += 1;
        }
      }
    }

    if (activeSamples < 32 || peak === 0) return { gain: fallback, rms: 0, peak };
    const rms = Math.sqrt(sumSquares / activeSamples);
    const rmsGain = TARGET_RMS / rms;
    const peakSafeGain = PEAK_CEILING / peak;
    const desired = clamp(Math.min(rmsGain, peakSafeGain), MIN_GAIN, MAX_GAIN);
    if (!Number.isFinite(previousGain)) return { gain: desired, rms, peak };

    // Pull loud audio down quickly; raise quiet audio more gradually to avoid pumping.
    const smoothing = desired < previousGain ? 0.65 : 0.28;
    return { gain: previousGain + ((desired - previousGain) * smoothing), rms, peak };
  }

  return { computeAdaptivePlaybackGain };
}));
