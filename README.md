# zk-ton-plonk

**This is an experimental repository.**

This repository demonstrates PLONK proof verification on TON. The same Circom circuits are exported to FunC and Tolk with `export-ton-verifier` and exercised through both getters and internal messages.

For Groth16 examples, see [zk-ton-examples](https://github.com/zk-examples/zk-ton-example). For the TON verifier model, see the [TON zero-knowledge documentation](https://docs.ton.org/contract-dev/zero-knowledge).

## Reproducible circuit artifacts

For normal development, install the exact dependencies and verify the checked-in artifacts without recompiling circuits or recreating proving keys:

```sh
npm ci
npm run circuits:verify
```

`npm test` runs this fast manifest-backed verification automatically. It hashes every tracked source, R1CS, SYM, WASM, ZKey, verification key, Powers of Tau transcript, proof input, proof, and public-signal file. It also verifies every proof with snarkjs and confirms that a tampered proof is rejected. It does not invoke Circom, proving, or PLONK setup.

To deliberately reproduce every artifact from source, run:

```sh
npm run circuits:build
npm run circuits:check
```

`circuits:build` performs the following steps:

1. Downloads the official Circom 2.2.3 Windows release when it is not cached locally and verifies SHA-256 `e43f132ee6f0aa79b705beceb59c2a7e6a54d7bdeab917ca34e9fc1951d185e1` before execution. Set `CIRCOM_BIN` to an existing copy of that exact binary to avoid the download.
2. Compiles all circuits for `bls12381`, producing R1CS, SYM, witness JavaScript, and WASM files.
3. Verifies `circuits/bls12-381-pot8-final.ptau` with snarkjs 0.7.6.
4. Recreates every PLONK ZKey and verification key.
5. Generates and verifies six real proof fixtures covering all five circuits.
6. Writes SHA-256 hashes for sources, tools, the Powers of Tau transcript, all generated circuit artifacts, proof inputs, proofs, and public signals to manifests under `circuits/`.

`circuits:check` repeats compilation and PLONK setup in a temporary directory and rejects any byte difference from the manifest. It is the explicit full-reproducibility gate and is not part of the ordinary test loop.

The checked-in Powers of Tau transcript is a small, single-machine development SRS with a CSPRNG contribution and final beacon. It is sufficient for reproducible tests, but it is not a substitute for an independently audited multi-party ceremony for production deployments. Do not replace it with deterministic or publicly known setup entropy.

PLONK proofs use fresh blinding randomness, so `npm run circuits:build` is semantically reproducible but does not promise byte-identical proof JSON. The newly generated proofs are verified before being recorded; a clean clone verifies the committed snapshots and their hashes without recomputing them.

The five circuits cover conditional selection, Fibonacci evaluation, three-factor multiplication, exponentiation, and component reuse. Their artifacts live next to each `.circom` source under `circuits/`.

## Generate contracts and wrappers

```sh
npm run export:verifiers
npx export-ton-verifier import-wrapper wrappers/Verifier_func_plonk.ts --plonk --func --force
npx export-ton-verifier import-wrapper wrappers/Verifier_tolk_plonk.ts --plonk --tolk --force
```

`export:verifiers` regenerates all FunC and Tolk contracts. The wrappers and contracts share opcode `0x76524659`, cell layout, minimum attached value, and error semantics. Internal-message verification requires at least `0.07 TON`.

## Build and test

```sh
npx blueprint build --all
npm test
```

The test suite runs serially. It checks real snarkjs proofs through both getter and internal-message paths in FunC and Tolk, and rejects invalid proofs, malformed or trailing payloads, and mismatched compressed/uncompressed point representations.

Gas snapshots are stored in `bench-snapshots/`.
