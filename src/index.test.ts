jest.mock('@satumjs/x-qiankun');
import { FileType } from '@satumjs/types';
import { createSandboxContainer, singleSpa } from '@satumjs/x-qiankun';
import qiankunSandboxMidware from '.';

describe('@satumjs/midware-qiankun-sandbox test', () => {
  let Sandbox: any;
  beforeEach(() => {
    const fakeSystem = { options: {}, set: jest.fn() } as any;
    const microApps: any[] = [{ name: 'foo' }, { name: 'bar' }];
    const next = jest.fn();

    qiankunSandboxMidware(fakeSystem, microApps, next);
    expect(fakeSystem.set).toBeCalled();

    Sandbox = fakeSystem.set.mock.calls[0][1];
    (createSandboxContainer as any).mockReturnValueOnce({ instance: { proxy: {} } });
  });

  test('new Sandbox', () => {
    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => 1234);
    const sandbox = new Sandbox();
    expect('appName' in sandbox).toBe(true);
    expect(sandbox.appName).toBe(undefined);
    expect(sandbox.actorId).toBe(undefined);
    expect(sandbox.fakeWindowName).toBe('fakeWindow1234');
    expect(sandbox.body).toBeUndefined();

    expect(sandbox.vmContext === window[sandbox.fakeWindowName]).toBe(true);
    expect(sandbox.vmContext['DRIVE_BY_SATUMMICRO']).toBe(true);
    dateSpy.mockRestore();
  });

  test('init/destory', () => {
    const sandbox = new Sandbox({ appName: 'foo', actorId: 'foo' });
    const appBody = { appendChild: jest.fn() } as any;
    const wrapper = {} as any;
    const createElement = jest.fn();

    sandbox.vmContext.document = { createElement };
    createElement.mockReturnValueOnce(appBody).mockReturnValueOnce(wrapper);
    sandbox.init().then(() => {
      expect(sandbox.body).toEqual(appBody);
      expect(createElement).toBeCalledTimes(2);
      appBody.parentNode = null;
      sandbox.destory().then(() => {
        appBody.parentNode = { removeChild: jest.fn() };
        sandbox.destory().then(() => expect(appBody.parentNode?.removeChild).toBeCalled());
      });
    });
  });

  test('exec simply', () => {
    const sandbox = new Sandbox({ appName: 'foo', actorId: 'foo' });

    sandbox.extend({} as any);
    const execScripts = jest.fn().mockReturnValue('bbb');
    sandbox.extend({ execScripts, assetPublicPath: '/aaa' });
    expect(sandbox.execScripts).toEqual(execScripts);
    expect(sandbox.vmContext.__INJECTED_PUBLIC_PATH_BY_QIANKUN__).toBe('/aaa');

    (<any>window).embedStylesIntoTemplate = true;
    sandbox.exec(jest.fn().mockResolvedValue('aaa'), FileType.CSS).then((res: any) => expect(res).toBe('aaa'));
    sandbox.exec(jest.fn().mockResolvedValue(''), FileType.CSS).then((res: any) => expect(res).toBe(''));
    sandbox.exec(jest.fn()).then((res: any) => {
      expect(execScripts).toBeCalled();
      expect(res).toBe('bbb');
    });
  });
});

describe('@satumjs/midware-qiankun-sandbox options test', () => {
  const fakeSystem = { options: { useQiankunStart: true } } as any;
  const microApps: any[] = [{ name: 'foo' }, { name: 'bar' }];
  const next = jest.fn();

  test('useQiankunStart', () => {
    fakeSystem.set = jest.fn();
    qiankunSandboxMidware(fakeSystem, microApps, next);
    expect(fakeSystem.set).toBeCalledTimes(2); // set sandbox & start
    const fnStart = fakeSystem.set.mock.calls[1][1];
    fnStart && fnStart();
    expect(singleSpa.register).toBeCalledTimes(2);
  });

  test('urlRerouteOnly', () => {
    fakeSystem.set = jest.fn();
    fakeSystem.options.urlRerouteOnly = true;
    qiankunSandboxMidware(fakeSystem, microApps, next);
    expect(fakeSystem.set).toBeCalledTimes(2);
    fakeSystem.set.mock.calls[1][1]();
  });

  test('mergeWinProperty', () => {
    fakeSystem.set = jest.fn();
    fakeSystem.options.mergeWinProperty = jest.fn();
    qiankunSandboxMidware(fakeSystem, microApps, next);
    const Sandbox = fakeSystem.set.mock.calls[0][1];
    const createSandbox = createSandboxContainer as any;
    createSandbox.mockReturnValueOnce({ instance: { proxy: {} } });

    const sandbox = new Sandbox();
    expect(!sandbox.vmContext).toEqual(false);
    expect(createSandbox).toBeCalled();
    expect(fakeSystem.options.mergeWinProperty).toBeCalled();
    createSandbox.mock.calls[0][1]();
  });
});

describe('@satumjs/midware-qiankun-sandbox runScript test', () => {
  let sandbox: any;
  let fakeDoc: any;
  let appBody: HTMLElement;
  let wrapper: HTMLElement;
  beforeEach(() => {
    const fakeSystem = { options: {}, set: jest.fn() } as any;
    const microApps: any[] = [{ name: 'foo' }, { name: 'bar' }];
    const next = jest.fn();
    qiankunSandboxMidware(fakeSystem, microApps, next);
    expect(fakeSystem.set).toBeCalled();

    const Sandbox = fakeSystem.set.mock.calls[0][1];
    sandbox = new Sandbox({ appName: 'foo', actorId: 'foo', fakeWindowName: 'foo' });

    fakeDoc = { createElement: jest.fn(), createTextNode: jest.fn() } as any;
    wrapper = {} as HTMLElement;
    appBody = { querySelector: jest.fn(), insertBefore: jest.fn(), setAttribute: jest.fn() } as any;
    sandbox._body = appBody;
    (createSandboxContainer as any).mockReturnValue({ instance: { proxy: { document: fakeDoc } } });
  });

  test('runScript html', (done) => {
    (appBody.querySelector as any).mockReturnValue(wrapper);
    const getHtmlCodes = () => Promise.resolve([{ source: 'aaa' }, { source: 'bbb' }]);
    sandbox.exec(getHtmlCodes as any, FileType.HTML).then(() => {
      expect(appBody.querySelector).toHaveBeenCalled();
      expect(wrapper.innerHTML).toBe('aaa\nbbb');
      done();
    });
  });

  test('runScript css', (done) => {
    (<any>window).embedStylesIntoTemplate = true;
    const getCssCode1 = () => Promise.resolve({});
    sandbox.exec(getCssCode1 as any, FileType.CSS).then(() => {
      expect(appBody.querySelector).toBeCalledTimes(0);

      (<any>window).embedStylesIntoTemplate = false;
      (appBody.querySelector as any).mockReturnValueOnce(wrapper);
      const styleNode = { appendChild: jest.fn(), setAttribute: jest.fn() } as any;
      fakeDoc.createElement.mockReturnValueOnce(styleNode);
      const fakeCssFile = { file: '//www.bat.com/aaa.css', source: 'body{font-size:12px}' };
      const getCssCode2 = () => Promise.resolve([fakeCssFile, {}]);
      sandbox.exec(getCssCode2 as any, FileType.CSS).then(() => {
        expect(appBody.querySelector).toBeCalledTimes(1);
        expect(fakeDoc.createElement).toBeCalledTimes(1);
        expect(styleNode.setAttribute).toBeCalledWith('data-url', fakeCssFile.file);
        expect(styleNode.innerHTML).toBe(fakeCssFile.source);
        done();
      });
    });
  });
});
