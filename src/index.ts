import { ISandbox, MidwareSystem, RealMicroApp, NextFn } from '@satumjs/types';
import { importEntry } from 'import-html-entry';
import { createSandboxContainer, css } from './sandbox';

class QiankunSandbox implements ISandbox {}

export default function qiankunSandboxMidware(system: MidwareSystem, _: RealMicroApp[], next: NextFn) {
  system.set('sandbox', QiankunSandbox);
  next();
}
