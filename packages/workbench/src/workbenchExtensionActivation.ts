import type { ExtensionActivationHandler } from "@typora-plus/platform";
import {
  createMermaidMarkdownRendererProvider,
  workbenchMermaidRendererId
} from "./mermaidMarkdownRenderer";
import {
  createStatusMarkdownRendererProvider,
  workbenchStatusRendererId
} from "./statusMarkdownRenderer";
import { defaultWorkbenchExtensionManifest } from "./workbenchContributions";

export function createWorkbenchExtensionActivationHandler(): ExtensionActivationHandler {
  return async (request) => {
    if (request.extension.id !== defaultWorkbenchExtensionManifest.id) {
      throw new Error(`No Workbench activation runtime registered for extension: ${request.extension.id}`);
    }

    if (request.activationEvent === `onMarkdownRenderer:${workbenchMermaidRendererId}`) {
      request.context.subscriptions.add(
        request.context.markdown.registerRendererProvider(createMermaidMarkdownRendererProvider())
      );
    }

    if (request.activationEvent === `onMarkdownRenderer:${workbenchStatusRendererId}`) {
      request.context.subscriptions.add(
        request.context.markdown.registerRendererProvider(createStatusMarkdownRendererProvider())
      );
    }
  };
}
