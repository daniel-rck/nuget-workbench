# NuGet Workbench

A comprehensive NuGet package management extension for Visual Studio Code with vulnerability scanning, multi-project support, and version consolidation.

![VS Code](https://img.shields.io/badge/VS%20Code-1.87%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Package Management

Browse, install, update, and uninstall NuGet packages directly within VS Code. Supports batch operations across multiple projects simultaneously.

### Vulnerability Scanning

Automatically scans installed packages against known CVE databases. Color-coded severity levels (Critical, High, Medium, Low) with direct links to security advisories.

### Version Consolidation

Identifies version inconsistencies across projects in your solution and provides one-click consolidation to a target version.

### Project Tree

Checkbox-based multi-project selector with support for C#, F#, and VB.NET projects. Visual indicators for Central Package Management (CPM) enabled projects.

### Multi-Source Search

Configure multiple NuGet feeds including private feeds with credential provider support. Search across all sources or filter by specific feed.

### Central Package Management (CPM)

Full support for `Directory.Packages.props` with automatic detection, special restore handling, and version source tracking (project, central, override).

### Inline Version Decorations

Optional inline decorations in project files showing available package updates directly in the editor.

### Additional Features

- Prerelease version filtering
- Pinned version support (`[x.x.x]`)
- Status bar loading indicator
- Keyboard navigation and ARIA accessibility
- Confirmation dialogs for destructive actions
- Resizable 3-pane layout

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `NugetWorkbench.sources` | `[nuget.org]` | NuGet package sources |
| `NugetWorkbench.prerelease` | `false` | Include prerelease versions |
| `NugetWorkbench.skipRestore` | `false` | Skip restore preview and compatibility check |
| `NugetWorkbench.enablePackageVersionInlineInfo` | `false` | Show inline version decorations in project files |
| `NugetWorkbench.statusBarLoadingIndicator` | `false` | Show loading progress in status bar |
| `NugetWorkbench.logLevel` | `INFO` | Minimum logging level |

## Private Feed Authentication

Configure private NuGet feeds with authentication support. The extension reads credentials from `NuGet.config` files and supports the [Microsoft Artifacts Credential Provider](https://github.com/microsoft/artifacts-credprovider).

You can also configure a password script path per source in the extension settings for custom authentication flows.

## Credits

This extension builds upon:
- [pcislo/vscode-nuget-gallery](https://github.com/pcislo/vscode-nuget-gallery) by [Patryk Cislo](https://github.com/pcislo) (original author)
- [shis91/vscode-nuget-gallery](https://github.com/shis91/vscode-nuget-gallery) by [shis91](https://github.com/shis91) (major feature additions, CPM, authentication, test infrastructure)

## License

[MIT](LICENSE)
