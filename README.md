# SignalForge

Browser-based simulator of a complete digital communication link, with live scopes and BER validated against theory.

**Demo:** https://berataydemirr.github.io/signalforge/ &nbsp;·&nbsp; ![Tests](https://github.com/berataydemirr/signalforge/actions/workflows/tests.yml/badge.svg)

```
[preamble | payload] → Gray mapper → RRC → timing offset → CFO / phase noise → AWGN
  → matched RRC → Gardner timing recovery → carrier PLL → slicer → BER / SER / EVM
```

## Features

- **Modulation:** BPSK, QPSK, 8-PSK, 16/64/256-QAM, Gray coded, Es = 1
- **Channel:** AWGN, carrier frequency offset, static phase offset, Wiener phase noise, fractional timing offset
- **Receiver:** Gardner timing recovery with cubic interpolation; second-order carrier PLL, data-aided on a 192-symbol preamble then decision-directed; both loops gear-shifted from acquisition to tracking bandwidth
- **Scopes:** constellation, eye diagram, Welch PSD, RRC / raised-cosine pulse, per-symbol phase and timing error, BER vs Eb/N0
- **BER sweep:** Monte Carlo on the full waveform link with the current channel and receiver, in a Web Worker, with 95% Wilson intervals against AWGN theory and the Shannon limit
- **Shareable state:** every parameter is in the URL, e.g. [impaired QPSK with sync](https://berataydemirr.github.io/signalforge/?mod=qpsk&ebn0=14&cfo=0.002&ph=35&pn=0.00001&tau=0.3&ts=1&cs=1&tab=sync)

## Model

| | |
|---|---|
| Signal | complex baseband, unit-energy RRC taps, so TX + RX = raised cosine with unit peak |
| Noise | `N0 = 1 / (k · Eb/N0)` per complex sample; decision SNR is exactly Es/N0 |
| BER theory | BPSK/QPSK `Q(√(2Eb/N0))` exact; M-PSK exact SER (Craig) / k; square QAM Gray approximation |
| SER theory | exact for PSK (Craig) and square QAM |
| Loop gains | from BnT and ζ = 0.707; Gardner detector gain measured, Kd ≈ 3β − 0.36β² |

## Verification

67 tests run on every push. Key checks:

- Simulated BER within ±12% of theory (≥ 1500 errors, > 4σ) for BPSK, QPSK, 8-PSK, 16-QAM, 64-QAM
- Simulated SER within ±10% of exact theory
- Sync on an ideal channel costs < 1 dB-equivalent; with CFO, phase offset, phase noise and 0.35 T timing offset the receiver locks inside the preamble and 16-QAM stays within 1 dB of theory
- RRC ∗ RRC is Nyquist (zero ISI at t = nT); FFT vs direct DFT; Gray neighbours differ by one bit; O(1) slicers vs brute force

## Structure

```
src/dsp/      pure DSP library: FFT, filters, mappers, channel, sync loops, metrics, theory (no DOM)
src/engine/   link pipeline, Monte Carlo BER, Web Worker
src/ui/       React + Canvas 2D scopes
tests/        unit tests and simulation-vs-theory validation
```

## Run

```bash
npm install
npm run dev    # http://localhost:5173/signalforge/
npm test
```

MIT License
