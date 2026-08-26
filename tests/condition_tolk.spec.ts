import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import { GasLogAndSave } from './gas-logger';
import { deployVerifier, expectVerifierAcceptsProofMessage } from './tolk-verifier-helpers';
import { loadProofFixture } from '../scripts/proofFixtures';

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
        ['cond=1 (output a)', 'condition-cond-1'],
        ['cond=0 (output b)', 'condition-cond-0'],
    ])('should call the Tolk verifier with a PLONK proof for %s', async (_name, fixtureId) => {
        const { deployer, verifier } = await deployVerifier(code, GAS_LOG);

        await expectVerifierAcceptsProofMessage(
            deployer,
            verifier,
            loadProofFixture(fixtureId),
            {
                logger: GAS_LOG,
                getterStepName: `Getter verify ${fixtureId}`,
                messageStepName: `Send verify ${fixtureId}`,
            },
        );
    });
});
