import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import codicon from "@/web/styles/codicon.css";
import { scrollableBase } from "@/web/styles/base.css";
import { sharedStyles } from "@/web/styles/shared.css";
import { hostApi } from "@/web/registrations";
import { OutdatedPackageViewModel, PackageViewModel } from "../types";
import "./package-row";

@customElement("updates-view")
export class UpdatesView extends LitElement {
  static styles = [
    codicon,
    scrollableBase,
    sharedStyles,
    css`
      :host {
        display: flex;
        flex: 1;
        width: 100%;
      }

      .updates-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        overflow: hidden;

        .outdated-row {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 4px 0 2px;
          border-bottom: 1px solid var(--vscode-panelSection-border);

          &.updating {
            opacity: 0.6;
          }

          .row-checkbox {
            flex-shrink: 0;
          }

          package-row {
            flex: 1;
            min-width: 0;
          }

          .row-actions {
            display: flex;
            align-items: center;
            flex-shrink: 0;
          }
        }
      }
    `,
  ];

  @state() packages: OutdatedPackageViewModel[] = [];
  @state() isLoading: boolean = false;
  @state() isUpdating: boolean = false;
  @state() hasError: boolean = false;
  @property({ type: Boolean }) prerelease: boolean = false;
  @state() statusText: string = "";
  @state() loadingText: string = "Checking for updates...";
  @property({ attribute: false }) projectPaths: string[] = [];
  @property() sourceUrl: string = "";

  private loaded = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.loaded) {
      this.loaded = true;
      this.LoadOutdatedPackages();
    }
  }

  async LoadOutdatedPackages(): Promise<void> {
    this.isLoading = true;
    this.hasError = false;
    this.packages = [];
    this.loadingText = "Checking for updates...";

    try {
      const result = await hostApi.getOutdatedPackages({
        Prerelease: this.prerelease,
        ProjectPaths: this.projectPaths.length > 0 ? this.projectPaths : undefined,
        SourceUrl: this.sourceUrl || undefined,
      });

      if (!result.ok) {
        this.hasError = true;
        this.statusText = "Failed to check for updates";
      } else {
        this.packages = (result.value.Packages ?? []).map(
          (p) => new OutdatedPackageViewModel(p)
        );
        this.packages.forEach((p) => (p.Selected = true));
        this.dispatchEvent(new CustomEvent<number>("count-changed", {
          detail: this.packages.length,
          bubbles: true,
          composed: true,
        }));
        this.statusText =
          this.packages.length > 0
            ? `${this.packages.length} update${this.packages.length !== 1 ? "s" : ""} available`
            : "";
      }
    } catch {
      this.hasError = true;
    } finally {
      this.isLoading = false;
    }
  }

  private async updateSingle(pkg: OutdatedPackageViewModel): Promise<void> {
    pkg.IsUpdating = true;
    this.requestUpdate();
    try {
      await hostApi.batchUpdatePackages({
        Updates: [
          {
            PackageId: pkg.Id,
            Version: pkg.LatestVersion,
            ProjectPaths: pkg.Projects.map((p) => p.Path),
          },
        ],
      });
      this.packages = this.packages.filter((p) => p.Id !== pkg.Id);
      this.dispatchEvent(new CustomEvent<number>("count-changed", {
        detail: this.packages.length,
        bubbles: true,
        composed: true,
      }));
      this.statusText =
        this.packages.length > 0
          ? `${this.packages.length} update${this.packages.length !== 1 ? "s" : ""} available`
          : "All packages are up to date";
    } finally {
      pkg.IsUpdating = false;
      this.requestUpdate();
    }
  }

  private async updateAllSelected(): Promise<void> {
    const selected = this.packages.filter((p) => p.Selected);
    if (selected.length === 0) return;

    const confirm = await hostApi.showConfirmation({
      Message: `Update ${selected.length} package${selected.length !== 1 ? "s" : ""}?`,
      Detail: selected.map((p) => `${p.Id}: ${p.InstalledVersion} -> ${p.LatestVersion}`).join("\n"),
    });
    if (!confirm.ok || !confirm.value.Confirmed) return;

    this.isUpdating = true;
    try {
      await hostApi.batchUpdatePackages({
        Updates: selected.map((p) => ({
          PackageId: p.Id,
          Version: p.LatestVersion,
          ProjectPaths: p.Projects.map((proj) => proj.Path),
        })),
      });
      await this.LoadOutdatedPackages();
    } finally {
      this.isUpdating = false;
    }
  }

  private toPackageViewModel(pkg: OutdatedPackageViewModel): PackageViewModel {
    return new PackageViewModel({
      Id: pkg.Id,
      Name: pkg.Id,
      IconUrl: "",
      Authors: [],
      Description: "",
      LicenseUrl: "",
      ProjectUrl: "",
      TotalDownloads: 0,
      Verified: false,
      Version: pkg.LatestVersion,
      InstalledVersion: pkg.InstalledVersion,
      Versions: [],
      Tags: [],
      Registration: "",
    }, "Detailed");
  }

  private renderPackageRow(pkg: OutdatedPackageViewModel): unknown {
    return html`
      <div class="outdated-row ${pkg.IsUpdating ? "updating" : ""}">
        <input
          class="row-checkbox"
          type="checkbox"
          aria-label="Select ${pkg.Id} for update"
          .checked=${pkg.Selected}
          ?disabled=${pkg.IsUpdating}
          @change=${(e: Event) => {
            pkg.Selected = (e.target as HTMLInputElement).checked;
            this.requestUpdate();
          }}
        />
        <package-row
          .package=${this.toPackageViewModel(pkg)}
          .updateVersion=${pkg.LatestVersion}
          @click=${() => this.dispatchEvent(new CustomEvent("package-selected", {
            detail: { packageId: pkg.Id, sourceUrl: pkg.SourceUrl },
            bubbles: true,
            composed: true,
          }))}
        ></package-row>
        <div class="row-actions">
          ${pkg.IsUpdating
            ? html`<span class="spinner medium" role="status" aria-label="Loading"></span>`
            : html`
                <button class="icon-btn" aria-label="Update ${pkg.Id}" title="Update ${pkg.Id}" @click=${() => this.updateSingle(pkg)}>
                  <span class="codicon codicon-arrow-circle-up"></span>
                </button>
              `}
        </div>
      </div>
    `;
  }

  render(): unknown {
    return html`
      <div class="updates-container" aria-busy=${this.isLoading}>
        <div class="toolbar">
          <button class="icon-btn" aria-label="Refresh updates" title="Refresh" @click=${() => this.LoadOutdatedPackages()}>
            <span class="codicon codicon-refresh"></span>
          </button>
          <span class="status-text" role="status" aria-live="polite">${this.statusText}</span>
          <div class="toolbar-right">
            ${this.packages.length > 0
              ? html`
                  <button class="primary-btn" ?disabled=${this.isUpdating} @click=${() => this.updateAllSelected()}>
                    Update All
                  </button>
                `
              : nothing}
          </div>
        </div>

        ${this.isLoading
          ? html`
              <div class="loading" role="status" aria-label="Loading">
                <span class="spinner large"></span>
                <span>${this.loadingText}</span>
              </div>
            `
          : nothing}
        ${!this.isLoading && this.packages.length === 0 && !this.hasError
          ? html`
              <div class="empty">
                <span class="codicon codicon-check"></span>
                All packages are up to date
              </div>
            `
          : nothing}
        ${this.hasError
          ? html`
              <div class="error" role="alert">
                <span class="codicon codicon-error"></span>
                Failed to check for updates
              </div>
            `
          : nothing}
        ${!this.isLoading && this.packages.length > 0
          ? html`
              <div class="package-list" role="list" aria-label="Outdated packages">
                ${this.packages.map((pkg) => this.renderPackageRow(pkg))}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
