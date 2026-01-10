import * as assert from 'assert';
import * as sinon from 'sinon';
import HostBus from './host-bus';
import { Webview } from 'vscode';

suite('HostBus Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockWebview: {
        postMessage: sinon.SinonStub;
        onDidReceiveMessage: sinon.SinonStub;
    };

    setup(() => {
        sandbox = sinon.createSandbox();

        mockWebview = {
            postMessage: sandbox.stub().resolves(true),
            onDidReceiveMessage: sandbox.stub()
        };
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Constructor', () => {
        test('should store webview reference', () => {
            const bus = new HostBus(mockWebview as unknown as Webview);

            assert.strictEqual((bus as any)._webView, mockWebview);
        });
    });

    suite('Send', () => {
        test('should call webview.postMessage with message', () => {
            const bus = new HostBus(mockWebview as unknown as Webview);
            const message = { type: 'test', data: 'hello' };

            bus.Send(message);

            assert.ok(mockWebview.postMessage.calledOnce);
            assert.ok(mockWebview.postMessage.calledWith(message));
        });

        test('should send complex message objects', () => {
            const bus = new HostBus(mockWebview as unknown as Webview);
            const complexMessage = {
                Headers: {
                    Type: 'REQUEST',
                    Command: 'GetPackages',
                    CorrelationId: 12345
                },
                Body: {
                    Filter: 'Newtonsoft',
                    Prerelease: true,
                    Skip: 0,
                    Take: 50
                }
            };

            bus.Send(complexMessage);

            assert.ok(mockWebview.postMessage.calledWith(complexMessage));
        });

        test('should send null or undefined messages', () => {
            const bus = new HostBus(mockWebview as unknown as Webview);

            bus.Send(null);
            assert.ok(mockWebview.postMessage.calledWith(null));

            bus.Send(undefined);
            assert.ok(mockWebview.postMessage.calledWith(undefined));
        });

        test('should send multiple messages', () => {
            const bus = new HostBus(mockWebview as unknown as Webview);

            bus.Send({ msg: 1 });
            bus.Send({ msg: 2 });
            bus.Send({ msg: 3 });

            assert.strictEqual(mockWebview.postMessage.callCount, 3);
            assert.deepStrictEqual(mockWebview.postMessage.firstCall.args[0], { msg: 1 });
            assert.deepStrictEqual(mockWebview.postMessage.secondCall.args[0], { msg: 2 });
            assert.deepStrictEqual(mockWebview.postMessage.thirdCall.args[0], { msg: 3 });
        });
    });

    suite('ReceiveCallback', () => {
        test('should register callback with webview.onDidReceiveMessage', () => {
            const bus = new HostBus(mockWebview as unknown as Webview);
            const handler = sandbox.stub();
            const thisArg = { context: 'test' };

            bus.ReceiveCallback(handler, thisArg);

            assert.ok(mockWebview.onDidReceiveMessage.calledOnce);
        });

        test('should invoke handler when message received', () => {
            let registeredCallback: ((message: any) => void) | null = null;

            mockWebview.onDidReceiveMessage.callsFake((callback) => {
                registeredCallback = callback;
            });

            const bus = new HostBus(mockWebview as unknown as Webview);
            const handler = sandbox.stub();
            const thisArg = { context: 'mediator' };

            bus.ReceiveCallback(handler, thisArg);

            // Simulate receiving a message
            const testMessage = { type: 'test', payload: 'data' };
            registeredCallback!(testMessage);

            assert.ok(handler.calledOnce);
            assert.ok(handler.calledWith(testMessage));
        });

        test('should call handler with correct thisArg context', () => {
            let registeredCallback: ((message: any) => void) | null = null;

            mockWebview.onDidReceiveMessage.callsFake((callback) => {
                registeredCallback = callback;
            });

            const bus = new HostBus(mockWebview as unknown as Webview);
            
            const thisArg = {
                value: 42,
                handler(message: any) {
                    return this.value + message.num;
                }
            };

            bus.ReceiveCallback(thisArg.handler, thisArg);

            // Simulate receiving a message
            registeredCallback!({ num: 8 });

            // The handler should have been called with thisArg as context
            assert.ok(mockWebview.onDidReceiveMessage.calledOnce);
        });

        test('should handle multiple messages', () => {
            let registeredCallback: ((message: any) => void) | null = null;

            mockWebview.onDidReceiveMessage.callsFake((callback) => {
                registeredCallback = callback;
            });

            const bus = new HostBus(mockWebview as unknown as Webview);
            const handler = sandbox.stub();

            bus.ReceiveCallback(handler, {});

            // Simulate receiving multiple messages
            registeredCallback!({ id: 1 });
            registeredCallback!({ id: 2 });
            registeredCallback!({ id: 3 });

            assert.strictEqual(handler.callCount, 3);
            assert.deepStrictEqual(handler.firstCall.args[0], { id: 1 });
            assert.deepStrictEqual(handler.secondCall.args[0], { id: 2 });
            assert.deepStrictEqual(handler.thirdCall.args[0], { id: 3 });
        });

        test('should pass thisArg to onDidReceiveMessage', () => {
            const bus = new HostBus(mockWebview as unknown as Webview);
            const handler = sandbox.stub();
            const thisArg = { mediator: true };

            bus.ReceiveCallback(handler, thisArg);

            // Second argument to onDidReceiveMessage should be thisArg
            assert.strictEqual(mockWebview.onDidReceiveMessage.firstCall.args[1], thisArg);
        });
    });

    suite('Integration', () => {
        test('should work with bidirectional communication', () => {
            let registeredCallback: ((message: any) => void) | null = null;

            mockWebview.onDidReceiveMessage.callsFake((callback) => {
                registeredCallback = callback;
            });

            const bus = new HostBus(mockWebview as unknown as Webview);
            const receivedMessages: any[] = [];

            // Register receiver
            bus.ReceiveCallback((msg) => {
                receivedMessages.push(msg);
            }, null);

            // Simulate receiving messages
            registeredCallback!({ type: 'REQUEST', id: 1 });
            registeredCallback!({ type: 'REQUEST', id: 2 });

            // Send responses
            bus.Send({ type: 'RESPONSE', id: 1, result: 'ok' });
            bus.Send({ type: 'RESPONSE', id: 2, result: 'ok' });

            assert.strictEqual(receivedMessages.length, 2);
            assert.strictEqual(mockWebview.postMessage.callCount, 2);
        });
    });
});
