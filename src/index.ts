import { ISandbox, MidwareSystem, RealMicroApp, NextFn, ContainerFn, FileType, AppFileSourceItem, FakeWindow, KeyObject } from '@satumjs/types';
import { createSandboxContainer } from 'qiankun/es/sandbox';

function getArray(item: any) {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

class QiankunSandbox implements ISandbox {
  readonly root: ContainerFn;
  readonly actorId: string;
  private _body: HTMLElement;
  private useLooseSandbox: boolean;
  private scopedCSS: boolean;
  private execScripts: (proxy: Window, useLooseSandbox: boolean) => Promise<any>;
  vmContext: FakeWindow;

  static setExtra: () => KeyObject<any>;

  constructor(root: ContainerFn, actorId: string, extra: KeyObject<any>) {
    this.root = root;
    this.actorId = actorId;

    const { useLooseSandbox, scopedCSS } = extra;
    this.useLooseSandbox = !!useLooseSandbox;
    this.scopedCSS = !!scopedCSS;
  }

  get body(): HTMLElement {
    return this._body;
  }

  extend(extra: KeyObject<any>) {
    const { execScripts } = extra;
    this.execScripts = execScripts;
  }

  async init() {
    if (!this._body) {
      const elementGetter = () => this.body;
      const sandboxContainer = createSandboxContainer(this.actorId, elementGetter, this.scopedCSS, this.useLooseSandbox);
      this.vmContext = sandboxContainer.instance.proxy as typeof window;

      const appBody = this.vmContext.document.createElement('satum-micro');
      appBody.setAttribute('data-actor-id', this.actorId);
      this._body = appBody;
    }
  }

  async exec(getCode: () => Promise<AppFileSourceItem | AppFileSourceItem[]>, type?: FileType) {
    type = type || FileType.JS;
    let codes: AppFileSourceItem | AppFileSourceItem[] = [];

    if (type !== FileType.CSS) {
      const code = await getCode();
      codes = getArray(code);
    }

    if (type === FileType.HTML) {
      const template = codes.map(({ source }) => source).join('\n');
      this.body.innerHTML = template;
    } else if (type === FileType.JS) {
      return await this.execScripts(this.vmContext, this.useLooseSandbox);
    }
  }

  async destory() {
    this.body.parentNode?.removeChild(this.body);
  }
}

export default function qiankunSandboxMidware(system: MidwareSystem, _: RealMicroApp[], next: NextFn) {
  const { useLooseSandbox, scopedCSS } = system.options;
  QiankunSandbox.setExtra = () => ({ useLooseSandbox, scopedCSS });
  system.set('Sandbox', QiankunSandbox);
  next();
}
