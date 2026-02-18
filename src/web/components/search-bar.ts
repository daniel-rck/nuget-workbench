import { FASTElement, css, customElement, html, observable, repeat } from "@microsoft/fast-element";

import codicon from "@/web/styles/codicon.css";
import { Configuration, IMediator } from "../registrations";
import lodash from "lodash";
import { UPDATE_CONFIGURATION } from "@/common/messaging/core/commands";
import { UpdateConfigurationRequest, UpdateConfigurationResponse } from "@/common/messaging/update-configuration";

const template = html<SearchBar>`
  <div class="search-bar">
    <div class="search-bar-left">
      <vscode-text-field
        class="search-text-field"
        @input=${(x, c) => x.FilterInputEvent(c.event.target!)}
      >
        <span slot="start" class="codicon codicon-search"></span>
      </vscode-text-field>
      <vscode-button appearance="icon" @click=${(x) => x.ReloadClicked()}>
        <span class="codicon codicon-refresh"></span>
      </vscode-button>
      <vscode-checkbox
        :checked="${(x) => x.prerelase}"
        @change=${(x, c) => x.PrerelaseChangedEvent(c.event.target!)}
        >Prerelease</vscode-checkbox
      >
    </div>
    <div class="search-bar-right">
      <vscode-dropdown
        :value=${(x) => x.selectedSourceUrl}
        @change=${(x, c) => x.SelectSource((c.event.target as HTMLInputElement).value)}
      >
        <vscode-option :value="${(x) => ""}">All</vscode-option>
        ${repeat(
          (x) => x.configuration.Configuration!.Sources,
          html<Source>` <vscode-option :value="${(x) => x.Url}">${(x) => x.Name}</vscode-option> `
        )}
      </vscode-dropdown>
    </div>
  </div>
`;
const styles = css`
  .search-bar {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    margin-bottom: 10px;

    .search-bar-left {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      .search-text-field {
        flex: 1;
        max-width: 340px;
        min-width: 140px;
      }
    }
    .search-bar-right {
      display: flex;
      gap: 10px;
    }
  }
`;

export type FilterEvent = {
  Query: string;
  Prerelease: boolean;
  SourceUrl: string;
};

@customElement({
  name: "search-bar",
  template,
  styles: [codicon, styles],
})
export class SearchBar extends FASTElement {
  @Configuration configuration!: Configuration;
  @IMediator mediator!: IMediator;
  delayedPackagesLoader = lodash.debounce(() => this.EmitFilterChangedEvent(), 500);
  @observable prerelase: boolean = false;
  @observable filterQuery: string = "";
  @observable selectedSourceUrl: string = "";

  connectedCallback(): void {
    super.connectedCallback();
    this.selectedSourceUrl = "";
    // Load prerelease from configuration
    this.prerelase = this.configuration.Configuration?.Prerelease ?? false;
    this.EmitFilterChangedEvent();
  }

  async PrerelaseChangedEvent(target: EventTarget) {
    this.prerelase = (target as HTMLInputElement).checked;
    // Save to configuration
    await this.SavePrereleaseToConfiguration();
    this.EmitFilterChangedEvent();
  }

  private async SavePrereleaseToConfiguration() {
    const config = this.configuration.Configuration;
    if (!config) return;

    await this.mediator.PublishAsync<UpdateConfigurationRequest, UpdateConfigurationResponse>(
      UPDATE_CONFIGURATION,
      {
        Configuration: {
          SkipRestore: config.SkipRestore,
          EnablePackageVersionInlineInfo: config.EnablePackageVersionInlineInfo,
          Prerelease: this.prerelase,
          Sources: config.Sources,
          StatusBarLoadingIndicator: config.StatusBarLoadingIndicator,
        },
      }
    );
    await this.configuration.Reload();
  }

  FilterInputEvent(target: EventTarget) {
    this.filterQuery = (target as HTMLInputElement).value;
    this.delayedPackagesLoader();
  }

  SelectSource(url: string) {
    this.selectedSourceUrl = url;
    this.EmitFilterChangedEvent();
  }

  ReloadClicked() {
    const forceReload = true;
    this.$emit("reload-invoked", forceReload);
  }

  EmitFilterChangedEvent() {
    const filterEvent: FilterEvent = {
      Query: this.filterQuery,
      Prerelease: this.prerelase,
      SourceUrl: this.selectedSourceUrl,
    };
    this.$emit("filter-changed", filterEvent);
  }
}
