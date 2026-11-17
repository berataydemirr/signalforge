# SignalForge

**A real-time, end-to-end digital communication link lab that runs in your browser.**

Bits go in, get Gray-mapped, pulse-shaped, corrupted by a channel, filtered, sampled and sliced, and every stage is visible live: constellation, eye diagram, spectrum, and BER curves that land on closed-form theory.

**▶ Live demo:** https://berataydemirr.github.io/signalforge/

![CI](https://github.com/berataydemirr/signalforge/actions/workflows/ci.yml/badge.svg)

<!-- TODO(owner): add docs/demo.gif here: a 10-second recording of the constellation + BER sweep -->

---

## What it does (M1)

```
bits → Gray mapper → RRC pulse shaping → AWGN → matched RRC filter → sampler → min-distance slicer → BER / EVM
```

| Scope | What you see |
|---|---|
| **Constellation** | Received symbols at the matched-filter output, ideal points with their **Gray labels**, and the slicer's **decision boundaries** |
| **Eye diagram** | 250 persistence traces of the matched-filter output; watch the eye close as β → 0 or Eb/N0 drops |
| **PSD** | Welch estimate (Hann, 50% overlap) of TX vs RX; occupied bandwidth `(1+β)Rs` marked |
| **BER vs Eb/N0** | Monte Carlo sweep on the **full waveform-level link**, in a Web Worker, overlaid on theory; low-confidence points (< 50 errors) drawn hollow |

Modulations: BPSK, QPSK, 8-PSK, 16-QAM, 64-QAM, 256-QAM. Tunable: Eb/N0, RRC roll-off β, filter span, samples/symbol, frame length. Every setting is in the URL, so any configuration is a shareable link, e.g. [`?mod=64qam&ebn0=14&beta=0.2`](https://berataydemirr.github.io/signalforge/?mod=64qam&ebn0=14&beta=0.2).

## Why trust the numbers

The simulator is checked against theory **in CI on every commit**:

| Modulation | Eb/N0 points | Criterion |
|---|---|---|
| BPSK, QPSK | 2, 4, 6 dB | simulated / theory ∈ [0.88, 1.12] with ≥ 1500 errors |
| 8-PSK | 6, 8 dB | same |
| 16-QAM | 6, 8 dB | same |
| 64-QAM | 10, 12 dB | same |

With *E* counted errors the relative std. dev. of a BER estimate is ≈ 1/√E, so ±12 % at E ≥ 1500 is a > 4σ band. That leaves room for the Gray approximation used for 8-PSK/QAM, but none for a modelling bug.

Other invariants under test: FFT vs direct DFT, RRC unit energy and symmetry, **RRC ∗ RRC is Nyquist** (zero ISI at symbol instants), the t = 1/(4β) singularity, unit average symbol energy for every constellation, **nearest neighbours differ in exactly one bit** (Gray), fast O(1) slicers vs brute-force minimum distance, Q-function reference values, and the BPSK 1e-5 point at 9.6 dB.

## Engineering notes

- **Conventions.** Complex baseband, Es = 1, unit-energy RRC taps. TX shaping followed by the matched filter is a raised cosine with unit peak, so the decision statistic is `a + n` with `n ~ CN(0, N0)` and `N0 = 1 / (k · Eb/N0)` exactly. No fudge factors.
- **Theory.** BPSK/QPSK: `Q(√(2Eb/N0))` (exact). M-PSK: exact SER from **Craig's formula** (numerical integration), Pb ≈ Ps/k. Square M-QAM: Gray-coded approximation `(4/k)(1−1/√M) Σ Q((2i+1)√(3k·Eb/N0/(M−1)))`.
- **Performance.** Pulse shaping is done per symbol (O(N·taps) instead of O(N·sps·taps)), slicers are O(1) per symbol, and the BER sweep runs at 4 sps in a Web Worker (BER is independent of oversampling) until 300 errors or 2 M bits per point.
- **Reproducible.** Every random number comes from a seeded `mulberry32` PRNG; Gaussian noise via Box–Muller.
- **No DSP libraries.** FFT, filters, PRNG, Q-function and everything else are written from scratch in TypeScript (`src/dsp/`, pure functions with no DOM).

## Architecture

```
src/
├── dsp/            pure DSP library (no DOM): testable in Node
│   ├── core/       complex vectors, FFT, RRC/FIR, PRNG
│   ├── source/     bit sources, error counting
│   ├── modulation/ Gray PSK/QAM mappers + O(1) slicers
│   ├── channel/    AWGN
│   ├── metrics/    EVM, Welch PSD, eye traces
│   └── theory/     Q-function, closed-form BER
├── engine/         link pipeline, Monte Carlo BER, Web Worker
└── ui/             React + hand-written Canvas 2D scopes
tests/
├── dsp/            unit tests
└── validation/     simulated-vs-theory BER (runs in CI)
```

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173/signalforge/
npm test        # 48 tests, ~3 s
npm run build
```

## Roadmap

- [x] **M1**: baseband link over AWGN, four scopes, validated BER engine
- [ ] **M2**: real-world impairments (CFO, phase noise, timing offset, IQ imbalance, multipath / Rayleigh fading) and the receivers that fix them (Costas loop, Gardner timing recovery, LMS equalizer)
- [ ] **M3**: OFDM with pilot-based channel estimation; convolutional coding + Viterbi, showing coding gain
- [ ] **M4**: over-the-air acoustic modem (speaker → microphone) with AudioWorklet
- [ ] **M5**: drag-and-connect flowgraph editor, RTL-SDR via WebUSB, analog pack (AM/FM/SSB)

## References

- B. P. Lathi, Z. Ding, *Modern Digital and Analog Communication Systems*
- J. G. Proakis, M. Salehi, *Digital Communications*
- J. W. Craig, "A new, simple and exact result for calculating the probability of error for two-dimensional signal constellations," MILCOM 1991
- K. Cho, D. Yoon, "On the general BER expression of one- and two-dimensional amplitude modulations," IEEE Trans. Commun., 2002

## License

MIT
