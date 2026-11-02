import { describe, expect, it } from "vitest";
import { tryPush } from "./array";

describe("tryPush", () => {
  it("appends onto a copy and leaves the original array unchanged", () => {
    const original = ["a"];
    const result = tryPush(original, "b");

    expect(result).toEqual(["a", "b"]);
    expect(original).toEqual(["a"]);
    expect(result).not.toBe(original);
  });

  it("starts a new array when the caller has no list yet", () => {
    // toTagList / toCategoryList pass a missing record entry through here.
    const result = tryPush(undefined as unknown as string[], "a");

    expect(result).toEqual(["a"]);
  });
});
