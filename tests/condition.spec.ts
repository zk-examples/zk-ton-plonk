import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import { GasLogAndSave } from './gas-logger';
import { Verifier } from '../wrappers/Verifier_func_plonk';

import { exportPlonkFuncCalldata } from 'export-ton-verifier';
import { loadProofFixture } from '../scripts/proofFixtures';

describe('condition', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('condition');

    beforeAll(async () => {
        code = await compile('condition');
        GAS_LOG.rememberBocSize('condition', code);
    });

    afterAll(() => {
        GAS_LOG.saveCurrentRunAfterAll();
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let verifier: SandboxContract<Verifier>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        verifier = blockchain.openContract(Verifier.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await verifier.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: verifier.address,
            deploy: true,
            success: true,
        });

        GAS_LOG.rememberGas('Deploy', deployResult.transactions.slice(1));
    });

    it('should verify when cond=1 (output a)', async () => {
        const { proof, publicSignals } = loadProofFixture('condition-cond-1');

        const calldata = await exportPlonkFuncCalldata(proof, publicSignals);
        const res = await verifier.getVerify(calldata);
        expect(res).toBe(true);
    });

    it('should verify when cond=0 (output b)', async () => {
        const { proof, publicSignals } = loadProofFixture('condition-cond-0');

        const calldata = await exportPlonkFuncCalldata(proof, publicSignals);
        const res = await verifier.getVerify(calldata);
        expect(res).toBe(true);
    });
});
