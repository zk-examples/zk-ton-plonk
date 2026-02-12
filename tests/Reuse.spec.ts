import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, Dictionary, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import { GasLogAndSave } from './gas-logger';
import { Verifier } from '../wrappers/Verifier_plonk';

import * as snarkjs from 'snarkjs';
import path from 'path';

const { exportPlonkFuncCalldata } = require('export-ton-verifier');

const wasmPath = path.join(__dirname, '../circuits/Reuse/Reuse_js', 'Reuse.wasm');
const zkeyPath = path.join(__dirname, '../circuits/Reuse', 'Reuse_0000.zkey');
const verificationKey = require('../circuits/Reuse/verification_key.json');

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
        const input = {
            a: '534',
            b: '43',
            c: '423',
        };
        const { proof, publicSignals } = await snarkjs.plonk.fullProve(input, wasmPath, zkeyPath);
        console.log('Public Signals:', publicSignals);
        // console.log('Proof:', JSON.stringify(proof, null, 2));

        const isVerify = await snarkjs.plonk.verify(verificationKey, publicSignals, proof);
        console.log('snarkjs verification:', isVerify);
        expect(isVerify).toBe(true);

        const calldata = await exportPlonkFuncCalldata(proof, publicSignals);

        // console.log('Calldata length:', calldata.length);
        // console.log('Calldata types:', calldata.map((item: any) => item.type));

        const res = await verifier.getVerify(calldata);

        console.log('Contract verification result:', res);
        // expect(res).toBe(true);
    });
});
