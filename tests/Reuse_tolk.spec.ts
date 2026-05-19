import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';
import path from 'path';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsGeneratedProofMessage } from './tolk-verifier-helpers';

const verificationKey = require('../circuits/Reuse/verification_key.json');
const wasmPath = path.join(__dirname, '../circuits/Reuse/Reuse_js', 'Reuse.wasm');
const zkeyPath = path.join(__dirname, '../circuits/Reuse', 'Reuse_0000.zkey');
const validInput = { a: '534', b: '43', c: '423' };

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
        await expectVerifierAcceptsGeneratedProofMessage(
            deployer,
            verifier,
            verificationKey,
            validInput,
            wasmPath,
            zkeyPath,
            { logger: GAS_LOG, getterStepName: 'Getter verify', messageStepName: 'Send verify' },
        );
    });

});
