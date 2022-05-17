jest.mock('@satumjs/x-qiankun');
import { FakeWindow, FileType, MidwareName } from '@satumjs/types';
import { createSandboxContainer, singleSpa } from '@satumjs/x-qiankun';
import qiankunSandboxMidware from '.';

describe('@satumjs/midware-qiankun-sandbox test', () => {
  test('qiankunSandboxMidware', () => {
    const configs = {} as any;
    const set = (cfgName: MidwareName, cfgValue: any) => (configs[cfgName] = cfgValue);
    const fakeSystem = { options: {}, set } as any;
    const microApps: any[] = [{ name: 'test' }, { name: 'foo' }];
    const next = jest.fn();

    qiankunSandboxMidware(fakeSystem, microApps, next);
    expect(MidwareName.Sandbox in configs).toBe(true);

    fakeSystem.options = { useQiankunStart: true, winVariable: jest.fn() };
    qiankunSandboxMidware(fakeSystem, microApps, next);
    expect(MidwareName.start in configs).toBe(true);
    configs[MidwareName.start]();
    expect(singleSpa.register).toHaveBeenCalledTimes(2);
    expect(singleSpa.start).toHaveBeenCalledTimes(1);

    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => 1234);
    const sandbox1 = new configs[MidwareName.Sandbox]();
    expect('appName' in sandbox1).toBe(true);
    expect(sandbox1.appName).toBe(undefined);
    expect(sandbox1.actorId).toBe(undefined);
    expect(sandbox1.fakeWindowName).toBe('fakeWindow1234');
    dateSpy.mockRestore();

    const sandboxConfig = { appName: 'aaa', actorId: 'aaa_bbb', fakeWindowName: 'fakewin' };
    const sandbox2 = new configs[MidwareName.Sandbox](sandboxConfig);
    expect(sandbox2.appName).toBe(sandboxConfig.appName);
    expect(sandbox2.actorId).toBe(sandboxConfig.actorId);
    expect(sandbox2.fakeWindowName).toBe(sandboxConfig.fakeWindowName);

    const childNode = {} as HTMLElement;
    const fakeBody = {
      appendChild: jest.fn() as any,
      parentNode: {
        removeChild: jest.fn() as any,
      },
      querySelector: (jest.fn() as any).mockReturnValue(childNode),
      insertBefore: jest.fn() as any,
      setAttribute: jest.fn() as any,
    } as HTMLElement;

    const fakeSandboxContainer = {
      instance: {
        proxy: {
          document: {
            createElement: (jest.fn() as any).mockReturnValue(fakeBody),
          },
        } as FakeWindow,
      },
    };

    createSandboxContainer['mockReturnValue'](fakeSandboxContainer);
    sandbox2.init().then(() => {
      const mockCreateElement = fakeSandboxContainer.instance.proxy.document.createElement as any;
      expect(sandbox2.body).toBe(fakeBody);
      expect(fakeSystem.options.winVariable).toHaveBeenCalledTimes(1);
      expect(mockCreateElement).toBeCalledTimes(2);

      const execScripts = jest.fn().mockReturnValue('aaa');
      sandbox2.extend({ execScripts, assetPublicPath: '/aaa' });
      expect(sandbox2.execScripts).toEqual(execScripts);
      expect(sandbox2.vmContext.__INJECTED_PUBLIC_PATH_BY_QIANKUN__).toBe('/aaa');

      sandbox2.destory().then(() => expect(fakeBody.parentNode?.removeChild).toHaveBeenCalled());

      const getCode1 = () => Promise.resolve();
      sandbox2.exec(getCode1).then((res: any) => expect(res).toBe('aaa'));

      const getCode2 = () => Promise.resolve([{ source: 'aaa' }, { source: 'bbb' }]);
      sandbox2.exec(getCode2, FileType.HTML).then(() => {
        expect(fakeBody.querySelector).toHaveBeenCalled();
        expect(childNode.innerHTML).toBe('aaa\nbbb');
      });

      (<any>window).embedStylesIntoTemplate = true;
      const getCode3 = () => Promise.resolve({});
      sandbox2.exec(getCode3, FileType.CSS).then(() => expect(fakeBody.querySelector).toBeCalledTimes(3));

      (<any>window).embedStylesIntoTemplate = false;
      const fakeCssFile = { file: '//www.bat.com/aaa.css', source: 'body{font-size:12px}' };
      const getCode4 = () => Promise.resolve(fakeCssFile);
      sandbox2.exec(getCode4, FileType.CSS).then(() => {
        expect(fakeBody.querySelector).toBeCalledTimes(3);
        expect(mockCreateElement).toBeCalledTimes(3);
        expect(fakeBody.innerHTML).toBe(fakeCssFile.source);
        expect(fakeBody.setAttribute).toBeCalledWith('data-url', fakeCssFile.file);
      });
    });
  });
});
