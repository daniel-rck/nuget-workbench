import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import StatusBarUtils from './status-bar-utils';

suite('StatusBarUtils Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let getConfigurationStub: sinon.SinonStub;
    let createStatusBarItemStub: sinon.SinonStub;
    let mockStatusBarItem: {
        text: string;
        show: sinon.SinonStub;
        hide: sinon.SinonStub;
    };

    setup(() => {
        sandbox = sinon.createSandbox();

        // Reset the static _item to undefined before each test
        (StatusBarUtils as any)._item = undefined;

        // Mock status bar item
        mockStatusBarItem = {
            text: '',
            show: sandbox.stub(),
            hide: sandbox.stub()
        };

        createStatusBarItemStub = sandbox.stub(vscode.window, 'createStatusBarItem').returns(mockStatusBarItem as any);
    });

    teardown(() => {
        sandbox.restore();
        // Clean up the static state
        (StatusBarUtils as any)._item = undefined;
    });

    function mockConfig(statusBarLoadingIndicator: boolean) {
        getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'statusBarLoadingIndicator') {
                    return statusBarLoadingIndicator;
                }
                return undefined;
            })
        } as any);
    }

    suite('show()', () => {
        test('should create and show status bar item with percentage', () => {
            mockConfig(true);

            StatusBarUtils.show(50);

            assert.ok(createStatusBarItemStub.calledOnce);
            assert.ok(createStatusBarItemStub.calledWith(vscode.StatusBarAlignment.Left, 100));
            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: 50%');
            assert.ok(mockStatusBarItem.show.calledOnce);
        });

        test('should show status bar with percentage and message', () => {
            mockConfig(true);

            StatusBarUtils.show(75, 'Loading packages...');

            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: 75% - Loading packages...');
            assert.ok(mockStatusBarItem.show.calledOnce);
        });

        test('should round percentage to nearest integer', () => {
            mockConfig(true);

            StatusBarUtils.show(33.7);

            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: 34%');
        });

        test('should handle 0 percentage', () => {
            mockConfig(true);

            StatusBarUtils.show(0, 'Starting');

            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: 0% - Starting');
        });

        test('should handle 100 percentage', () => {
            mockConfig(true);

            StatusBarUtils.show(100, 'Complete');

            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: 100% - Complete');
        });

        test('should not show if statusBarLoadingIndicator is disabled', () => {
            mockConfig(false);

            StatusBarUtils.show(50, 'Test');

            assert.ok(createStatusBarItemStub.notCalled);
            assert.ok(mockStatusBarItem.show.notCalled);
        });

        test('should reuse existing status bar item on subsequent calls', () => {
            mockConfig(true);

            StatusBarUtils.show(25, 'First');
            StatusBarUtils.show(50, 'Second');

            assert.ok(createStatusBarItemStub.calledOnce, 'Should only create item once');
            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: 50% - Second');
            assert.ok(mockStatusBarItem.show.calledTwice);
        });
    });

    suite('ShowText()', () => {
        test('should create and show status bar item with text message', () => {
            mockConfig(true);

            StatusBarUtils.ShowText('Custom message');

            assert.ok(createStatusBarItemStub.calledOnce);
            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: Custom message');
            assert.ok(mockStatusBarItem.show.calledOnce);
        });

        test('should not show if statusBarLoadingIndicator is disabled', () => {
            mockConfig(false);

            StatusBarUtils.ShowText('Test message');

            assert.ok(createStatusBarItemStub.notCalled);
            assert.ok(mockStatusBarItem.show.notCalled);
        });

        test('should reuse existing status bar item', () => {
            mockConfig(true);

            StatusBarUtils.ShowText('First');
            StatusBarUtils.ShowText('Second');

            assert.ok(createStatusBarItemStub.calledOnce);
            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: Second');
        });
    });

    suite('hide()', () => {
        test('should hide existing status bar item', () => {
            mockConfig(true);

            // First show to create the item
            StatusBarUtils.show(50);
            
            // Then hide
            StatusBarUtils.hide();

            assert.ok(mockStatusBarItem.hide.calledOnce);
        });

        test('should not throw if status bar item does not exist', () => {
            // Should not throw even if _item is undefined
            assert.doesNotThrow(() => {
                StatusBarUtils.hide();
            });
        });

        test('should not call hide on undefined item', () => {
            StatusBarUtils.hide();

            // mockStatusBarItem.hide should not be called since no item was created
            assert.ok(mockStatusBarItem.hide.notCalled);
        });
    });

    suite('Integration scenarios', () => {
        test('should support show -> hide -> show workflow', () => {
            mockConfig(true);

            StatusBarUtils.show(25, 'Loading...');
            assert.ok(mockStatusBarItem.show.calledOnce);

            StatusBarUtils.hide();
            assert.ok(mockStatusBarItem.hide.calledOnce);

            StatusBarUtils.show(100, 'Done');
            assert.ok(mockStatusBarItem.show.calledTwice);
            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: 100% - Done');
        });

        test('should support show -> ShowText workflow', () => {
            mockConfig(true);

            StatusBarUtils.show(50, 'Progress');
            StatusBarUtils.ShowText('Custom status');

            assert.ok(createStatusBarItemStub.calledOnce);
            assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) NuGet: Custom status');
        });
    });
});
