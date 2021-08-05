import { importEntry } from 'import-html-entry';
import { createSandboxContainer, css } from './sandbox';
import { MidwareSystem, RealMicroApp, NextFn } from '@satumjs/types';

class QiankunSandbox {}

export default function qiankunSandboxMidware(system: MidwareSystem, _: RealMicroApp[], next: NextFn) {
  system.set('sandbox', QiankunSandbox);
  next();
}
