import type { URI } from "@typora-plus/base";
import type {
  IRecentService,
  ITextFileService,
  TextFileModel
} from "@typora-plus/platform";

export interface WorkbenchFileOpeningServices {
  readonly recentService: Pick<IRecentService, "addRecentFile">;
  readonly textFileService: Pick<ITextFileService, "openFile">;
}

export interface WorkbenchFileOpeningCallbacks {
  readonly clearSaveConflict?: () => void;
}

export async function openWorkbenchFile(
  services: WorkbenchFileOpeningServices,
  uri: URI,
  callbacks: WorkbenchFileOpeningCallbacks = {}
): Promise<TextFileModel> {
  callbacks.clearSaveConflict?.();
  const opened = await services.textFileService.openFile(uri);
  services.recentService.addRecentFile(opened.uri, opened.name);
  return opened;
}
