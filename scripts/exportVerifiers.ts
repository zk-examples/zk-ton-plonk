import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const verifierNames = ['condition', 'fibonacci', 'multiply_three', 'Reuse', 'PowerABN'] as const;

export type ExportMode = 'all' | 'func' | 'tolk';

export interface ExportJob {
    name: (typeof verifierNames)[number];
    inputPath: string;
    outputPath: string;
    cliArgs: string[];
}

type InputResolver = (repoRoot: string, circuitName: ExportJob['name']) => string;

export function parseMode(modeArg?: string): ExportMode {
    if (!modeArg || modeArg === 'all') {
        return 'all';
    }

    if (modeArg === 'func' || modeArg === 'tolk') {
        return modeArg;
    }

    throw new Error(`Unknown mode '${modeArg}'. Use one of: all, func, tolk.`);
}

export function resolveVerifierInput(repoRoot: string, circuitName: ExportJob['name']): string {
    const circuitDir = path.join(repoRoot, 'circuits', circuitName);
    const zkeyPath = path.join(circuitDir, `${circuitName}_0000.zkey`);
    const verificationKeyPath = path.join(circuitDir, 'verification_key.json');

    if (fs.existsSync(verificationKeyPath)) {
        return verificationKeyPath;
    }

    if (fs.existsSync(zkeyPath)) {
        return zkeyPath;
    }

    throw new Error(
        [
            `Missing verifier input for '${circuitName}'.`,
            `Expected one of:`,
            `  - ${verificationKeyPath}`,
            `  - ${zkeyPath}`,
        ].join('\n'),
    );
}

export function buildExportJobs(
    mode: Exclude<ExportMode, 'all'>,
    repoRoot: string = process.cwd(),
    inputResolver: InputResolver = resolveVerifierInput,
): ExportJob[] {
    return verifierNames.map((name) => {
        const inputPath = inputResolver(repoRoot, name);
        const extension = mode === 'func' ? 'fc' : 'tolk';
        const outputPath = path.join(repoRoot, 'contracts', `${name}.${extension}`);
        const cliArgs = ['export-ton-verifier', inputPath, outputPath];

        if (mode === 'func') {
            cliArgs.push('--func');
        }

        return {
            name,
            inputPath,
            outputPath,
            cliArgs,
        };
    });
}

export function runExportJobs(jobs: ExportJob[], repoRoot: string = process.cwd()) {
    const packageEntryPath = require.resolve('export-ton-verifier');
    const packageRoot = path.dirname(path.dirname(packageEntryPath));
    const cliPath = path.join(packageRoot, 'dist', 'cli.js');

    for (const job of jobs) {
        console.log(`[${job.name}] ${path.relative(repoRoot, job.outputPath)}`);

        const result = spawnSync(process.execPath, [cliPath, ...job.cliArgs.slice(1)], {
            cwd: repoRoot,
            stdio: 'inherit',
        });

        if (result.error) {
            throw new Error(`Failed to start export for '${job.name}': ${result.error.message}`);
        }

        if (result.status !== 0) {
            throw new Error(`Failed to export verifier '${job.name}' to ${job.outputPath}.`);
        }
    }
}

export function main(modeArg?: string) {
    const repoRoot = process.cwd();
    const mode = parseMode(modeArg);
    const jobs =
        mode === 'all'
            ? [...buildExportJobs('func', repoRoot), ...buildExportJobs('tolk', repoRoot)]
            : buildExportJobs(mode, repoRoot);

    runExportJobs(jobs, repoRoot);
}

if (require.main === module) {
    try {
        main(process.argv[2]);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
