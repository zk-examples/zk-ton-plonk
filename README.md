# zk-ton-plonk

**Note: This is an experimental repository!**

This repository demonstrates **PLONK** zero-knowledge proof verification on the TON blockchain. Verifiers are generated from **Circom** circuits and implemented in **FunC** and **Tolk** using [export-ton-verifier](https://www.npmjs.com/package/export-ton-verifier).

Gas cost results are in the `bench-snapshots` directory.

For Groth16-based verification (Circom, Noname, Gnark, Arkworks) see: [zk-examples/zk-ton-example](https://github.com/zk-examples/zk-ton-example).

For more details, see the [TON documentation on zk-proofs](https://docs.ton.org/contract-dev/zero-knowledge).

## How to create

```sh
npm create ton@latest

npm install snarkjs @types/snarkjs
npm install export-ton-verifier@latest
```

## How to use

```sh
npm run export:verifiers
npm run export:verifiers:func
npm run export:verifiers:tolk
```

`export:verifiers` generates both FunC (`.fc`) and Tolk (`.tolk`) contracts. Use the `:func` or `:tolk` variants to export only one target language.

### Condition (circom)

Select: `out = cond ? a : b` with `cond ∈ {0, 1}`.

```sh
mkdir -p circuits/condition
cd circuits/condition

# compile circuit
circom condition.circom --r1cs --wasm --sym --prime bls12381

# trusted setup (PLONK)
snarkjs powersoftau new bls12-381 5 pot5_0000.ptau -v
snarkjs powersoftau contribute pot5_0000.ptau pot5_0001.ptau --name="First contribution" -v -e="some random text"
snarkjs powersoftau prepare phase2 pot5_0001.ptau pot5_final.ptau -v
snarkjs plonk setup condition.r1cs pot5_final.ptau condition_0000.zkey
snarkjs zkey export verificationkey condition_0000.zkey verification_key.json

cd ../..

# export FunC and Tolk contracts
npx export-ton-verifier ./circuits/condition/condition_0000.zkey ./contracts/condition.tolk
npx export-ton-verifier ./circuits/condition/condition_0000.zkey ./contracts/condition.fc --func
```

### Fibonacci (circom)

Computes the n-th Fibonacci number (here n=10) from initial values `in[0]`, `in[1]`.

```sh
mkdir -p circuits/fibonacci
cd circuits/fibonacci

# compile circuit
circom fibonacci.circom --r1cs --wasm --sym --prime bls12381

# trusted setup (PLONK)
snarkjs powersoftau new bls12-381 5 pot5_0000.ptau -v
snarkjs powersoftau contribute pot5_0000.ptau pot5_0001.ptau --name="First contribution" -v -e="some random text"
snarkjs powersoftau prepare phase2 pot5_0001.ptau pot5_final.ptau -v
snarkjs plonk setup fibonacci.r1cs pot5_final.ptau fibonacci_0000.zkey
snarkjs zkey export verificationkey fibonacci_0000.zkey verification_key.json

cd ../..

# export FunC and Tolk contracts
npx export-ton-verifier ./circuits/fibonacci/fibonacci_0000.zkey ./contracts/fibonacci.tolk
npx export-ton-verifier ./circuits/fibonacci/fibonacci_0000.zkey ./contracts/fibonacci.fc --func
```

### MultiplyThree (circom)

Computes `d = a * b * c` with public inputs `a` and `c`.

```sh
mkdir -p circuits/multiply_three
cd circuits/multiply_three

# compile circuit
circom multiply_three.circom --r1cs --wasm --sym --prime bls12381

# trusted setup (PLONK)
snarkjs powersoftau new bls12-381 5 pot5_0000.ptau -v
snarkjs powersoftau contribute pot5_0000.ptau pot5_0001.ptau --name="First contribution" -v -e="some random text"
snarkjs powersoftau prepare phase2 pot5_0001.ptau pot5_final.ptau -v
snarkjs plonk setup multiply_three.r1cs pot5_final.ptau multiply_three_0000.zkey
snarkjs zkey export verificationkey multiply_three_0000.zkey verification_key.json

cd ../..

# export FunC and Tolk contracts
npx export-ton-verifier ./circuits/multiply_three/multiply_three_0000.zkey ./contracts/multiply_three.tolk
npx export-ton-verifier ./circuits/multiply_three/multiply_three_0000.zkey ./contracts/multiply_three.fc --func
```

### PowerABN (circom)

Computes `c = a^N * b^N` (here N=32). Small circuits can reuse the same ptau; larger constraints may require a higher powersoftau size.

```sh
mkdir -p circuits/PowerABN
cd circuits/PowerABN

# compile circuit
circom PowerABN.circom --r1cs --wasm --sym --prime bls12381

# trusted setup (PLONK)
snarkjs powersoftau new bls12-381 8 pot8_0000.ptau -v
snarkjs powersoftau contribute pot8_0000.ptau pot8_0001.ptau --name="First contribution" -v -e="some random text"
snarkjs powersoftau prepare phase2 pot8_0001.ptau pot8_final.ptau -v
snarkjs plonk setup PowerABN.r1cs pot8_final.ptau PowerABN_0000.zkey
snarkjs zkey export verificationkey PowerABN_0000.zkey verification_key.json

cd ../..

# export FunC and Tolk contracts
npx export-ton-verifier ./circuits/PowerABN/PowerABN_0000.zkey ./contracts/PowerABN.tolk
npx export-ton-verifier ./circuits/PowerABN/PowerABN_0000.zkey ./contracts/PowerABN.fc --func
```

### Reuse (circom)

Computes `out = a * b * c` by reusing a multiplier component.

```sh
mkdir -p circuits/Reuse
cd circuits/Reuse

# compile circuit
circom Reuse.circom --r1cs --wasm --sym --prime bls12381

# trusted setup (PLONK)
snarkjs powersoftau new bls12-381 5 pot5_0000.ptau -v
snarkjs powersoftau contribute pot5_0000.ptau pot5_0001.ptau --name="First contribution" -v -e="some random text"
snarkjs powersoftau prepare phase2 pot5_0001.ptau pot5_final.ptau -v
snarkjs plonk setup Reuse.r1cs pot5_final.ptau Reuse_0000.zkey
snarkjs zkey export verificationkey Reuse_0000.zkey verification_key.json

cd ../..

# export FunC and Tolk contracts
npx export-ton-verifier ./circuits/Reuse/Reuse_0000.zkey ./contracts/Reuse.tolk
npx export-ton-verifier ./circuits/Reuse/Reuse_0000.zkey ./contracts/Reuse.fc --func
```

## Testing contracts

```sh
npx blueprint build --all
npx blueprint test
```
