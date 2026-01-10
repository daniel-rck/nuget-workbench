import * as assert from 'assert';
import * as sinon from 'sinon';
import { UpdateStatusBar } from './update-status-bar';
import StatusBarUtils from '../utilities/status-bar-utils';

suite('UpdateStatusBar Handler Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let handler: UpdateStatusBar;
    let showStub: sinon.SinonStub;
    let hideStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        handler = new UpdateStatusBar();

        // Mock StatusBarUtils
        showStub = sandbox.stub(StatusBarUtils, 'show');
        hideStub = sandbox.stub(StatusBarUtils, 'hide');
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Show Status Bar', () => {
        test('should call StatusBarUtils.show with percentage only', async () => {
            const request = {
                Percentage: 50
            };

            const result = await handler.HandleAsync(request);

            assert.ok(showStub.calledOnce);
            assert.ok(showStub.calledWith(50, undefined));
            assert.ok(hideStub.notCalled);
            assert.deepStrictEqual(result, {});
        });

        test('should call StatusBarUtils.show with percentage and message', async () => {
            const request = {
                Percentage: 75,
                Message: 'Loading packages...'
            };

            const result = await handler.HandleAsync(request);

            assert.ok(showStub.calledOnce);
            assert.ok(showStub.calledWith(75, 'Loading packages...'));
            assert.ok(hideStub.notCalled);
            assert.deepStrictEqual(result, {});
        });

        test('should call StatusBarUtils.show with 0 percentage', async () => {
            const request = {
                Percentage: 0,
                Message: 'Starting...'
            };

            await handler.HandleAsync(request);

            assert.ok(showStub.calledOnce);
            assert.ok(showStub.calledWith(0, 'Starting...'));
            assert.ok(hideStub.notCalled);
        });

        test('should call StatusBarUtils.show with 100 percentage', async () => {
            const request = {
                Percentage: 100,
                Message: 'Complete'
            };

            await handler.HandleAsync(request);

            assert.ok(showStub.calledOnce);
            assert.ok(showStub.calledWith(100, 'Complete'));
        });
    });

    suite('Hide Status Bar', () => {
        test('should call StatusBarUtils.hide when Percentage is null', async () => {
            const request = {
                Percentage: null
            };

            const result = await handler.HandleAsync(request);

            assert.ok(hideStub.calledOnce);
            assert.ok(showStub.notCalled);
            assert.deepStrictEqual(result, {});
        });

        test('should call StatusBarUtils.hide when Percentage is null even with message', async () => {
            const request = {
                Percentage: null,
                Message: 'This message should be ignored'
            };

            await handler.HandleAsync(request);

            assert.ok(hideStub.calledOnce);
            assert.ok(showStub.notCalled);
        });
    });

    suite('Return Value', () => {
        test('should return empty object for show operation', async () => {
            const request = {
                Percentage: 50,
                Message: 'Test'
            };

            const result = await handler.HandleAsync(request);

            assert.deepStrictEqual(result, {});
        });

        test('should return empty object for hide operation', async () => {
            const request = {
                Percentage: null
            };

            const result = await handler.HandleAsync(request);

            assert.deepStrictEqual(result, {});
        });
    });
});
