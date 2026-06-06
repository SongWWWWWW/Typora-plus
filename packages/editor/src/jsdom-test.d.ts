declare module "jsdom" {
  export class JSDOM {
    readonly window: Window & typeof globalThis & { close(): void };

    constructor(html?: string);
  }
}
