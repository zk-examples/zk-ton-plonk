import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';
import path from 'path';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsGeneratedProof } from './tolk-verifier-helpers';

const verificationKey = require('../circuits/condition/verification_key.json');
const wasmPath = path.join(__dirname, '../circuits/condition/condition_js', 'condition.wasm');
const zkeyPath = path.join(__dirname, '../circuits/condition', 'condition_0000.zkey');

describe('condition_tolk', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('condition_tolk');

    beforeAll(async () => {
        code = await compile('condition_tolk');
        GAS_LOG.rememberBocSize('condition_tolk', code);
    });

    afterAll(() => {
        GAS_LOG.saveCurrentRunAfterAll();
    });

    it.each([
        ['cond=1 (output a)', { a: '10', b: '20', cond: '1' }],
        ['cond=0 (output b)', { a: '10', b: '20', cond: '0' }],
    ])('should call the Tolk verifier with a PLONK proof for %s', async (_name, input) => {
        const { verifier } = await deployVerifier(code, GAS_LOG);

        await expectVerifierAcceptsGeneratedProof(verifier, verificationKey, input, wasmPath, zkeyPath, {
            logger: GAS_LOG,
            stepName: `Verify ${input.cond}`,
        });
    });
});
