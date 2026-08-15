import test from "node:test";
import assert from "node:assert/strict";
import { edgeIndex, nextIndex, previousIndex } from "../dist/logic.js";
import { MannerCarousel, MannerForm, MannerTabs } from "../dist/index.js";

test("tab navigation wraps in both directions", () => {
  assert.equal(nextIndex(2, 3), 0);
  assert.equal(previousIndex(0, 3), 2);
  assert.equal(edgeIndex("first", 3), 0);
  assert.equal(edgeIndex("last", 3), 2);
  assert.equal(nextIndex(0, 0), -1);
});

test("the package can be imported without a browser global", () => {
  assert.equal(typeof MannerTabs, "function");
  assert.equal(typeof MannerForm, "function");
  assert.equal(typeof MannerCarousel, "function");
});
