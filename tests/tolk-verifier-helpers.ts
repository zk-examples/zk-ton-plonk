import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, TupleItem } from '@ton/core';
import '@ton/test-utils';

import { Verifier } from '../wrappers/Verifier_tolk_plonk';
import { GasLogAndSave } from './gas-logger';

import { exportPlonkTolkCalldata } from 'export-ton-verifier';

type ProofPayload = { proof: Record<string, unknown>; publicSignals: string[] };
type GetterBenchmark = { logger: GasLogAndSave; stepName: string };
type MessageBenchmark = {
    logger: GasLogAndSave;
    getterStepName: string;
    messageStepName: string;
};

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

export async function proofCalldata(payload: ProofPayload): Promise<TupleItem[]> {
    return exportPlonkTolkCalldata(payload.proof, payload.publicSignals);
}

export async function expectVerifierAcceptsProof(
    verifier: SandboxContract<Verifier>,
    payload: ProofPayload,
    benchmark?: GetterBenchmark,
) {
    const calldata = await proofCalldata(payload);
    const res = await verifier.getVerifyResult(calldata);

    expect(res.ok).toBe(true);
    benchmark?.logger.rememberGasValue(benchmark.stepName, res.gasUsed);

    return calldata;
}

export async function expectVerifierAcceptsProofMessage(
    deployer: SandboxContract<TreasuryContract>,
    verifier: SandboxContract<Verifier>,
    payload: ProofPayload,
    benchmark: MessageBenchmark,
) {
    const calldata = await expectVerifierAcceptsProof(verifier, payload, {
        logger: benchmark.logger,
        stepName: benchmark.getterStepName,
    });

    const verifyResult = await verifier.sendVerify(deployer.getSender(), toNano('1'), calldata);
    benchmark.logger.rememberGas(benchmark.messageStepName, verifyResult.transactions.slice(1));

    expect(verifyResult.transactions).toHaveTransaction({
        from: deployer.address,
        to: verifier.address,
        success: true,
    });

    return calldata;
}
