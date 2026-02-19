import * as vscode from "vscode";
import NuGetApi from "../nuget/api";
import NuGetConfigResolver from "../utilities/nuget-config-resolver";
import PasswordScriptExecutor from "../utilities/password-script-executor";
import { Logger } from "../../common/logger";

type SourceApiCollection = {
  [url: string]: NuGetApi;
};

class NuGetApiFactory {
  private readonly _sourceApiCollection: SourceApiCollection = {};

  public async GetSourceApi(url: string): Promise<NuGetApi> {
    if (!(url in this._sourceApiCollection)) {
      Logger.debug(`NuGetApiFactory.GetSourceApi: Creating new API instance for ${url}`);
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;
      const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(workspaceRoot);

      Logger.debug(`NuGetApiFactory.GetSourceApi: Available sources: ${sources.map(s => `${s.Name}=${s.Url} (hasAuth=${!!s.Username || !!s.Password})`).join(", ")}`);

      // Match by URL with/without trailing slash normalization
      const normalizeUrl = (u: string) => u.replace(/\/+$/, "").toLowerCase();
      const sourceWithCreds = sources.find(s => normalizeUrl(s.Url) === normalizeUrl(url));

      const hasAuth = !!(sourceWithCreds?.Username || sourceWithCreds?.Password);
      if (hasAuth) {
        Logger.info(`NuGetApiFactory.GetSourceApi: Using credentials for ${url} (user: ${sourceWithCreds?.Username})`);
      } else {
        Logger.warn(`NuGetApiFactory.GetSourceApi: No credentials found for ${url}. Available source URLs: [${sources.map(s => s.Url).join(", ")}]`);
      }

      this._sourceApiCollection[url] = new NuGetApi(url, sourceWithCreds?.Username, sourceWithCreds?.Password);
    } else {
      Logger.debug(`NuGetApiFactory.GetSourceApi: Returning cached API instance for ${url}`);
    }

    return this._sourceApiCollection[url];
  }

  public ClearCache() {
    for (const key in this._sourceApiCollection) {
      this._sourceApiCollection[key].ClearPackageCache();
      delete this._sourceApiCollection[key];
    }
    PasswordScriptExecutor.ClearCache();
  }
}

export default new NuGetApiFactory();
