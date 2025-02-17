import { getValueFromPath } from "../src/modules/WorkFlowManager";

describe("getValueFromPath", () => {
  it("should resolve a simple path", () => {
    const obj = { a: { b: { c: 42 } } };
    const path = "a.b.c";
    const result = getValueFromPath(obj, path);
    expect(result).toBe(42);
  });

  it("should resolve a path with array indices", () => {
    const obj = { a: { b: [{ c: 42 }, { c: 43 }] } };
    const path = "a.b[1].c";
    const result = getValueFromPath(obj, path);
    expect(result).toBe(43);
  });

  it("should resolve a path with nested arrays", () => {
    const obj = { a: [{ b: [{ c: 42 }] }] };
    const path = "a[0].b[0].c";
    const result = getValueFromPath(obj, path);
    expect(result).toBe(42);
  });

  it("should return undefined for non-existent path", () => {
    const obj = { a: { b: { c: 42 } } };
    const path = "a.b.d";
    const result = getValueFromPath(obj, path);
    expect(result).toBeUndefined();
  });

  it("should throw an error for invalid path resolution", () => {
    const obj = { a: { b: null } };
    const path = "a.b.c";
    expect(() => getValueFromPath(obj, path)).toThrow(
      "Path resolution failed at c"
    );
  });

  it("should handle array mapping", () => {
    const obj = { a: [{ b: 1 }, { b: 2 }, { b: 3 }] };
    const path = "a.b";
    const result = getValueFromPath(obj, path);
    expect(result).toEqual([1, 2, 3]);
  });

  it("should return undefined for non-array access with array index", () => {
    const obj = { a: { b: [{ c: 42 }] } };
    const path = "a.b[0].c";
    const result = getValueFromPath(obj, path);
    expect(result).toEqual(42);
  });
});
