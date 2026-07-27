import 'snarkjs';

declare module 'snarkjs' {
    interface PlonkProof {
        [key: string]: unknown;
    }
}
