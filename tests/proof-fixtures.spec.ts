import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { proofFixtureSpecs } from '../scripts/proofFixtures';

describe('tracked PLONK proof fixtures', () => {
    it('covers every runtime circuit and verifies each proof with its tracked verification key', async () => {
        expect(proofFixtureSpecs.map((fixture) => fixture.id)).toEqual([
            'condition-cond-1',
            'condition-cond-0',
            'fibonacci-default',
            'multiply-three-default',
            'power-abn-default',
            'reuse-default',
        ]);

        const result = spawnSync(
            process.execPath,
            [path.join(__dirname, '../node_modules/ts-node/dist/bin.js'), 'scripts/proofFixtures.ts', '--verify'],
            { cwd: path.join(__dirname, '..'), encoding: 'utf8' },
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('Tampered PLONK proof rejected by snarkjs.');
        expect(result.stdout).toContain('Tracked PLONK proof fixtures verified.');
        expect(result.stderr).toBe('');
    });
});
