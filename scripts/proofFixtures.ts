import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import * as snarkjs from 'snarkjs';

type CircuitInput = Record<string, string | string[]>;

export type ProofFixtureSpec = {
    id: string;
    circuitName: string;
    directory: string;
    input: CircuitInput;
};

type ProofFixtureManifestEntry = {
    input: { path: string; sha256: string };
    proof: { path: string; sha256: string };
    publicSignals: { path: string; sha256: string };
    verificationKey: { path: string; sha256: string };
    wasm: { path: string; sha256: string };
    zkey: { path: string; sha256: string };
};

type ProofFixtureManifest = {
    schema: 1;
    protocol: 'plonk';
    curve: 'bls12-381';
    snarkjs: string;
    fixtures: Record<string, ProofFixtureManifestEntry>;
};

export const proofFixtureSpecs: ProofFixtureSpec[] = [
    {
        id: 'condition-cond-1',
        circuitName: 'condition',
        directory: 'condition',
        input: { a: '10', b: '20', cond: '1' },
    },
    {
        id: 'condition-cond-0',
        circuitName: 'condition',
        directory: 'condition',
        input: { a: '10', b: '20', cond: '0' },
    },
    {
        id: 'fibonacci-default',
        circuitName: 'fibonacci',
        directory: 'fibonacci',
        input: { in: ['1', '1'] },
    },
    {
        id: 'multiply-three-default',
        circuitName: 'multiply_three',
        directory: 'multiply_three',
        input: { a: '10', b: '20', c: '30' },
    },
    {
        id: 'power-abn-default',
        circuitName: 'PowerABN',
        directory: 'PowerABN',
        input: { a: '2', b: '3' },
    },
    {
        id: 'reuse-default',
        circuitName: 'Reuse',
        directory: 'Reuse',
        input: { a: '534', b: '43', c: '423' },
    },
];

const repoRoot = path.resolve(__dirname, '..');
const circuitsRoot = path.join(repoRoot, 'circuits');
const manifestPath = path.join(circuitsRoot, 'proofs-manifest.json');

function sha256(fileName: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(fileName)).digest('hex');
}

function relativePath(fileName: string): string {
    return path.relative(repoRoot, fileName).split(path.sep).join('/');
}

function packageVersion(packageName: string): string {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, 'node_modules', packageName, 'package.json'), 'utf8')).version;
}

function fixturePaths(spec: ProofFixtureSpec) {
    const circuitDirectory = path.join(circuitsRoot, spec.directory);
    const fixtureDirectory = path.join(circuitDirectory, 'proofs', spec.id);
    return {
        fixtureDirectory,
        input: path.join(fixtureDirectory, 'input.json'),
        proof: path.join(fixtureDirectory, 'proof.json'),
        publicSignals: path.join(fixtureDirectory, 'public.json'),
        verificationKey: path.join(circuitDirectory, 'verification_key.json'),
        wasm: path.join(circuitDirectory, `${spec.circuitName}_js`, `${spec.circuitName}.wasm`),
        zkey: path.join(circuitDirectory, `${spec.circuitName}_0000.zkey`),
    };
}

function writeJson(fileName: string, value: unknown): void {
    fs.writeFileSync(fileName, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function manifestEntry(spec: ProofFixtureSpec): ProofFixtureManifestEntry {
    const files = fixturePaths(spec);
    return {
        input: { path: relativePath(files.input), sha256: sha256(files.input) },
        proof: { path: relativePath(files.proof), sha256: sha256(files.proof) },
        publicSignals: { path: relativePath(files.publicSignals), sha256: sha256(files.publicSignals) },
        verificationKey: { path: relativePath(files.verificationKey), sha256: sha256(files.verificationKey) },
        wasm: { path: relativePath(files.wasm), sha256: sha256(files.wasm) },
        zkey: { path: relativePath(files.zkey), sha256: sha256(files.zkey) },
    };
}

function assertEqual(label: string, actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${label} mismatch.\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
    }
}

export function loadProofFixture(id: string): { proof: snarkjs.PlonkProof; publicSignals: snarkjs.PublicSignals } {
    const spec = proofFixtureSpecs.find((candidate) => candidate.id === id);
    if (!spec) {
        throw new Error(`Unknown PLONK proof fixture: ${id}`);
    }
    const files = fixturePaths(spec);
    return {
        proof: JSON.parse(fs.readFileSync(files.proof, 'utf8')) as snarkjs.PlonkProof,
        publicSignals: JSON.parse(fs.readFileSync(files.publicSignals, 'utf8')) as snarkjs.PublicSignals,
    };
}

export async function buildProofFixtures(): Promise<void> {
    const fixtures: Record<string, ProofFixtureManifestEntry> = {};

    for (const spec of proofFixtureSpecs) {
        const files = fixturePaths(spec);
        fs.mkdirSync(files.fixtureDirectory, { recursive: true });
        writeJson(files.input, spec.input);

        console.log(`Proving ${spec.id}...`);
        const { proof, publicSignals } = await snarkjs.plonk.fullProve(spec.input, files.wasm, files.zkey);
        const verificationKey = JSON.parse(fs.readFileSync(files.verificationKey, 'utf8'));
        if (!(await snarkjs.plonk.verify(verificationKey, publicSignals, proof))) {
            throw new Error(`snarkjs rejected freshly generated proof fixture ${spec.id}.`);
        }

        writeJson(files.proof, proof);
        writeJson(files.publicSignals, publicSignals);
        fixtures[spec.id] = manifestEntry(spec);
    }

    const manifest: ProofFixtureManifest = {
        schema: 1,
        protocol: 'plonk',
        curve: 'bls12-381',
        snarkjs: packageVersion('snarkjs'),
        fixtures,
    };
    writeJson(manifestPath, manifest);
    console.log(`Wrote ${relativePath(manifestPath)}`);
}

export async function verifyTrackedProofFixtures(): Promise<void> {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ProofFixtureManifest;
    assertEqual('proof manifest schema', manifest.schema, 1);
    assertEqual('proof manifest protocol', manifest.protocol, 'plonk');
    assertEqual('proof manifest curve', manifest.curve, 'bls12-381');
    assertEqual('proof manifest snarkjs version', manifest.snarkjs, packageVersion('snarkjs'));
    assertEqual('proof manifest fixture ids', Object.keys(manifest.fixtures), proofFixtureSpecs.map((spec) => spec.id));

    let invalidProofWasRejected = false;
    for (const spec of proofFixtureSpecs) {
        const files = fixturePaths(spec);
        const expected = manifest.fixtures[spec.id];
        assertEqual(`${spec.id} artifact hashes`, manifestEntry(spec), expected);
        assertEqual(`${spec.id} canonical input`, JSON.parse(fs.readFileSync(files.input, 'utf8')), spec.input);

        const proof = JSON.parse(fs.readFileSync(files.proof, 'utf8')) as snarkjs.PlonkProof;
        const publicSignals = JSON.parse(fs.readFileSync(files.publicSignals, 'utf8')) as snarkjs.PublicSignals;
        const verificationKey = JSON.parse(fs.readFileSync(files.verificationKey, 'utf8'));
        if (!(await snarkjs.plonk.verify(verificationKey, publicSignals, proof))) {
            throw new Error(`snarkjs rejected tracked proof fixture ${spec.id}.`);
        }

        if (!invalidProofWasRejected) {
            const scalarField = BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001');
            const invalidProof = {
                ...proof,
                eval_a: ((BigInt(proof.eval_a) + 1n) % scalarField).toString(),
            };
            if (await snarkjs.plonk.verify(verificationKey, publicSignals, invalidProof)) {
                throw new Error(`snarkjs accepted a tampered proof derived from ${spec.id}.`);
            }
            invalidProofWasRejected = true;
        }
    }
    console.log('Tampered PLONK proof rejected by snarkjs.');
}

async function main(): Promise<void> {
    const mode = process.argv[2];
    if (mode === '--build') {
        await buildProofFixtures();
        return;
    }
    if (mode === '--verify') {
        await verifyTrackedProofFixtures();
        console.log('Tracked PLONK proof fixtures verified.');
        return;
    }
    throw new Error('Use --build or --verify.');
}

if (require.main === module) {
    void main().then(
        () => process.exit(0),
        (error: unknown) => {
            console.error(error instanceof Error ? error.message : error);
            process.exit(1);
        },
    );
}
