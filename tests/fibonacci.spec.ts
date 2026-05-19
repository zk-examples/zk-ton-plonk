import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import { GasLogAndSave } from './gas-logger';
import { Verifier } from '../wrappers/Verifier_func_plonk';

import * as snarkjs from 'snarkjs';
import path from 'path';

import { exportPlonkFuncCalldata } from 'export-ton-verifier';

const wasmPath = path.join(__dirname, '../circuits/fibonacci/fibonacci_js', 'fibonacci.wasm');
const zkeyPath = path.join(__dirname, '../circuits/fibonacci', 'fibonacci_0000.zkey');
const verificationKey = require('../circuits/fibonacci/verification_key.json');

describe('fibonacci', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('fibonacci');

    beforeAll(async () => {
        code = await compile('fibonacci');
        GAS_LOG.rememberBocSize('fibonacci', code);
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

    it('should verify fibonacci(10) with in=[1,1]', async () => {
        const input = { in: ['1', '1'] };
        const { proof, publicSignals } = await snarkjs.plonk.fullProve(input, wasmPath, zkeyPath);
        expect(publicSignals).toBeDefined();

        const isVerify = await snarkjs.plonk.verify(verificationKey, publicSignals, proof);
        expect(isVerify).toBe(true);

        const calldata = await exportPlonkFuncCalldata(proof, publicSignals);
        const res = await verifier.getVerify(calldata);
        expect(res).toBe(true);
    });
});
