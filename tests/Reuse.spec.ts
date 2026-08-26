import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, Dictionary, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import { GasLogAndSave } from './gas-logger';
import { Verifier } from '../wrappers/Verifier_func_plonk';

import { exportPlonkFuncCalldata } from 'export-ton-verifier';
import { loadProofFixture } from '../scripts/proofFixtures';

describe('Reuse', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('Reuse');

    beforeAll(async () => {
        code = await compile('Reuse');
        GAS_LOG.rememberBocSize('Reuse', code);
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

    it('should verify', async () => {
        const { proof, publicSignals } = loadProofFixture('reuse-default');
        console.log('Public Signals:', publicSignals);

        const calldata = await exportPlonkFuncCalldata(proof, publicSignals);

        // console.log('Calldata length:', calldata.length);
        // console.log('Calldata types:', calldata.map((item: any) => item.type));

        const res = await verifier.getVerify(calldata);

        console.log('Contract verification result:', res);
        expect(res).toBe(true);
    });
});
