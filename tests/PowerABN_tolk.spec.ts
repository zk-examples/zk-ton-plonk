import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';
import path from 'path';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsGeneratedProof } from './tolk-verifier-helpers';

const verificationKey = require('../circuits/PowerABN/verification_key.json');
const wasmPath = path.join(__dirname, '../circuits/PowerABN/PowerABN_js', 'PowerABN.wasm');
const zkeyPath = path.join(__dirname, '../circuits/PowerABN', 'PowerABN_0000.zkey');

describe('PowerABN_tolk', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('PowerABN_tolk');

    beforeAll(async () => {
        code = await compile('PowerABN_tolk');
        GAS_LOG.rememberBocSize('PowerABN_tolk', code);
    });

    afterAll(() => {
        GAS_LOG.saveCurrentRunAfterAll();
    });

    it('should call the Tolk verifier with a PLONK proof for a^N*b^N', async () => {
        const { verifier } = await deployVerifier(code, GAS_LOG);

        await expectVerifierAcceptsGeneratedProof(verifier, verificationKey, { a: '2', b: '3' }, wasmPath, zkeyPath, {
            logger: GAS_LOG,
            stepName: 'Verify',
        });
    });
});
