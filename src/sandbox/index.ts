/**
 * @author Kuitos
 * @since 2019-04-11
 */
import type { SandBox } from '../interfaces';
import LegacySandbox from './legacy/sandbox';
import ProxySandbox from './proxySandbox';
import SnapshotSandbox from './snapshotSandbox';

export function createSandboxContainer(appName: string, useLooseSandbox?: boolean) {
  let sandbox: SandBox;
  if (window.Proxy) {
    sandbox = useLooseSandbox ? new LegacySandbox(appName) : new ProxySandbox(appName);
  } else {
    sandbox = new SnapshotSandbox(appName);
  }

  return sandbox;
}
