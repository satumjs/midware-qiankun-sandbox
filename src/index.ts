import { ISandbox, MidwareSystem, RealMicroApp, NextFn, ContainerFn, FileType, AppFileSourceItem, FakeWindow, KeyObject } from '@satumjs/types';
import { createSandboxContainer } from './sandbox';

function getArray(item: any) {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

class QiankunSandbox implements ISandbox {
  readonly root: ContainerFn;
  readonly actorId: string;
  readonly execScripts: (proxy: Window, useLooseSandbox: boolean) => Promise<any>;
  private _body: HTMLElement;
  private _watcher: MutationObserver;
  private useLooseSandbox: boolean;
  vmContext: FakeWindow;

  static setExtra: () => KeyObject<any>;

  constructor(root: ContainerFn, actorId: string, extra: KeyObject<any>) {
    this.root = root;
    this.actorId = actorId;

    const { execScripts, useLooseSandbox } = extra;
    this.execScripts = execScripts;
    this.useLooseSandbox = useLooseSandbox !== undefined ? useLooseSandbox : true;
  }

  get body(): HTMLElement {
    return this._body;
  }

  get watcher(): MutationObserver {
    return this._watcher;
  }

  async init(processSpecialElement: (body: HTMLElement) => void, rootNode?: HTMLElement) {
    if (!this._body) {
      const sandboxContainer = createSandboxContainer(this.actorId, this.useLooseSandbox);
      this.vmContext = sandboxContainer.proxy as typeof window;

      const appBody = this.vmContext.document.createElement('satum-micro');
      appBody.setAttribute('data-actor-id', this.actorId);
      this._body = appBody;
    }
    if (processSpecialElement) {
      const watchRoot = rootNode || this.body;
      this._watcher = new MutationObserver(() => processSpecialElement(watchRoot));
      this.watcher.observe(watchRoot, { subtree: true, childList: true });
    }
  }

  async exec(getCode: () => Promise<AppFileSourceItem | AppFileSourceItem[]>, type?: FileType) {
    type = type || FileType.JS;
    let codes: AppFileSourceItem | AppFileSourceItem[] = [];

    if (type !== FileType.CSS) {
      const code = await getCode();
      codes = getArray(code);
    }

    switch (type) {
      case FileType.HTML:
        const template = codes.map(({ source }) => source).join('\n');
        this.body.innerHTML = template;
        break;
      case FileType.CSS:
        break;
      case FileType.JS:
        await this.execScripts(this.vmContext, !this.useLooseSandbox);
        break;
    }
  }

  async render() {
    const root = await this.root();
    if (root) root.appendChild(this.body);
  }

  destory() {
    this.body.parentNode?.removeChild(this.body);
    if (this.watcher) this.watcher.disconnect();
  }
}

export default function qiankunSandboxMidware(system: MidwareSystem, _: RealMicroApp[], next: NextFn) {
  const { useLooseSandbox } = system.options;
  QiankunSandbox.setExtra = () => ({ useLooseSandbox });
  system.set('sandbox', QiankunSandbox);
  next();
}
