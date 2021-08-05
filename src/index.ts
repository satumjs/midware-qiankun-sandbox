import { ISandbox, MidwareSystem, RealMicroApp, NextFn, ContainerFn, FileType, FnWithArg, FnWithArgs, FnWithoutArg } from '@satumjs/types';
import { createSandboxContainer } from './sandbox';

function getArray(item: any) {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

class QiankunSandbox implements ISandbox {
  readonly root: ContainerFn;
  readonly actorId: string;
  readonly execScripts: FnWithArgs<any>;
  private _body: HTMLElement;
  private _watcher: MutationObserver;

  constructor(root: ContainerFn, actorId: string, execScripts: FnWithArgs<any>) {
    this.root = root;
    this.actorId = actorId;
    this.execScripts = execScripts;
  }

  get body(): HTMLElement {
    return this._body;
  }

  get watcher(): MutationObserver {
    return this._watcher;
  }

  async exec(getCode: FnWithoutArg<Promise<string | string[]>>, type?: FileType) {
    type = type || FileType.JS;
    const useLooseSandbox = true;
    let global = window;
    let sandboxContainer;

    if (!this._body) {
      const appBody = document.createElement('satum-micro');
      appBody.setAttribute('data-actor-id', this.actorId);
      this._body = appBody;
    }

    sandboxContainer = createSandboxContainer(this.actorId, useLooseSandbox);
    global = sandboxContainer.proxy as typeof window;

    switch (type) {
      case FileType.HTML:
        const code = await getCode();
        const codes = getArray(code);
        console.log(this.body.innerHTML);
        this.body.innerHTML = codes.join('\n');
        break;
      case FileType.CSS:
        break;
      case FileType.JS:
        const scriptExports: any = await this.execScripts(global, !useLooseSandbox);
        console.log('----------', scriptExports);
        break;
    }
  }

  watch(rootNode: HTMLElement, processSpecialElement?: FnWithArg<void, HTMLElement>) {
    if (!processSpecialElement) return;
    this._watcher = new MutationObserver(() => processSpecialElement(this.body));
    this.watcher.observe(rootNode, { subtree: true, childList: true });
  }

  destory() {
    this.body.parentNode?.removeChild(this.body);
    if (this.watcher) this.watcher.disconnect();
  }

  async render(processSpecialElement?: FnWithArg<void, HTMLElement>) {
    const root = await this.root();
    if (root) {
      this.watch(root, processSpecialElement);
      root.appendChild(this.body);
    }
  }
}

export default function qiankunSandboxMidware(system: MidwareSystem, _: RealMicroApp[], next: NextFn) {
  system.set('sandbox', QiankunSandbox);
  next();
}
