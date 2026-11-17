# SignalForge

Browser-based simulator of a complete digital communication link, with live scopes and BER validated against theory.

**Demo:** https://berataydemirr.github.io/signalforge/ &nbsp;·&nbsp; ![Tests](https://github.com/berataydemirr/signalforge/actions/workflows/tests.yml/badge.svg)

```
bits → Gray mapper → RRC → AWGN → matched RRC → sampler → min-distance slicer → BER / SER / EVM
```

## Features

- **Modulation:** BPSK, QPSK, 8-PSK, 16/64/256-QAM, Gray coded, Es = 1
- **Scopes:** constellation with decision regions, eye diagram, Welch PSD, RRC / raised-cosine pulse, BER vs Eb/N0
- **BER sweep:** Monte Carlo on the full waveform (not a symbol-level shortcut), run in a Web Worker, plotted with 95% Wilson intervals against theory and the Shannon limit
- **Link analysis:** dmin/2σ, N0, SER vs theory, residual ISI from filter truncation, stopband level, capacity and gap to Shannon at BER 1e-5
- **Shareable state:** every parameter is in the URL, e.g. [`?mod=64qam&ebn0=14&beta=0.2`](https://berataydemirr.github.io/signalforge/?mod=64qam&ebn0=14&beta=0.2)

## Model

| | |
|---|---|
| Signal | complex baseband, unit-energy RRC taps, so TX + RX = raised cosine with unit peak |
| Noise | `N0 = 1 / (k · Eb/N0)` per complex sample; decision SNR is exactly Es/N0 |
| BER theory | BPSK/QPSK `Q(√(2Eb/N0))` exact; M-PSK exact SER (Craig) / k; square QAM Gray approximation |
| SER theory | exact for PSK (Craig) and square QAM |

## Verification

57 tests run on every push. Key checks:

- Simulated BER within ±12% of theory (≥ 1500 errors, > 4σ) for BPSK, QPSK, 8-PSK, 16-QAM, 64-QAM
- Simulated SER within ±10% of exact theory
- RRC ∗ RRC is Nyquist (zero ISI at t = nT); FFT vs direct DFT; Gray neighbours differ by one bit; O(1) slicers vs brute force

## Structure

```
src/dsp/      pure DSP library: FFT, filters, mappers, channel, metrics, theory (no DOM)
src/engine/   link pipeline, Monte Carlo BER, Web Worker
src/ui/       React + Canvas 2D scopes
tests/        unit tests and simulation-vs-theory validation
```

No DSP libraries are used.

## Run

```bash
npm install
npm run dev    # http://localhost:5173/signalforge/
npm test
```

## Roadmap

- [x] M1: baseband link over AWGN
- [ ] M2: CFO, phase noise, timing offset, IQ imbalance, fading; Costas loop, Gardner TED, LMS equalizer
- [ ] M3: OFDM with pilot channel estimation; convolutional code + Viterbi
- [ ] M4: acoustic modem (speaker to microphone)
- [ ] M5: flowgraph editor, RTL-SDR over WebUSB, analog modulations

## References

Lathi & Ding, *Modern Digital and Analog Communication Systems* · Proakis & Salehi, *Digital Communications* · Craig, MILCOM 1991 · Cho & Yoon, IEEE Trans. Commun. 2002

MIT License
