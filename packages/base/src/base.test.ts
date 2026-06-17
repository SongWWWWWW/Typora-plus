import { describe, expect, it } from "vitest";
import { DisposableStore, Emitter, toDisposable, URI } from "./index";

describe("base lifecycle", () => {
  it("disposes registered resources exactly once", () => {
    const store = new DisposableStore();
    let count = 0;

    store.add(toDisposable(() => count += 1));
    store.dispose();
    store.dispose();

    expect(count).toBe(1);
  });
});

describe("base event", () => {
  it("emits events until listener is disposed", () => {
    const emitter = new Emitter<number>();
    const events: number[] = [];
    const listener = emitter.event((event) => events.push(event));

    emitter.fire(1);
    listener.dispose();
    emitter.fire(2);

    expect(events).toEqual([1]);
  });
});

describe("uri", () => {
  it("normalizes windows paths", () => {
    expect(URI.file("C:\\Notes\\a.md").toString()).toBe("file://C:/Notes/a.md");
  });

  it("percent-encodes file URI path segments and decodes them when parsing", () => {
    const uri = URI.file("C:\\Users\\wcc\\OneDrive\\文档\\Typora Plus\\a#b.md");

    expect(uri.toString()).toBe("file://C:/Users/wcc/OneDrive/%E6%96%87%E6%A1%A3/Typora%20Plus/a%23b.md");
    expect(URI.parse(uri.toString()).path).toBe("C:/Users/wcc/OneDrive/文档/Typora Plus/a#b.md");
    expect(URI.parse("file:///C:/Users/wcc/OneDrive/%E6%96%87%E6%A1%A3/a.md").toString())
      .toBe("file://C:/Users/wcc/OneDrive/%E6%96%87%E6%A1%A3/a.md");
  });
});
