import assert from "node:assert/strict";
import { test } from "node:test";
import { describeCost, formatMoney, parseMoney, shareCents } from "./cost.ts";

test("per player cost is the same for everyone", () => {
  assert.equal(shareCents({ feeCents: 1000, feeSplit: false }, 7), 1000);
  assert.equal(describeCost({ feeCents: 1000, feeSplit: false }, 7), "$10 each");
});

test("a split total divides between everyone in, rounding up", () => {
  assert.equal(shareCents({ feeCents: 10000, feeSplit: true }, 3), 3334);
  assert.equal(shareCents({ feeCents: 12000, feeSplit: true }, 0), 12000);
  assert.equal(describeCost({ feeCents: 12000, feeSplit: true }, 12), "$120 split between everyone in · $10 each so far");
});

test("no cost", () => {
  assert.equal(shareCents({ feeCents: null, feeSplit: false }, 5), null);
  assert.equal(describeCost({ feeCents: 0, feeSplit: true }, 5), null);
});

test("money parsing and formatting", () => {
  assert.equal(parseMoney("$7.50"), 750);
  assert.equal(parseMoney("7,5"), 750);
  assert.equal(parseMoney(" "), null);
  assert.equal(parseMoney("abc"), undefined);
  assert.equal(formatMoney(750), "$7.50");
  assert.equal(formatMoney(1000), "$10");
});
