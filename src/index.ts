import {
  ISandbox,
  TSandboxConfig,
  FileType,
  FakeWindow,
  KeyObject,
  fakeTagName,
  fakeWrapTagName,
  AppFileSourceItem,
  SandboxGetCode,
  MidwareSystem,
  IMicroApp,
  NextFn,
  MidwareName,
} from '@satumjs/types';
import { createSandboxContainer } from 'qiankun/es/sandbox';
import { registerApplication, start as startSingleSpa, RegisterApplicationConfig } from 'single-spa';

class QiankunSandbox implements ISandbox {
  static microApps: IMicroApp[];
  static options: KeyObject<any>;

  readonly appName: TSandboxConfig['appName'];
  private readonly fakeWindowName: string;
  private _body: ISandbox['body'];
  private _vmContext: ISandbox['vmContext'];
  private execScripts: (proxy: Window, useLooseSandbox: boolean) => Promise<any>;
  actorId: TSandboxConfig['actorId'];
  setVariable: ISandbox['setVariable'];

  constructor(config: TSandboxConfig) {
    const { appName, actorId, fakeWindowName } = config || {};

    this.appName = appName;
    this.actorId = actorId;
    this.fakeWindowName = fakeWindowName || `fakeWindow${Date.now()}`;
  }

  get body(): HTMLElement {
    return this._body;
  }

  get vmContext() {
    if (this._vmContext) return this._vmContext;

    const { scopedCSS, useLooseSandbox, setValueIntoWin } = QiankunSandbox.options;
    const elementGetter = () => this.body;
    const sandboxContainer = createSandboxContainer(this.actorId, elementGetter, scopedCSS, useLooseSandbox);
    const fakeWin = sandboxContainer.instance.proxy as FakeWindow;
    fakeWin['microRealWindow'] = window;
    fakeWin['__POWERED_BY_QIANKUN__'] = true;
    fakeWin['DRIVE_BY_MICROF2E'] = true;

    if (typeof setValueIntoWin === 'function') {
      setValueIntoWin(fakeWin);
    }

    this._vmContext = fakeWin;
    return fakeWin;
  }

  extend(extra: KeyObject<any>) {
    const { execScripts, assetPublicPath } = extra;
    this.execScripts = execScripts;
    this.vmContext.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ = assetPublicPath || '/';
  }

  init() {
    if (!this._body) {
      const appBody = this.vmContext.document.createElement(fakeTagName);
      const wrapper = document.createElement(fakeWrapTagName);
      appBody.appendChild(wrapper);
      this._body = appBody;
    }
    return Promise.resolve();
  }

  exec(getCode: SandboxGetCode, type?: FileType) {
    type = type || FileType.JS;
    const { useLooseSandbox } = QiankunSandbox.options;

    if (type !== FileType.CSS) {
      return getCode().then((code: AppFileSourceItem[]) => {
        const codes = code ? (Array.isArray(code) ? code : [code]) : [];
        let result;
        switch (type) {
          case FileType.HTML:
            const template = codes.map(({ source }) => source).join('\n');
            if (this.body.firstChild) (this.body.firstChild as HTMLElement).innerHTML = template;
            break;
          case FileType.CSS:
            break;
          case FileType.JS:
            result = this.execScripts(this.vmContext, !useLooseSandbox);
            break;
        }
        return Promise.resolve(result);
      });
    }
    return Promise.resolve();
  }

  remove() {
    this.body.parentNode?.removeChild(this.body);
    return Promise.resolve();
  }
  destory() {
    return this.remove();
  }
}

export default function qiankunSandboxMidware(system: MidwareSystem, microApps: IMicroApp[], next: NextFn) {
  const { useQiankunStart, urlRerouteOnly } = system.options;
  QiankunSandbox.microApps = microApps;
  QiankunSandbox.options = system.options;

  system.set(MidwareName.Sandbox, QiankunSandbox);
  if (useQiankunStart) {
    system.set(MidwareName.start, () => {
      microApps.forEach(({ name, app, activeWhen, customProps }) => {
        registerApplication({ name, app, activeWhen, customProps } as RegisterApplicationConfig);
      });
      typeof urlRerouteOnly === 'undefined' ? startSingleSpa() : startSingleSpa({ urlRerouteOnly });
    });
  }
  next();
}
