import { Cell, toNano, TupleItem } from '@ton/core';
import { compile } from '@ton/blueprint';
import path from 'path';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsGeneratedProof } from './tolk-verifier-helpers';

const verificationKey = require('../circuits/Reuse/verification_key.json');
const wasmPath = path.join(__dirname, '../circuits/Reuse/Reuse_js', 'Reuse.wasm');
const zkeyPath = path.join(__dirname, '../circuits/Reuse', 'Reuse_0000.zkey');
const validInput = { a: '534', b: '43', c: '423' };

function requireTupleInt(item: TupleItem | undefined, index: number): bigint {
    if (item?.type !== 'int') {
        throw new Error(`Expected calldata[${index}] to be int`);
    }

    return item.value;
}

describe('Reuse_tolk', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('Reuse_tolk');

    beforeAll(async () => {
        code = await compile('Reuse_tolk');
        GAS_LOG.rememberBocSize('Reuse_tolk', code);
    });

    afterAll(() => {
        GAS_LOG.saveCurrentRunAfterAll();
    });

    it('should call the Tolk verifier and send a PLONK proof to the contract', async () => {
        const { deployer, verifier } = await deployVerifier(code, GAS_LOG);
        const calldata = await expectVerifierAcceptsGeneratedProof(
            verifier,
            verificationKey,
            validInput,
            wasmPath,
            zkeyPath,
            { logger: GAS_LOG, stepName: 'Getter verify' },
        );

        const verifyResult = await verifier.sendVerify(deployer.getSender(), toNano('1'), calldata);
        GAS_LOG.rememberGas('Send verify', verifyResult.transactions.slice(1));

        expect(verifyResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            success: true,
        });
    });

    it('should reject an invalid PLONK proof sent as an internal message', async () => {
        const { deployer, verifier } = await deployVerifier(code, GAS_LOG);
        const calldata = await expectVerifierAcceptsGeneratedProof(
            verifier,
            verificationKey,
            validInput,
            wasmPath,
            zkeyPath,
            { logger: GAS_LOG, stepName: 'Getter verify before invalid send' },
        );
        const badCalldata = [...calldata];
        badCalldata[7] = { type: 'int', value: requireTupleInt(badCalldata[7], 7) + 1n };

        const verifyResult = await verifier.sendVerify(deployer.getSender(), toNano('1'), badCalldata);
        GAS_LOG.rememberGas('Reject invalid proof', verifyResult.transactions.slice(1));

        expect(verifyResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            success: false,
            exitCode: 106,
        });
    });
});
