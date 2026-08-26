import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsProofMessage } from './tolk-verifier-helpers';
import { loadProofFixture } from '../scripts/proofFixtures';

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
        await expectVerifierAcceptsProofMessage(
            deployer,
            verifier,
            loadProofFixture('reuse-default'),
            { logger: GAS_LOG, getterStepName: 'Getter verify', messageStepName: 'Send verify' },
        );
    });

});
