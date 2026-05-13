import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, TupleItem } from '@ton/core';
import '@ton/test-utils';

import { Verifier } from '../wrappers/Verifier_plonk';
import { GasLogAndSave } from './gas-logger';

import * as snarkjs from 'snarkjs';

const { exportPlonkFuncCalldata } = require('export-ton-verifier');

type CircuitInput = Record<string, string | string[]>;
type GetterBenchmark = { logger: GasLogAndSave; stepName: string };

export async function deployVerifier(code: Cell): Promise<{
    deployer: SandboxContract<TreasuryContract>;
    verifier: SandboxContract<Verifier>;
}>;
export async function deployVerifier(
    code: Cell,
    logger: GasLogAndSave,
): Promise<{
    deployer: SandboxContract<TreasuryContract>;
    verifier: SandboxContract<Verifier>;
}>;
export async function deployVerifier(code: Cell, logger?: GasLogAndSave) {
    const blockchain = await Blockchain.create();
    const verifier = blockchain.openContract(Verifier.createFromConfig({}, code));
    const deployer = await blockchain.treasury('deployer');

    const deployResult = await verifier.sendDeploy(deployer.getSender(), toNano('0.05'));

    expect(deployResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: verifier.address,
        deploy: true,
        success: true,
    });

    logger?.rememberGas('Deploy', deployResult.transactions.slice(1));

    return { deployer, verifier };
}

export async function generateCalldata(
    input: CircuitInput,
    wasmPath: string,
    zkeyPath: string,
    verificationKey: any,
): Promise<TupleItem[]> {
    const { proof, publicSignals } = await snarkjs.plonk.fullProve(input, wasmPath, zkeyPath);

    expect(publicSignals).toBeDefined();

    const isVerify = await snarkjs.plonk.verify(verificationKey, publicSignals, proof);
    expect(isVerify).toBe(true);

    return exportPlonkFuncCalldata(proof, publicSignals);
}

export async function expectVerifierAcceptsGeneratedProof(
    verifier: SandboxContract<Verifier>,
    verificationKey: any,
    input: CircuitInput,
    wasmPath: string,
    zkeyPath: string,
    benchmark?: GetterBenchmark,
) {
    const calldata = await generateCalldata(input, wasmPath, zkeyPath, verificationKey);
    const res = await verifier.getVerifyResult(calldata);

    expect(res.ok).toBe(true);
    benchmark?.logger.rememberGasValue(benchmark.stepName, res.gasUsed);

    return calldata;
}
