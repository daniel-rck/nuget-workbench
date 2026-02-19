/**
 * Mock acquireVsCodeApi() for the screenshot harness.
 * Intercepts RPC requests and responds with realistic mock data,
 * allowing the web UI to run standalone in a regular browser.
 */
(function () {
  'use strict';

  // Readiness flags — polled by Playwright waitForFunction()
  window.__mockState = {
    configDone: false,
    projectsDone: false,
    packagesDone: false,
    outdatedDone: false,
    inconsistentDone: false,
    vulnerableDone: false,
  };

  // ── Mock data ─────────────────────────────────────────────────────────────

  const PROJECTS = [
    {
      Name: 'MyApp.csproj',
      Path: '/workspace/MyApp/MyApp.csproj',
      CpmEnabled: false,
      Packages: [
        { Id: 'Newtonsoft.Json', Version: '12.0.3', IsPinned: false, VersionSource: 'project' },
        { Id: 'Serilog', Version: '2.11.0', IsPinned: false, VersionSource: 'project' },
        { Id: 'AutoMapper', Version: '11.0.1', IsPinned: false, VersionSource: 'project' },
      ],
    },
    {
      Name: 'MyApp.Tests.csproj',
      Path: '/workspace/MyApp/MyApp.Tests.csproj',
      CpmEnabled: false,
      Packages: [
        { Id: 'Newtonsoft.Json', Version: '12.0.3', IsPinned: false, VersionSource: 'project' },
        { Id: 'Microsoft.NET.Test.Sdk', Version: '17.0.0', IsPinned: false, VersionSource: 'project' },
      ],
    },
    {
      Name: 'MyApp.Core.csproj',
      Path: '/workspace/MyApp/MyApp.Core.csproj',
      CpmEnabled: false,
      Packages: [
        { Id: 'AutoMapper', Version: '11.0.1', IsPinned: false, VersionSource: 'project' },
        { Id: 'MediatR', Version: '10.0.0', IsPinned: false, VersionSource: 'project' },
        { Id: 'Microsoft.Extensions.Logging', Version: '7.0.0', IsPinned: false, VersionSource: 'project' },
      ],
    },
  ];

  const BROWSE_PACKAGES = [
    {
      Id: 'Newtonsoft.Json', Name: 'Newtonsoft.Json',
      Authors: ['James Newton-King'],
      Description: 'Json.NET is a popular high-performance JSON framework for .NET',
      IconUrl: '', LicenseUrl: 'https://licenses.nuget.org/MIT',
      ProjectUrl: 'https://www.newtonsoft.com/json', Registration: '',
      TotalDownloads: 3500000000, Verified: true,
      InstalledVersion: '', Version: '13.0.3',
      // Ascending order (oldest first) — PackageViewModel.constructor calls .reverse(),
      // so the select's first <option> ends up being the latest version
      Versions: [{ Id: '', Version: '12.0.3' }, { Id: '', Version: '13.0.1' }, { Id: '', Version: '13.0.3' }],
      Tags: ['json', 'serialization'],
    },
    {
      Id: 'Serilog', Name: 'Serilog',
      Authors: ['Serilog Contributors'],
      Description: 'Simple .NET logging with fully-structured events',
      IconUrl: '', LicenseUrl: 'https://licenses.nuget.org/Apache-2.0',
      ProjectUrl: 'https://serilog.net/', Registration: '',
      TotalDownloads: 250000000, Verified: true,
      InstalledVersion: '', Version: '3.1.1',
      Versions: [{ Id: '', Version: '2.11.0' }, { Id: '', Version: '2.12.0' }, { Id: '', Version: '3.1.1' }],
      Tags: ['logging', 'structured'],
    },
    {
      Id: 'AutoMapper', Name: 'AutoMapper',
      Authors: ['Jimmy Bogard'],
      Description: 'A convention-based object-object mapper',
      IconUrl: '', LicenseUrl: 'https://licenses.nuget.org/MIT',
      ProjectUrl: 'https://automapper.org/', Registration: '',
      TotalDownloads: 600000000, Verified: true,
      InstalledVersion: '', Version: '13.0.1',
      Versions: [{ Id: '', Version: '11.0.1' }, { Id: '', Version: '12.0.1' }, { Id: '', Version: '13.0.1' }],
      Tags: ['mapping', 'object'],
    },
    {
      Id: 'MediatR', Name: 'MediatR',
      Authors: ['Jimmy Bogard'],
      Description: 'Simple, unambiguous mediator implementation in .NET',
      IconUrl: '', LicenseUrl: 'https://licenses.nuget.org/Apache-2.0',
      ProjectUrl: 'https://github.com/jbogard/MediatR', Registration: '',
      TotalDownloads: 200000000, Verified: false,
      InstalledVersion: '', Version: '12.1.1',
      Versions: [{ Id: '', Version: '10.0.0' }, { Id: '', Version: '11.1.0' }, { Id: '', Version: '12.1.1' }],
      Tags: ['mediator', 'cqrs'],
    },
    {
      Id: 'FluentValidation', Name: 'FluentValidation',
      Authors: ['Jeremy Skinner'],
      Description: 'A validation library for .NET that uses a fluent interface to construct strongly-typed validation rules',
      IconUrl: '', LicenseUrl: 'https://licenses.nuget.org/Apache-2.0',
      ProjectUrl: 'https://fluentvalidation.net/', Registration: '',
      TotalDownloads: 350000000, Verified: false,
      InstalledVersion: '', Version: '11.9.0',
      Versions: [{ Id: '', Version: '10.4.0' }, { Id: '', Version: '11.8.0' }, { Id: '', Version: '11.9.0' }],
      Tags: ['validation', 'fluent'],
    },
    {
      Id: 'Dapper', Name: 'Dapper',
      Authors: ['Marc Gravell', 'Sam Saffron', 'Nick Craver'],
      Description: 'A simple object mapper for .NET',
      IconUrl: '', LicenseUrl: 'https://licenses.nuget.org/Apache-2.0',
      ProjectUrl: 'https://github.com/DapperLib/Dapper', Registration: '',
      TotalDownloads: 400000000, Verified: true,
      InstalledVersion: '', Version: '2.0.123',
      Versions: [{ Id: '', Version: '2.0.78' }, { Id: '', Version: '2.0.123' }],
      Tags: ['orm', 'micro-orm'],
    },
    {
      Id: 'Polly', Name: 'Polly',
      Authors: ['App-vNext'],
      Description: 'Polly is a .NET resilience and transient-fault-handling library that allows developers to express policies such as Retry, Circuit Breaker, and Timeout',
      IconUrl: '', LicenseUrl: 'https://licenses.nuget.org/BSD-3-Clause',
      ProjectUrl: 'https://github.com/App-vNext/Polly', Registration: '',
      TotalDownloads: 600000000, Verified: true,
      InstalledVersion: '', Version: '8.3.0',
      Versions: [{ Id: '', Version: '7.2.4' }, { Id: '', Version: '8.2.0' }, { Id: '', Version: '8.3.0' }],
      Tags: ['resilience', 'circuit-breaker'],
    },
    {
      Id: 'AWSSDK.S3', Name: 'AWSSDK.S3',
      Authors: ['Amazon Web Services'],
      Description: 'The Amazon Web Services SDK for .NET - Amazon Simple Storage Service',
      IconUrl: '', LicenseUrl: 'https://raw.github.com/aws/aws-sdk-net/master/LICENSE.txt',
      ProjectUrl: 'https://github.com/aws/aws-sdk-net/', Registration: '',
      TotalDownloads: 100000000, Verified: true,
      InstalledVersion: '', Version: '3.7.300',
      Versions: [{ Id: '', Version: '3.7.200' }, { Id: '', Version: '3.7.300' }],
      Tags: ['aws', 'storage', 'cloud'],
    },
  ];

  const OUTDATED_PACKAGES = [
    {
      Id: 'Newtonsoft.Json', InstalledVersion: '12.0.3', LatestVersion: '13.0.3',
      Projects: [
        { Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj', Version: '12.0.3' },
        { Name: 'MyApp.Tests.csproj', Path: '/workspace/MyApp/MyApp.Tests.csproj', Version: '12.0.3' },
      ],
      SourceUrl: 'https://api.nuget.org/v3/index.json', SourceName: 'nuget.org',
    },
    {
      Id: 'Serilog', InstalledVersion: '2.11.0', LatestVersion: '3.1.1',
      Projects: [
        { Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj', Version: '2.11.0' },
      ],
      SourceUrl: 'https://api.nuget.org/v3/index.json', SourceName: 'nuget.org',
    },
    {
      Id: 'AutoMapper', InstalledVersion: '11.0.1', LatestVersion: '13.0.1',
      Projects: [
        { Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj', Version: '11.0.1' },
        { Name: 'MyApp.Tests.csproj', Path: '/workspace/MyApp/MyApp.Tests.csproj', Version: '11.0.1' },
        { Name: 'MyApp.Core.csproj', Path: '/workspace/MyApp/MyApp.Core.csproj', Version: '11.0.1' },
      ],
      SourceUrl: 'https://api.nuget.org/v3/index.json', SourceName: 'nuget.org',
    },
  ];

  const INCONSISTENT_PACKAGES = [
    {
      Id: 'Microsoft.Extensions.Logging',
      // Latest version first — browser <select> defaults to first <option>
      // when Lit's .value binding fires before options are in the DOM
      Versions: [
        { Version: '8.0.0', Projects: [{ Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj' }] },
        { Version: '7.0.0', Projects: [{ Name: 'MyApp.Core.csproj', Path: '/workspace/MyApp/MyApp.Core.csproj' }] },
      ],
      LatestInstalledVersion: '8.0.0',
      CpmManaged: false,
    },
    {
      Id: 'AutoMapper',
      // Latest version first — same reason
      Versions: [
        { Version: '13.0.1', Projects: [{ Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj' }] },
        { Version: '11.0.1', Projects: [{ Name: 'MyApp.Tests.csproj', Path: '/workspace/MyApp/MyApp.Tests.csproj' }] },
      ],
      LatestInstalledVersion: '13.0.1',
      CpmManaged: false,
    },
  ];

  const VULNERABLE_PACKAGES = [
    {
      Id: 'System.IdentityModel.Tokens.Jwt', InstalledVersion: '6.9.0',
      Severity: 3,
      AdvisoryUrl: 'https://github.com/advisories/GHSA-59j7-ghrg-fj52',
      AffectedVersionRange: '[6.0.0, 6.11.0)',
      Projects: [{ Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj' }],
    },
    {
      Id: 'Newtonsoft.Json', InstalledVersion: '12.0.3',
      Severity: 2,
      AdvisoryUrl: 'https://github.com/advisories/GHSA-5crp-9r3c-p9vx',
      AffectedVersionRange: '[0.0.0, 13.0.1)',
      Projects: [
        { Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj' },
        { Name: 'MyApp.Tests.csproj', Path: '/workspace/MyApp/MyApp.Tests.csproj' },
      ],
    },
    {
      Id: 'Microsoft.AspNetCore.Http', InstalledVersion: '2.1.1',
      Severity: 1,
      AdvisoryUrl: 'https://github.com/advisories/GHSA-m747-6d4r-vm2j',
      AffectedVersionRange: '[2.0.0, 2.1.2)',
      Projects: [{ Name: 'MyApp.csproj', Path: '/workspace/MyApp/MyApp.csproj' }],
    },
    {
      Id: 'Dapper', InstalledVersion: '2.0.35',
      Severity: 0,
      AdvisoryUrl: 'https://github.com/advisories/GHSA-xh2p-7p87-fhgh',
      AffectedVersionRange: '[0.0.0, 2.0.78)',
      Projects: [{ Name: 'MyApp.Core.csproj', Path: '/workspace/MyApp/MyApp.Core.csproj' }],
    },
  ];

  // ── RPC dispatcher ────────────────────────────────────────────────────────

  function getMockResponse(method, params) {
    switch (method) {
      case 'getConfiguration':
        window.__mockState.configDone = true;
        return {
          ok: true,
          value: {
            Configuration: {
              SkipRestore: false,
              EnablePackageVersionInlineInfo: false,
              Prerelease: false,
              Sources: [{ Name: 'nuget.org', Url: 'https://api.nuget.org/v3/index.json' }],
              StatusBarLoadingIndicator: false,
            },
          },
        };

      case 'getProjects':
        window.__mockState.projectsDone = true;
        return { ok: true, value: { Projects: PROJECTS } };

      case 'getPackages':
        window.__mockState.packagesDone = true;
        return { ok: true, value: { Packages: BROWSE_PACKAGES } };

      case 'getPackage': {
        const found = BROWSE_PACKAGES.find(function (p) { return p.Id === params.Id; });
        const pkg = found || {
          Id: params.Id, Name: params.Id,
          Authors: [], Description: '',
          IconUrl: '', LicenseUrl: '', ProjectUrl: '', Registration: '',
          TotalDownloads: 0, Verified: false,
          InstalledVersion: '', Version: '1.0.0',
          Versions: [{ Id: '', Version: '1.0.0' }],
          Tags: [],
        };
        return { ok: true, value: { Package: pkg, SourceUrl: 'https://api.nuget.org/v3/index.json' } };
      }

      case 'getOutdatedPackages':
        window.__mockState.outdatedDone = true;
        return { ok: true, value: { Packages: OUTDATED_PACKAGES } };

      case 'getInconsistentPackages':
        window.__mockState.inconsistentDone = true;
        return { ok: true, value: { Packages: INCONSISTENT_PACKAGES } };

      case 'getVulnerablePackages':
        window.__mockState.vulnerableDone = true;
        return { ok: true, value: { Packages: VULNERABLE_PACKAGES } };

      case 'updateStatusBar':
      case 'openUrl':
      case 'showConfirmation':
        return { ok: true, value: undefined };

      default:
        console.warn('[mock-api] Unhandled RPC method:', method);
        return { ok: false, error: 'Unhandled method: ' + method };
    }
  }

  // ── acquireVsCodeApi stub ─────────────────────────────────────────────────

  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (msg) {
        if (!msg || msg.type !== 'rpc-request') return;
        // Dispatch response asynchronously to mirror real async behavior
        setTimeout(function () {
          var result = getMockResponse(msg.method, msg.params);
          window.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'rpc-response', id: msg.id, result: result },
            })
          );
        }, 30);
      },
      getState: function () { return {}; },
      setState: function () {},
    };
  };
})();
