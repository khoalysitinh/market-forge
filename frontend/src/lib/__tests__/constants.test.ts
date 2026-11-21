import { describe, expect, it } from "vitest";
import { APP_NAME } from "../constants";

describe("constants", () => {
  it("defines the application name", () => {
    expect(APP_NAME).toBe("MARKET FORGE");
  });
});
