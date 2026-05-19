import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';
import path from 'path';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsGeneratedProofMessage } from './tolk-verifier-helpers';

const verificationKey = require('../circuits/multiply_three/verification_key.json');
const wasmPath = path.join(__dirname, '../circuits/multiply_three/multiply_three_js', 'multiply_three.wasm');
const zkeyPath = path.join(__dirname, '../circuits/multiply_three', 'multiply_three_0000.zkey');

describe('multiply_three_tolk', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('multiply_three_tolk');

    beforeAll(async () => {
        code = await compile('multiply_three_tolk');
        GAS_LOG.rememberBocSize('multiply_three_tolk', code);
    });

    afterAll(() => {
        GAS_LOG.saveCurrentRunAfterAll();
    });

    it('should call the Tolk verifier with a PLONK proof for a*b*c', async () => {
        const { deployer, verifier } = await deployVerifier(code, GAS_LOG);

        await expectVerifierAcceptsGeneratedProofMessage(
            deployer,
            verifier,
            verificationKey,
            { a: '10', b: '20', c: '30' },
            wasmPath,
            zkeyPath,
            { logger: GAS_LOG, getterStepName: 'Getter verify', messageStepName: 'Send verify' },
        );
    });
});
