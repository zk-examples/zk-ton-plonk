import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsProofMessage } from './tolk-verifier-helpers';
import { loadProofFixture } from '../scripts/proofFixtures';

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

        await expectVerifierAcceptsProofMessage(
            deployer,
            verifier,
            loadProofFixture('fibonacci-default'),
            { logger: GAS_LOG, getterStepName: 'Getter verify', messageStepName: 'Send verify' },
        );
    });
});
