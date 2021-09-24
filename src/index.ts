import {
  ISandbox,
  MidwareSystem,
  RealMicroApp,
  NextFn,
  ContainerFn,
  FileType,
  AppFileSourceItem,
  FakeWindow,
  KeyObject,
  fakeBodyTag,
  SandboxGetCode,
} from '@satumjs/types';
import { createSandboxContainer } from 'qiankun/es/sandbox';
import { registerApplication, start as startSingleSpa, RegisterApplicationConfig } from 'single-spa';

function getArray(item: any) {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

class QiankunSandbox implements ISandbox {
  readonly actorId: string;
  private _body: HTMLElement;
  private useLooseSandbox: boolean;
  private scopedCSS: boolean;
  private execScripts: (proxy: Window, useLooseSandbox: boolean) => Promise<any>;
  vmContext: FakeWindow;

  static setExtra: () => KeyObject<any>;

  constructor(actorIds: string[], extra: KeyObject<any>) {
    let [oldActorId, actorId] = actorIds;
    actorId = actorId || oldActorId;
    this.actorId = actorId;

    const { useLooseSandbox, scopedCSS, vmContext } = extra || {};
    this.useLooseSandbox = !!useLooseSandbox;
    this.scopedCSS = !!scopedCSS;

    if (vmContext) {
      this.vmContext = vmContext;
    } else {
      const elementGetter = () => this.body;
      const sandboxContainer = createSandboxContainer(this.actorId, elementGetter, this.scopedCSS, this.useLooseSandbox);
      this.vmContext = sandboxContainer.instance.proxy as typeof window;
      this.vmContext.__POWERED_BY_QIANKUN__ = true;
    }
  }

  get body(): HTMLElement {
    return this._body;
  }

  extend(extra: KeyObject<any>) {
    const { execScripts, assetPublicPath } = extra;
    this.execScripts = execScripts;
    this.vmContext.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ = assetPublicPath || '/';
  }

  clone(actorId: string) {
    const { useLooseSandbox, scopedCSS, actorId: oldActorId, vmContext } = this;
    return new QiankunSandbox([oldActorId, actorId], { useLooseSandbox, scopedCSS, vmContext });
  }

  async init() {
    if (!this._body) {
      const appBody = this.vmContext.document.createElement(fakeBodyTag);
      appBody.setAttribute('data-actor-id', this.actorId);
      this._body = appBody;
    }
  }

  async exec(getCode: SandboxGetCode, type?: FileType) {
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

  async prerender(root: ContainerFn) {
    const rootNode = await root();
    if (rootNode) rootNode.appendChild(this.body);
  }

  async destory() {
    this.body.parentNode?.removeChild(this.body);
  }
}

export default function qiankunSandboxMidware(system: MidwareSystem, microApps: RealMicroApp[], next: NextFn) {
  const { useQiankunStart, useLooseSandbox, scopedCSS } = system.options;
  QiankunSandbox.setExtra = () => ({ useLooseSandbox, scopedCSS });
  system.set('Sandbox', QiankunSandbox);
  if (useQiankunStart) {
    microApps.forEach(({ name, app, activeWhen, customProps }) => {
      registerApplication({ name, app, activeWhen, customProps } as RegisterApplicationConfig);
    });
    system.set('start', startSingleSpa);
  }
  next();
}
