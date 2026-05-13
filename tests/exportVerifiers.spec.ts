import fs from 'fs';
import os from 'os';
import path from 'path';

import { buildExportJobs, parseMode, resolveVerifierInput } from '../scripts/exportVerifiers';

describe('export verifier script', () => {
    const baseDir = path.resolve('C:/repo');
    const resolveInput = (repoRoot: string, circuitName: string) =>
        path.join(repoRoot, 'circuits', circuitName, 'verification_key.json');

    it('builds FunC export jobs for every verifier', () => {
        const jobs = buildExportJobs('func', baseDir, resolveInput);

        expect(jobs).toHaveLength(5);
        expect(jobs).toEqual([
            {
                name: 'condition',
                inputPath: path.join(baseDir, 'circuits', 'condition', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'condition.fc'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'condition', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'condition.fc'),
                    '--func',
                ],
            },
            {
                name: 'fibonacci',
                inputPath: path.join(baseDir, 'circuits', 'fibonacci', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'fibonacci.fc'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'fibonacci', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'fibonacci.fc'),
                    '--func',
                ],
            },
            {
                name: 'multiply_three',
                inputPath: path.join(baseDir, 'circuits', 'multiply_three', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'multiply_three.fc'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'multiply_three', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'multiply_three.fc'),
                    '--func',
                ],
            },
            {
                name: 'Reuse',
                inputPath: path.join(baseDir, 'circuits', 'Reuse', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'Reuse.fc'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'Reuse', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'Reuse.fc'),
                    '--func',
                ],
            },
            {
                name: 'PowerABN',
                inputPath: path.join(baseDir, 'circuits', 'PowerABN', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'PowerABN.fc'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'PowerABN', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'PowerABN.fc'),
                    '--func',
                ],
            },
        ]);
    });

    it('builds Tolk export jobs for every verifier', () => {
        const jobs = buildExportJobs('tolk', baseDir, resolveInput);

        expect(jobs).toHaveLength(5);
        expect(jobs).toEqual([
            {
                name: 'condition',
                inputPath: path.join(baseDir, 'circuits', 'condition', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'condition.tolk'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'condition', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'condition.tolk'),
                ],
            },
            {
                name: 'fibonacci',
                inputPath: path.join(baseDir, 'circuits', 'fibonacci', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'fibonacci.tolk'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'fibonacci', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'fibonacci.tolk'),
                ],
            },
            {
                name: 'multiply_three',
                inputPath: path.join(baseDir, 'circuits', 'multiply_three', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'multiply_three.tolk'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'multiply_three', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'multiply_three.tolk'),
                ],
            },
            {
                name: 'Reuse',
                inputPath: path.join(baseDir, 'circuits', 'Reuse', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'Reuse.tolk'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'Reuse', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'Reuse.tolk'),
                ],
            },
            {
                name: 'PowerABN',
                inputPath: path.join(baseDir, 'circuits', 'PowerABN', 'verification_key.json'),
                outputPath: path.join(baseDir, 'contracts', 'PowerABN.tolk'),
                cliArgs: [
                    'export-ton-verifier',
                    path.join(baseDir, 'circuits', 'PowerABN', 'verification_key.json'),
                    path.join(baseDir, 'contracts', 'PowerABN.tolk'),
                ],
            },
        ]);
    });

    it('parses the requested mode', () => {
        expect(parseMode(undefined)).toBe('all');
        expect(parseMode('func')).toBe('func');
        expect(parseMode('tolk')).toBe('tolk');
        expect(() => parseMode('wat')).toThrow("Unknown mode 'wat'");
    });

    it('uses verification_key.json when it is present', () => {
        const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-verifiers-'));
        const circuitDir = path.join(repoRoot, 'circuits', 'condition');

        fs.mkdirSync(circuitDir, { recursive: true });
        fs.writeFileSync(path.join(circuitDir, 'verification_key.json'), '{}');

        expect(resolveVerifierInput(repoRoot, 'condition')).toBe(path.join(circuitDir, 'verification_key.json'));
    });

    it('falls back to zkey when json is missing', () => {
        const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'export-verifiers-'));
        const circuitDir = path.join(repoRoot, 'circuits', 'condition');

        fs.mkdirSync(circuitDir, { recursive: true });
        fs.writeFileSync(path.join(circuitDir, 'condition_0000.zkey'), '');

        expect(resolveVerifierInput(repoRoot, 'condition')).toBe(path.join(circuitDir, 'condition_0000.zkey'));
    });
});
