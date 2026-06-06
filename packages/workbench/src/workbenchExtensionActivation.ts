import type { ExtensionHost, TyporaPlusConfiguration } from "@typora-plus/platform";
import {
  createMermaidMarkdownRendererProvider,
  workbenchMermaidRendererId
} from "./mermaidMarkdownRenderer";
import {
  createStatusMarkdownRendererProvider,
  workbenchStatusRendererId
} from "./statusMarkdownRenderer";
import { defaultWorkbenchExtensionManifest } from "./workbenchContributions";

export const workbenchExtensionHostId = "typora-plus.workbench.extensionHost";

export interface WorkbenchExtensionHostOptions {
  readonly getConfiguration?: () => TyporaPlusConfiguration;
}

export function createWorkbenchExtensionHost(
  options: WorkbenchExtensionHostOptions = {}
): ExtensionHost {
  const getConfiguration = options.getConfiguration;

  return {
    id: workbenchExtensionHostId,
    canActivate(extension) {
      return extension.id === defaultWorkbenchExtensionManifest.id;
    },
    async activate(request) {
      if (request.extension.id !== defaultWorkbenchExtensionManifest.id) {
        throw new Error(`Workbench extension host cannot activate extension: ${request.extension.id}`);
      }

      if (request.activationEvent === `onMarkdownRenderer:${workbenchMermaidRendererId}`) {
        request.context.subscriptions.add(
          request.context.markdown.registerRendererProvider(createMermaidMarkdownRendererProvider())
        );
      }

      if (request.activationEvent === `onMarkdownRenderer:${workbenchStatusRendererId}`) {
        request.context.subscriptions.add(
          request.context.markdown.registerRendererProvider(createStatusMarkdownRendererProvider(
            getConfiguration
              ? { getStatusBadges: () => getConfiguration().markdown.statusBadges }
              : undefined
          ))
        );
      }
    }
  };
}
