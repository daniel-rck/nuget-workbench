import * as assert from 'assert';
import * as sinon from 'sinon';
import Mediator from './mediator';
import { IBus, IRequestHandler } from './types';

// Helper to create a mock bus
function createMockBus(): IBus & { messageHandler?: (message: any) => void } {
    return {
        Send: sinon.stub(),
        ReceiveCallback: sinon.stub().callsFake((handler, thisArg) => {
            // Store the handler so we can invoke it later to simulate incoming messages
            (createMockBus as any).lastHandler = handler.bind(thisArg);
        }),
        messageHandler: undefined
    };
}

// Helper to create a mock handler
function createMockHandler<REQ, RES>(response: RES): IRequestHandler<REQ, RES> & { HandleAsync: sinon.SinonStub } {
    return {
        HandleAsync: sinon.stub().resolves(response)
    };
}

suite('Mediator Tests', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Constructor', () => {
        test('should initialize with empty handlers and locks', () => {
            const bus = createMockBus();
            const mediator = new Mediator(bus);

            assert.deepStrictEqual((mediator as any)._handlers, {});
            assert.deepStrictEqual((mediator as any)._locks, {});
        });

        test('should set bus reference', () => {
            const bus = createMockBus();
            const mediator = new Mediator(bus);

            assert.strictEqual((mediator as any)._bus, bus);
        });

        test('should register receive callback on bus', () => {
            const bus = createMockBus();
            new Mediator(bus);

            assert.ok((bus.ReceiveCallback as sinon.SinonStub).calledOnce);
        });
    });

    suite('AddHandler', () => {
        test('should register handler for command', () => {
            const bus = createMockBus();
            const mediator = new Mediator(bus);
            const handler = createMockHandler({ result: 'test' });

            mediator.AddHandler('TestCommand', handler);

            assert.strictEqual((mediator as any)._handlers['TestCommand'], handler);
        });

        test('should return mediator instance for chaining', () => {
            const bus = createMockBus();
            const mediator = new Mediator(bus);
            const handler = createMockHandler({});

            const result = mediator.AddHandler('TestCommand', handler);

            assert.strictEqual(result, mediator);
        });

        test('should allow multiple handlers for different commands', () => {
            const bus = createMockBus();
            const mediator = new Mediator(bus);
            const handler1 = createMockHandler({ r: 1 });
            const handler2 = createMockHandler({ r: 2 });

            mediator
                .AddHandler('Command1', handler1)
                .AddHandler('Command2', handler2);

            assert.strictEqual((mediator as any)._handlers['Command1'], handler1);
            assert.strictEqual((mediator as any)._handlers['Command2'], handler2);
        });

        test('should overwrite handler for same command', () => {
            const bus = createMockBus();
            const mediator = new Mediator(bus);
            const handler1 = createMockHandler({ r: 1 });
            const handler2 = createMockHandler({ r: 2 });

            mediator.AddHandler('TestCommand', handler1);
            mediator.AddHandler('TestCommand', handler2);

            assert.strictEqual((mediator as any)._handlers['TestCommand'], handler2);
        });
    });

    suite('PublishAsync', () => {
        test('should send message through bus with correct structure', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);
            const request = { data: 'test-data' };

            // Start PublishAsync (it will wait for response)
            const publishPromise = mediator.PublishAsync('TestCommand', request);

            // Allow the message to be sent
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify the message was sent
            assert.ok((bus.Send as sinon.SinonStub).calledOnce);
            const sentMessage = (bus.Send as sinon.SinonStub).firstCall.args[0];

            assert.strictEqual(sentMessage.Headers.Type, 'REQUEST');
            assert.strictEqual(sentMessage.Headers.Command, 'TestCommand');
            assert.ok(typeof sentMessage.Headers.CorrelationId === 'number');
            assert.deepStrictEqual(sentMessage.Body, request);

            // Simulate response
            capturedHandler({
                Headers: {
                    Type: 'RESPONSE',
                    Command: 'TestCommand',
                    CorrelationId: sentMessage.Headers.CorrelationId
                },
                Body: { result: 'success' }
            });

            const result = await publishPromise;
            assert.deepStrictEqual(result, { result: 'success' });
        });

        test('should generate unique correlation IDs for each request', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);

            // Start two requests
            const promise1 = mediator.PublishAsync('Command1', {});
            const promise2 = mediator.PublishAsync('Command2', {});

            await new Promise(resolve => setTimeout(resolve, 10));

            const msg1 = (bus.Send as sinon.SinonStub).firstCall.args[0];
            const msg2 = (bus.Send as sinon.SinonStub).secondCall.args[0];

            assert.notStrictEqual(msg1.Headers.CorrelationId, msg2.Headers.CorrelationId);

            // Send responses
            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'Command1', CorrelationId: msg1.Headers.CorrelationId },
                Body: { r: 1 }
            });
            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'Command2', CorrelationId: msg2.Headers.CorrelationId },
                Body: { r: 2 }
            });

            const [result1, result2] = await Promise.all([promise1, promise2]);
            assert.deepStrictEqual(result1, { r: 1 });
            assert.deepStrictEqual(result2, { r: 2 });
        });

        test('should clean up lock after receiving response', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);
            const publishPromise = mediator.PublishAsync('TestCommand', {});

            await new Promise(resolve => setTimeout(resolve, 10));

            const sentMessage = (bus.Send as sinon.SinonStub).firstCall.args[0];
            const correlationId = sentMessage.Headers.CorrelationId;

            // Lock should exist before response
            assert.ok((mediator as any)._locks[correlationId]);

            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'TestCommand', CorrelationId: correlationId },
                Body: {}
            });

            await publishPromise;

            // Lock should be cleaned up after response
            assert.strictEqual((mediator as any)._locks[correlationId], undefined);
        });
    });

    suite('HandleMessage', () => {
        test('should route REQUEST messages to HandleRequest', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);
            const mockHandler = createMockHandler({ response: 'data' });
            mediator.AddHandler('TestCommand', mockHandler);

            capturedHandler({
                Headers: { Type: 'REQUEST', Command: 'TestCommand', CorrelationId: 123 },
                Body: { input: 'test' }
            });

            await new Promise(resolve => setTimeout(resolve, 10));

            assert.ok(mockHandler.HandleAsync.calledOnce);
            assert.deepStrictEqual(mockHandler.HandleAsync.firstCall.args[0], { input: 'test' });
        });

        test('should route RESPONSE messages to HandleResponse', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);

            // Start a request to create a lock
            const publishPromise = mediator.PublishAsync('TestCommand', {});
            await new Promise(resolve => setTimeout(resolve, 10));

            const sentMessage = (bus.Send as sinon.SinonStub).firstCall.args[0];

            // Send response
            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'TestCommand', CorrelationId: sentMessage.Headers.CorrelationId },
                Body: { result: 'success' }
            });

            const result = await publishPromise;
            assert.deepStrictEqual(result, { result: 'success' });
        });

        test('should throw for unknown message type', () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            new Mediator(bus);

            assert.throws(() => {
                capturedHandler({
                    Headers: { Type: 'UNKNOWN' as any, Command: 'Test', CorrelationId: 123 },
                    Body: {}
                });
            }, /Message type not recognized: UNKNOWN/);
        });
    });

    suite('HandleRequest', () => {
        test('should call handler with message body', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);
            const mockHandler = createMockHandler({ processed: true });
            mediator.AddHandler('ProcessData', mockHandler);

            capturedHandler({
                Headers: { Type: 'REQUEST', Command: 'ProcessData', CorrelationId: 456 },
                Body: { data: 'to-process' }
            });

            await new Promise(resolve => setTimeout(resolve, 10));

            assert.ok(mockHandler.HandleAsync.calledWith({ data: 'to-process' }));
        });

        test('should send response through bus with correct structure', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);
            const mockHandler = createMockHandler({ status: 'done' });
            mediator.AddHandler('DoWork', mockHandler);

            capturedHandler({
                Headers: { Type: 'REQUEST', Command: 'DoWork', CorrelationId: 789 },
                Body: {}
            });

            await new Promise(resolve => setTimeout(resolve, 10));

            // Should have sent a response
            assert.ok((bus.Send as sinon.SinonStub).calledOnce);
            const response = (bus.Send as sinon.SinonStub).firstCall.args[0];

            assert.strictEqual(response.Headers.Type, 'RESPONSE');
            assert.strictEqual(response.Headers.Command, 'DoWork');
            assert.strictEqual(response.Headers.CorrelationId, 789);
            assert.deepStrictEqual(response.Body, { status: 'done' });
        });

        test('should throw when no handler registered for command', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            new Mediator(bus);

            await assert.rejects(
                async () => {
                    await capturedHandler({
                        Headers: { Type: 'REQUEST', Command: 'UnknownCommand', CorrelationId: 123 },
                        Body: {}
                    });
                },
                /No handler registered for command: UnknownCommand/
            );
        });
    });

    suite('HandleResponse', () => {
        test('should set response on lock info', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);
            const publishPromise = mediator.PublishAsync('TestCommand', {});

            await new Promise(resolve => setTimeout(resolve, 10));

            const sentMessage = (bus.Send as sinon.SinonStub).firstCall.args[0];
            const correlationId = sentMessage.Headers.CorrelationId;

            const expectedResponse = { data: 'response-data', success: true };
            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'TestCommand', CorrelationId: correlationId },
                Body: expectedResponse
            });

            const result = await publishPromise;
            assert.deepStrictEqual(result, expectedResponse);
        });

        test('should throw when lock info not found for correlationId', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            new Mediator(bus);

            // Try to handle response without corresponding request
            await assert.rejects(
                async () => {
                    await capturedHandler({
                        Headers: { Type: 'RESPONSE', Command: 'TestCommand', CorrelationId: 99999 },
                        Body: {}
                    });
                },
                /No lock info found for correlationId: 99999/
            );
        });
    });

    suite('Integration', () => {
        test('should handle full request-response cycle', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);
            const mockHandler = createMockHandler({ calculatedValue: 42 });
            mediator.AddHandler('Calculate', mockHandler);

            // Simulate request from another side
            capturedHandler({
                Headers: { Type: 'REQUEST', Command: 'Calculate', CorrelationId: 1000 },
                Body: { input: 10 }
            });

            await new Promise(resolve => setTimeout(resolve, 10));

            // Handler should have been called
            assert.ok(mockHandler.HandleAsync.calledWith({ input: 10 }));

            // Response should have been sent back
            const response = (bus.Send as sinon.SinonStub).firstCall.args[0];
            assert.strictEqual(response.Headers.Type, 'RESPONSE');
            assert.strictEqual(response.Headers.CorrelationId, 1000);
            assert.deepStrictEqual(response.Body, { calculatedValue: 42 });
        });

        test('should handle multiple concurrent requests', async () => {
            const bus = createMockBus();
            let capturedHandler: (message: any) => void = () => {};
            (bus.ReceiveCallback as sinon.SinonStub).callsFake((handler, thisArg) => {
                capturedHandler = handler.bind(thisArg);
            });

            const mediator = new Mediator(bus);

            // Start 3 parallel requests
            const promises = [
                mediator.PublishAsync('Cmd', { n: 1 }),
                mediator.PublishAsync('Cmd', { n: 2 }),
                mediator.PublishAsync('Cmd', { n: 3 })
            ];

            await new Promise(resolve => setTimeout(resolve, 10));

            // Get all correlation IDs
            const correlationIds = (bus.Send as sinon.SinonStub).getCalls().map(
                call => call.args[0].Headers.CorrelationId
            );

            // All should be unique
            const uniqueIds = new Set(correlationIds);
            assert.strictEqual(uniqueIds.size, 3);

            // Send responses in reverse order
            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'Cmd', CorrelationId: correlationIds[2] },
                Body: { result: 3 }
            });
            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'Cmd', CorrelationId: correlationIds[0] },
                Body: { result: 1 }
            });
            capturedHandler({
                Headers: { Type: 'RESPONSE', Command: 'Cmd', CorrelationId: correlationIds[1] },
                Body: { result: 2 }
            });

            const results = await Promise.all(promises);

            // Each response should match its request
            assert.deepStrictEqual(results[0], { result: 1 });
            assert.deepStrictEqual(results[1], { result: 2 });
            assert.deepStrictEqual(results[2], { result: 3 });
        });
    });
});
