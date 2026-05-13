import fs from 'node:fs';
import path from 'node:path';

import { GasLogAndSave } from './gas-logger';

describe('GasLogAndSave', () => {
    const snapshotPath = path.resolve(__dirname, '..', 'bench-snapshots', 'gas-logger-test.last.json');

    afterEach(() => {
        if (fs.existsSync(snapshotPath)) {
            fs.unlinkSync(snapshotPath);
        }
    });

    it('saves explicitly provided gas values for getter-based benchmarks', () => {
        const logger = new GasLogAndSave('gas-logger-test');

        logger.rememberGasValue('Verify', 123n);
        logger.saveCurrentRunAfterAll();

        const written = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

        expect(written).toMatchObject({
            gas: {
                Verify: 123,
            },
        });
    });
});
