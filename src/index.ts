/* prettier-ignore */ import {
  ISandbox, TSandboxConfig, FileType, FakeWindow, KeyObject, AppFileSourceItem, SandboxGetCode,
  MidwareSystem, IMicroApp, NextFn, MidwareName, fakeTagName, fakeWrapTagName,
} from '@satumjs/types';
import { isFullUrl, toPromise } from '@satumjs/utils';
import { createSandboxContainer, RegisterApplicationConfig, singleSpa } from '@satumjs/x-qiankun';

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

    const { scopedCSS, useLooseSandbox, mergeWinProperty } = QiankunSandbox.options;
    const elementGetter = () => this.body;
    const sandboxContainer = createSandboxContainer(this.actorId, elementGetter, scopedCSS, useLooseSandbox);
    const fakeWin = sandboxContainer.instance.proxy as FakeWindow;
    fakeWin['microRealWindow'] = window;
    fakeWin['DRIVE_BY_SATUMMICRO'] = true;

    if (typeof mergeWinProperty === 'function') {
      mergeWinProperty(fakeWin, window);
    }

    window[this.fakeWindowName] = this._vmContext = fakeWin;
    return fakeWin;
  }

  extend(extra: KeyObject<any>) {
    const { execScripts, assetPublicPath } = extra;
    this.execScripts = execScripts;
    this.vmContext.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ = assetPublicPath || '/';
  }

  init() {
    if (!this._body) {
      const vmDocument = this.vmContext.document;
      const appBody = vmDocument.createElement(fakeTagName);
      const wrapper = vmDocument.createElement(fakeWrapTagName);
      appBody.appendChild(wrapper);
      this._body = appBody;
    }
    return Promise.resolve();
  }

  exec(getCode: SandboxGetCode, type?: FileType) {
    type = type || FileType.JS;
    const { useLooseSandbox } = QiankunSandbox.options;

    if (type === FileType.JS) {
      return toPromise(this.execScripts(this.vmContext, !useLooseSandbox));
    }

    return getCode().then((code: AppFileSourceItem[]) => {
      const codes = code ? (Array.isArray(code) ? code : [code]) : [];
      switch (type) {
        case FileType.HTML:
          const template = codes.map(({ source }) => source).join('\n');
          const wrapper = this.body.querySelector(fakeWrapTagName);
          if (wrapper) wrapper.innerHTML = template;
          break;
        case FileType.CSS:
          const embedStyles = (<any>window).embedStylesIntoTemplate;
          if (!embedStyles) {
            const wrapper = this.body.querySelector(fakeWrapTagName);
            codes.forEach(({ file, source }) => {
              if (!source) return;
              const style = this.vmContext.document.createElement('style');
              if (isFullUrl(file)) style.setAttribute('data-url', file);
              if (typeof source === 'string') {
                style.innerHTML = source;
                this.body.insertBefore(style, wrapper);
              }
            });
          }
          break;
      }
      return Promise.resolve(code);
    });
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
        singleSpa.register({ name, app, activeWhen, customProps } as RegisterApplicationConfig);
      });
      typeof urlRerouteOnly === 'undefined' ? singleSpa.start() : singleSpa.start({ urlRerouteOnly });
    });
  }
  next();
}
