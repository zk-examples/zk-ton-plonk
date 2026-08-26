import { Address, beginCell, Cell, toNano, TupleItem } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';
import { exportPlonkFuncCalldata, exportPlonkTolkCalldata } from 'export-ton-verifier';
import { loadProofFixture } from '../scripts/proofFixtures';
import {
    Verifier as FuncVerifier,
    proofMessageToCell as funcProofMessageToCell,
} from '../wrappers/Verifier_func_plonk';
import {
    Verifier as TolkVerifier,
    proofMessageToCell as tolkProofMessageToCell,
} from '../wrappers/Verifier_tolk_plonk';

jest.setTimeout(120_000);

const scalarField = BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001');

type TransactionResult = { transactions: any[] };

function targetTransaction(result: TransactionResult, address: Address): any {
    const transaction = result.transactions.find(
        (candidate) =>
            candidate.inMessage?.info.type === 'internal' && candidate.inMessage.info.dest.equals(address),
    );
    expect(transaction).toBeDefined();
    return transaction;
}

function expectVmExit(result: TransactionResult, address: Address, exitCode: number): void {
    const transaction = targetTransaction(result, address);
    expect(transaction.description.type).toBe('generic');
    expect(transaction.description.computePhase.type).toBe('vm');
    expect(transaction.description.computePhase.exitCode).toBe(exitCode);
}

function mismatchFirstCompressedPoint(body: Cell): Cell {
    const root = body.beginParse();
    const opcode = root.loadUint(32);
    const payload = root.loadRef().beginParse();
    root.endParse();

    const compressed = payload.loadRef().beginParse();
    const firstPair = compressed.loadRef().beginParse();
    const a = firstPair.loadBuffer(48);
    const b = firstPair.loadBuffer(48);
    firstPair.endParse();
    a[0] ^= 0x20;

    const changedPair = beginCell().storeBuffer(a).storeBuffer(b).endCell();
    const changedCompressed = beginCell().storeRef(changedPair).storeSlice(compressed).endCell();
    const changedPayload = beginCell().storeRef(changedCompressed).storeSlice(payload).endCell();
    return beginCell().storeUint(opcode, 32).storeRef(changedPayload).endCell();
}

function addTrailingBit(body: Cell): Cell {
    const root = body.beginParse();
    const opcode = root.loadUint(32);
    const payload = root.loadRef();
    root.endParse();
    return beginCell().storeUint(opcode, 32).storeBit(true).storeRef(payload).endCell();
}

async function sendRaw(
    deployer: SandboxContract<TreasuryContract>,
    address: Address,
    body: Cell,
): Promise<TransactionResult> {
    return deployer.send({ to: address, value: toNano('1'), body });
}

describe('PLONK internal message security', () => {
    let code: Record<'FunC' | 'Tolk', Cell>;
    let validCalldata: Record<'FunC' | 'Tolk', TupleItem[]>;
    let invalidCalldata: Record<'FunC' | 'Tolk', TupleItem[]>;

    beforeAll(async () => {
        const { proof, publicSignals } = loadProofFixture('condition-cond-1');

        const invalidProof = {
            ...proof,
            eval_a: ((BigInt(proof.eval_a) + 1n) % scalarField).toString(),
        };
        code = {
            FunC: await compile('condition'),
            Tolk: await compile('condition_tolk'),
        };
        validCalldata = {
            FunC: await exportPlonkFuncCalldata(proof, publicSignals),
            Tolk: await exportPlonkTolkCalldata(proof, publicSignals),
        };
        invalidCalldata = {
            FunC: await exportPlonkFuncCalldata(invalidProof, publicSignals),
            Tolk: await exportPlonkTolkCalldata(invalidProof, publicSignals),
        };
    });

    for (const language of ['FunC', 'Tolk'] as const) {
        describe(language, () => {
            async function deploy() {
                const blockchain = await Blockchain.create();
                const contract =
                    language === 'FunC'
                        ? FuncVerifier.createFromConfig({}, code.FunC)
                        : TolkVerifier.createFromConfig({}, code.Tolk);
                const verifier: any = blockchain.openContract(contract);
                const deployer = await blockchain.treasury(`plonk-message-${language}`);
                const result = await verifier.sendDeploy(deployer.getSender(), toNano('0.05'));
                expect(result.transactions).toHaveTransaction({
                    from: deployer.address,
                    to: verifier.address,
                    deploy: true,
                    success: true,
                });
                return { deployer, verifier };
            }

            function messageBody(calldata: TupleItem[]): Cell {
                return language === 'FunC'
                    ? funcProofMessageToCell(calldata)
                    : tolkProofMessageToCell(calldata);
            }

            it('accepts the same valid real proof via getter and internal message', async () => {
                const { deployer, verifier } = await deploy();
                expect(await verifier.getVerify(validCalldata[language])).toBe(true);
                const result = await verifier.sendVerify(
                    deployer.getSender(),
                    toNano('1'),
                    validCalldata[language],
                );
                expectVmExit(result, verifier.address, 0);
            });

            it('rejects an invalid proof via getter and internal message', async () => {
                const { deployer, verifier } = await deploy();
                expect(await verifier.getVerify(invalidCalldata[language])).toBe(false);
                const result = await verifier.sendVerify(
                    deployer.getSender(),
                    toNano('1'),
                    invalidCalldata[language],
                );
                expectVmExit(result, verifier.address, 106);
            });

            it('rejects truncated and trailing-data payloads', async () => {
                const { deployer, verifier } = await deploy();
                const validBody = messageBody(validCalldata[language]);
                const truncated = beginCell().storeUint(0x76524659, 32).endCell();
                expectVmExit(await sendRaw(deployer, verifier.address, truncated), verifier.address, 105);
                expectVmExit(
                    await sendRaw(deployer, verifier.address, addTrailingBit(validBody)),
                    verifier.address,
                    105,
                );
            });

            it('rejects a structurally malformed payload reference', async () => {
                const { deployer, verifier } = await deploy();
                const malformed = beginCell()
                    .storeUint(0x76524659, 32)
                    .storeRef(beginCell().endCell())
                    .endCell();
                expectVmExit(await sendRaw(deployer, verifier.address, malformed), verifier.address, 105);
            });

            it('rejects mismatched compressed and transcript point encodings', async () => {
                const { deployer, verifier } = await deploy();
                const mismatch = mismatchFirstCompressedPoint(messageBody(validCalldata[language]));
                expectVmExit(await sendRaw(deployer, verifier.address, mismatch), verifier.address, 106);
            });
        });
    }
});
