import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';
import path from 'path';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsGeneratedProofMessage } from './tolk-verifier-helpers';

const verificationKey = require('../circuits/fibonacci/verification_key.json');
const wasmPath = path.join(__dirname, '../circuits/fibonacci/fibonacci_js', 'fibonacci.wasm');
const zkeyPath = path.join(__dirname, '../circuits/fibonacci', 'fibonacci_0000.zkey');

describe('fibonacci_tolk', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('fibonacci_tolk');

    beforeAll(async () => {
        code = await compile('fibonacci_tolk');
        GAS_LOG.rememberBocSize('fibonacci_tolk', code);
    });

    afterAll(() => {
        GAS_LOG.saveCurrentRunAfterAll();
    });

    it('should call the Tolk verifier with a PLONK proof for fibonacci(10)', async () => {
        const { deployer, verifier } = await deployVerifier(code, GAS_LOG);

        await expectVerifierAcceptsGeneratedProofMessage(
            deployer,
            verifier,
            verificationKey,
            { in: ['1', '1'] },
            wasmPath,
            zkeyPath,
            { logger: GAS_LOG, getterStepName: 'Getter verify', messageStepName: 'Send verify' },
        );
    });
});
