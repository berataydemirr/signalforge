# Theory notes

These notes are written by the project owner, in their own words. They explain *why* each block in SignalForge works the way it does.

## To write (M1)

- [ ] `01-gray-coding.md`: why Gray coding makes BER ≈ SER / k at high SNR (use the constellation scope's labels as figures)
- [ ] `02-nyquist-and-rrc.md`: the Nyquist ISI criterion, raised cosine vs root-raised cosine, and why the filter is split between TX and RX
- [ ] `03-matched-filter.md`: why the matched filter maximizes SNR at the sampling instant; derive that the decision SNR equals Es/N0
- [ ] `04-ber-theory.md`: derive Pb for BPSK/QPSK; Craig's formula for M-PSK; the QAM approximation; compare against the simulated points
- [ ] `05-bandwidth-tradeoffs.md`: occupied bandwidth (1+β)Rs, spectral efficiency k/(1+β), and the Eb/N0 cost of higher-order modulation

Tip: a screenshot from the live demo plus 1–2 equations per note is plenty. Link the matching URL (every setting is in the query string) so readers can reproduce each figure.
