import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const CURVE = 'bls12-381';
const CIRCOM_COMPILER_VERSION = '2.2.3';
const PTAU_POWER = 8;
const PTAU_RELATIVE_PATH = 'circuits/bls12-381-pot8-final.ptau';
const MANIFEST_RELATIVE_PATH = 'circuits/artifacts-manifest.json';

interface CircuitSpec {
    name: string;
    directory: string;
    sources: string[];
}

interface CircuitManifest {
    sources: Record<string, string>;
    artifacts: Record<string, string>;
}

interface ArtifactManifest {
    schema: 1;
    curve: string;
    ptauPower: number;
    ptau: { path: string; sha256: string };
    tools: { circom: string; snarkjs: string };
    circuits: Record<string, CircuitManifest>;
}

const CIRCUITS: CircuitSpec[] = [
    { name: 'condition', directory: 'condition', sources: ['condition.circom'] },
    { name: 'fibonacci', directory: 'fibonacci', sources: ['fibonacci.circom'] },
    { name: 'multiply_three', directory: 'multiply_three', sources: ['multiply_three.circom'] },
    { name: 'PowerABN', directory: 'PowerABN', sources: ['PowerABN.circom'] },
    { name: 'Reuse', directory: 'Reuse', sources: ['Reuse.circom', 'Multiplier.circom'] },
];

const repoRoot = path.resolve(__dirname, '..');
const circuitsRoot = path.join(repoRoot, 'circuits');
const ptauPath = path.join(repoRoot, PTAU_RELATIVE_PATH);
const manifestPath = path.join(repoRoot, MANIFEST_RELATIVE_PATH);
const snarkjsCliPath = path.join(repoRoot, 'node_modules', 'snarkjs', 'cli.js');
const checkOnly = process.argv.slice(2).includes('--check');
const verifyOnly = process.argv.slice(2).includes('--verify');

function sha256(fileName: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(fileName)).digest('hex');
}

function packageVersion(packageName: string): string {
    const packagePath = path.join(repoRoot, 'node_modules', packageName, 'package.json');
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version as string;
}

function createInitialPtau(fileName: string): void {
    runSnarkjs(['powersoftau', 'new', CURVE, PTAU_POWER.toString(), fileName]);
}

function runSnarkjs(args: string[], input?: string): void {
    const result = spawnSync(process.execPath, [snarkjsCliPath, ...args], {
        cwd: repoRoot,
        input,
        stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    });

    if (result.error) {
        throw new Error(`Unable to run snarkjs ${args.join(' ')}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`snarkjs ${args.join(' ')} failed with exit code ${result.status}`);
    }
}

function createDevelopmentPtau(): void {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zk-ton-plonk-ptau-'));
    const initialPath = path.join(temporaryRoot, 'pot8_0000.ptau');
    const contributedPath = path.join(temporaryRoot, 'pot8_0001.ptau');
    const beaconPath = path.join(temporaryRoot, 'pot8_beacon.ptau');
    let contributionEntropy = crypto.randomBytes(64).toString('hex');
    let beaconEntropy = crypto.randomBytes(32).toString('hex');

    try {
        console.log(`Creating a ${CURVE} Powers of Tau transcript with 2^${PTAU_POWER} powers...`);
        createInitialPtau(initialPath);
        runSnarkjs(
            [
                'powersoftau',
                'contribute',
                initialPath,
                contributedPath,
                '--name=zk-ton-plonk local CSPRNG contribution',
            ],
            `${contributionEntropy}\n`,
        );
        runSnarkjs([
            'powersoftau',
            'beacon',
            contributedPath,
            beaconPath,
            beaconEntropy,
            '10',
            '--name=zk-ton-plonk final CSPRNG beacon',
        ]);
        runSnarkjs(['powersoftau', 'prepare', 'phase2', beaconPath, ptauPath]);
    } finally {
        contributionEntropy = '';
        beaconEntropy = '';
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function verifyPtau(): void {
    runSnarkjs(['powersoftau', 'verify', ptauPath]);
}

function artifactPaths(spec: CircuitSpec, outputDirectory: string): Record<string, string> {
    return {
        r1cs: path.join(outputDirectory, `${spec.name}.r1cs`),
        sym: path.join(outputDirectory, `${spec.name}.sym`),
        wasm: path.join(outputDirectory, `${spec.name}_js`, `${spec.name}.wasm`),
        zkey: path.join(outputDirectory, `${spec.name}_0000.zkey`),
        verificationKey: path.join(outputDirectory, 'verification_key.json'),
    };
}

function sourceHashes(spec: CircuitSpec): Record<string, string> {
    return Object.fromEntries(
        spec.sources.map((source) => [source, sha256(path.join(circuitsRoot, spec.directory, source))]),
    );
}

function generateCircuitArtifacts(spec: CircuitSpec, setupOutputDirectory: string): CircuitManifest {
    console.log(`Building ${spec.name}...`);
    fs.mkdirSync(setupOutputDirectory, { recursive: true });
    const trackedArtifacts = artifactPaths(spec, path.join(circuitsRoot, spec.directory));
    const setupArtifacts = artifactPaths(spec, setupOutputDirectory);
    runSnarkjs(['plonk', 'setup', trackedArtifacts.r1cs, ptauPath, setupArtifacts.zkey]);
    runSnarkjs(['zkey', 'export', 'verificationkey', setupArtifacts.zkey, setupArtifacts.verificationKey]);

    return {
        sources: sourceHashes(spec),
        artifacts: {
            r1cs: sha256(trackedArtifacts.r1cs),
            sym: sha256(trackedArtifacts.sym),
            wasm: sha256(trackedArtifacts.wasm),
            zkey: sha256(setupArtifacts.zkey),
            verificationKey: sha256(setupArtifacts.verificationKey),
        },
    };
}

function buildManifest(circuits: Record<string, CircuitManifest>): ArtifactManifest {
    return {
        schema: 1,
        curve: CURVE,
        ptauPower: PTAU_POWER,
        ptau: { path: PTAU_RELATIVE_PATH, sha256: sha256(ptauPath) },
        tools: {
            circom: CIRCOM_COMPILER_VERSION,
            snarkjs: packageVersion('snarkjs'),
        },
        circuits,
    };
}

function assertEqual(label: string, actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${label} is not reproducible.\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
    }
}

function verifyTrackedArtifacts(manifest: ArtifactManifest): void {
    assertEqual('curve', CURVE, manifest.curve);
    assertEqual('ptau power', PTAU_POWER, manifest.ptauPower);
    assertEqual('ptau path', PTAU_RELATIVE_PATH, manifest.ptau.path);
    assertEqual('ptau SHA-256', sha256(ptauPath), manifest.ptau.sha256);
    assertEqual('circom version', CIRCOM_COMPILER_VERSION, manifest.tools.circom);
    assertEqual('snarkjs version', packageVersion('snarkjs'), manifest.tools.snarkjs);

    for (const spec of CIRCUITS) {
        const expected = manifest.circuits[spec.name];
        if (!expected) {
            throw new Error(`Missing ${spec.name} in ${MANIFEST_RELATIVE_PATH}`);
        }
        assertEqual(`${spec.name} source hashes`, sourceHashes(spec), expected.sources);
        const tracked = artifactPaths(spec, path.join(circuitsRoot, spec.directory));
        const trackedHashes = Object.fromEntries(
            Object.entries(tracked).map(([name, fileName]) => [name, sha256(fileName)]),
        );
        assertEqual(`${spec.name} tracked artifact hashes`, trackedHashes, expected.artifacts);
    }
}

function main(): void {
    if (checkOnly && verifyOnly) {
        throw new Error('Use either --check or --verify, not both.');
    }

    if (!fs.existsSync(ptauPath)) {
        if (checkOnly || verifyOnly) {
            throw new Error(`Missing ${PTAU_RELATIVE_PATH}; run npm run circuits:build first.`);
        }
        createDevelopmentPtau();
    }

    if (verifyOnly) {
        const expected = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ArtifactManifest;
        verifyTrackedArtifacts(expected);
        console.log('Tracked circuit source and artifact hashes verified.');
        return;
    }

    verifyPtau();

    if (!checkOnly) {
        const circuits: Record<string, CircuitManifest> = {};
        for (const spec of CIRCUITS) {
            circuits[spec.name] = generateCircuitArtifacts(spec, path.join(circuitsRoot, spec.directory));
        }
        const manifest = buildManifest(circuits);
        fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        console.log(`Wrote ${MANIFEST_RELATIVE_PATH}`);
        return;
    }

    const expected = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ArtifactManifest;
    verifyTrackedArtifacts(expected);
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zk-ton-plonk-check-'));

    try {
        const circuits: Record<string, CircuitManifest> = {};
        for (const spec of CIRCUITS) {
            const outputDirectory = path.join(temporaryRoot, spec.directory);
            circuits[spec.name] = generateCircuitArtifacts(spec, outputDirectory);
        }
        const actual = buildManifest(circuits);
        assertEqual('artifact manifest', actual, expected);
        console.log('Circuit artifacts are byte-for-byte reproducible.');
    } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

try {
    main();
} catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
