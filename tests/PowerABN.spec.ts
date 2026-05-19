import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import { GasLogAndSave } from './gas-logger';
import { Verifier } from '../wrappers/Verifier_func_plonk';

import * as snarkjs from 'snarkjs';
import path from 'path';

import { exportPlonkFuncCalldata } from 'export-ton-verifier';

const wasmPath = path.join(__dirname, '../circuits/PowerABN/PowerABN_js', 'PowerABN.wasm');
const zkeyPath = path.join(__dirname, '../circuits/PowerABN', 'PowerABN_0000.zkey');
const verificationKey = require('../circuits/PowerABN/verification_key.json');

describe('PowerABN', () => {
    let code: Cell;
    let GAS_LOG = new GasLogAndSave('PowerABN');

    beforeAll(async () => {
        code = await compile('PowerABN');
        GAS_LOG.rememberBocSize('PowerABN', code);
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
            a: '2',
            b: '3',
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
        expect(res).toBe(true);
    });
});
