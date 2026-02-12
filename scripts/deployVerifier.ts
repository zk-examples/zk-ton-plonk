import { toNano } from '@ton/core';
import { Verifier } from '../wrappers/Verifier';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const verifier = provider.open(Verifier.createFromConfig({}, await compile('Verifier')));

    await verifier.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(verifier.address);

    // run methods on `verifier`
}
