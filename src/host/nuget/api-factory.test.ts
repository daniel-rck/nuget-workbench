import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import nugetApiFactory from './api-factory';
import NuGetConfigResolver from '../utilities/nuget-config-resolver';
import PasswordScriptExecutor from '../utilities/password-script-executor';
import { Logger } from '../../common/logger';

suite('NuGetApiFactory Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let getSourcesStub: sinon.SinonStub;
    let workspaceFoldersStub: sinon.SinonStub;
    let loggerDebugStub: sinon.SinonStub;
    let clearPasswordCacheStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Clear the factory cache before each test
        nugetApiFactory.ClearCache();

        // Mock dependencies
        getSourcesStub = sandbox.stub(NuGetConfigResolver, 'GetSourcesAndDecodePasswords');
        getSourcesStub.resolves([]);

        workspaceFoldersStub = sandbox.stub(vscode.workspace, 'workspaceFolders').value([
            { uri: { fsPath: '/workspace' } }
        ]);

        loggerDebugStub = sandbox.stub(Logger, 'debug');
        
        clearPasswordCacheStub = sandbox.stub(PasswordScriptExecutor, 'ClearCache');
    });

    teardown(() => {
        sandbox.restore();
        // Clean up the factory after each test
        nugetApiFactory.ClearCache();
    });

    suite('GetSourceApi', () => {
        test('should create new API instance for new URL', async () => {
            getSourcesStub.resolves([]);

            const api = await nugetApiFactory.GetSourceApi('https://api.nuget.org/v3/index.json');

            assert.ok(api);
            assert.ok(loggerDebugStub.calledWith(sinon.match(/Creating new API instance/)));
        });

        test('should return cached API instance for same URL', async () => {
            getSourcesStub.resolves([]);

            const api1 = await nugetApiFactory.GetSourceApi('https://api.nuget.org/v3/index.json');
            const api2 = await nugetApiFactory.GetSourceApi('https://api.nuget.org/v3/index.json');

            assert.strictEqual(api1, api2, 'Should return same instance');
            assert.ok(loggerDebugStub.calledWith(sinon.match(/Returning cached API instance/)));
        });

        test('should create separate instances for different URLs', async () => {
            getSourcesStub.resolves([]);

            const api1 = await nugetApiFactory.GetSourceApi('https://api.nuget.org/v3/index.json');
            const api2 = await nugetApiFactory.GetSourceApi('https://private.nuget.org/v3/index.json');

            assert.notStrictEqual(api1, api2, 'Should be different instances');
        });

        test('should pass credentials when source has them', async () => {
            getSourcesStub.resolves([
                {
                    Name: 'Private',
                    Url: 'https://private.nuget.org',
                    Username: 'testuser',
                    Password: 'testpass'
                }
            ]);

            const api = await nugetApiFactory.GetSourceApi('https://private.nuget.org');

            assert.ok(api);
            assert.ok(loggerDebugStub.calledWith(sinon.match(/Found credentials/)));
        });

        test('should log when no credentials found', async () => {
            getSourcesStub.resolves([
                {
                    Name: 'Public',
                    Url: 'https://api.nuget.org',
                    // No username/password
                }
            ]);

            await nugetApiFactory.GetSourceApi('https://api.nuget.org');

            assert.ok(loggerDebugStub.calledWith(sinon.match(/No credentials found/)));
        });

        test('should use workspace root when available', async () => {
            workspaceFoldersStub = sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: { fsPath: '/my/workspace' } }
            ]);

            getSourcesStub.resolves([]);

            await nugetApiFactory.GetSourceApi('https://api.nuget.org');

            assert.ok(getSourcesStub.calledWith('/my/workspace'));
        });

        test('should handle undefined workspace folders', async () => {
            sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);

            getSourcesStub.resolves([]);

            const api = await nugetApiFactory.GetSourceApi('https://api.nuget.org');

            assert.ok(api);
            assert.ok(getSourcesStub.calledWith(undefined));
        });

        test('should handle empty workspace folders array', async () => {
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([]);

            getSourcesStub.resolves([]);

            const api = await nugetApiFactory.GetSourceApi('https://api.nuget.org');

            assert.ok(api);
        });

        test('should find matching source by URL', async () => {
            getSourcesStub.resolves([
                { Name: 'Source1', Url: 'https://source1.nuget.org' },
                { Name: 'Source2', Url: 'https://source2.nuget.org', Username: 'user2', Password: 'pass2' },
                { Name: 'Source3', Url: 'https://source3.nuget.org' }
            ]);

            await nugetApiFactory.GetSourceApi('https://source2.nuget.org');

            assert.ok(loggerDebugStub.calledWith(sinon.match(/Found credentials for https:\/\/source2\.nuget\.org/)));
        });

        test('should handle source with only username', async () => {
            getSourcesStub.resolves([
                {
                    Name: 'Partial',
                    Url: 'https://partial.nuget.org',
                    Username: 'onlyuser'
                    // No password
                }
            ]);

            const api = await nugetApiFactory.GetSourceApi('https://partial.nuget.org');

            assert.ok(api);
            assert.ok(loggerDebugStub.calledWith(sinon.match(/Found credentials/)));
        });

        test('should handle source with only password', async () => {
            getSourcesStub.resolves([
                {
                    Name: 'Partial',
                    Url: 'https://partial.nuget.org',
                    Password: 'onlypass'
                    // No username - unusual but possible
                }
            ]);

            const api = await nugetApiFactory.GetSourceApi('https://partial.nuget.org');

            assert.ok(api);
            // Should still log "Found credentials" since password is present
            assert.ok(loggerDebugStub.calledWith(sinon.match(/Found credentials/)));
        });
    });

    suite('ClearCache', () => {
        test('should clear all cached API instances', async () => {
            getSourcesStub.resolves([]);

            // Create some cached instances
            await nugetApiFactory.GetSourceApi('https://api1.nuget.org');
            await nugetApiFactory.GetSourceApi('https://api2.nuget.org');

            // Clear the cache
            nugetApiFactory.ClearCache();

            // Get new instances - they should be new (creating, not returning cached)
            loggerDebugStub.resetHistory();
            await nugetApiFactory.GetSourceApi('https://api1.nuget.org');

            // Should create new instance, not return cached
            assert.ok(loggerDebugStub.calledWith(sinon.match(/Creating new API instance/)));
            assert.ok(!loggerDebugStub.calledWith(sinon.match(/Returning cached/)));
        });

        test('should clear password cache', () => {
            nugetApiFactory.ClearCache();

            assert.ok(clearPasswordCacheStub.calledOnce);
        });

        test('should call ClearPackageCache on each API instance', async () => {
            getSourcesStub.resolves([]);

            // Create cached instances
            const api1 = await nugetApiFactory.GetSourceApi('https://api1.nuget.org');
            const api2 = await nugetApiFactory.GetSourceApi('https://api2.nuget.org');

            const clearCache1 = sandbox.stub(api1, 'ClearPackageCache');
            const clearCache2 = sandbox.stub(api2, 'ClearPackageCache');

            nugetApiFactory.ClearCache();

            assert.ok(clearCache1.calledOnce);
            assert.ok(clearCache2.calledOnce);
        });

        test('should handle clearing empty cache', () => {
            // Should not throw when cache is empty
            assert.doesNotThrow(() => {
                nugetApiFactory.ClearCache();
            });
        });

        test('should allow new instances after clear', async () => {
            getSourcesStub.resolves([]);

            const api1 = await nugetApiFactory.GetSourceApi('https://api.nuget.org');
            nugetApiFactory.ClearCache();
            const api2 = await nugetApiFactory.GetSourceApi('https://api.nuget.org');

            assert.notStrictEqual(api1, api2, 'Should be different instances after cache clear');
        });
    });

    suite('Integration', () => {
        test('should handle multiple URLs with mixed credentials', async () => {
            getSourcesStub.resolves([
                { Name: 'Public', Url: 'https://api.nuget.org/v3/index.json' },
                { Name: 'Private', Url: 'https://private.nuget.org', Username: 'user', Password: 'pass' }
            ]);

            const publicApi = await nugetApiFactory.GetSourceApi('https://api.nuget.org/v3/index.json');
            const privateApi = await nugetApiFactory.GetSourceApi('https://private.nuget.org');

            assert.ok(publicApi);
            assert.ok(privateApi);
            assert.notStrictEqual(publicApi, privateApi);
        });

        test('should cache per URL across multiple calls', async () => {
            getSourcesStub.resolves([]);

            // Multiple calls to same URLs
            const a1 = await nugetApiFactory.GetSourceApi('https://a.nuget.org');
            const b1 = await nugetApiFactory.GetSourceApi('https://b.nuget.org');
            const a2 = await nugetApiFactory.GetSourceApi('https://a.nuget.org');
            const b2 = await nugetApiFactory.GetSourceApi('https://b.nuget.org');
            const a3 = await nugetApiFactory.GetSourceApi('https://a.nuget.org');

            assert.strictEqual(a1, a2);
            assert.strictEqual(a2, a3);
            assert.strictEqual(b1, b2);
            assert.notStrictEqual(a1, b1);
        });
    });
});
