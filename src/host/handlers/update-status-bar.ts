import { IRequestHandler } from "@/common/messaging/core/types";
import { UpdateStatusBarRequest, UpdateStatusBarResponse } from "@/common/messaging/update-status-bar";
import StatusBarUtils from "../utilities/status-bar-utils";

export class UpdateStatusBar implements IRequestHandler<UpdateStatusBarRequest, UpdateStatusBarResponse> {
  async HandleAsync(request: UpdateStatusBarRequest): Promise<UpdateStatusBarResponse> {
    if (request.Percentage === null) {
      StatusBarUtils.hide();
    } else {
      StatusBarUtils.show(request.Percentage, request.Message);
    }
    return {};
  }
}
