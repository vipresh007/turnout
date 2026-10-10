import { test } from "node:test";
import assert from "node:assert/strict";
import { isOffensive } from "./moderation.ts";

test("blocks slurs and profanity, including simple disguises", () => {
  for (const bad of ["fuck this", "Sh1t Show", "f u c k", "f.u.c.k", "BITCHES", "motherfucker league"]) assert.equal(isOffensive(bad), true, bad);
});

test("leaves ordinary names and places alone", () => {
  for (const ok of ["Tuesday Basketball", "Dickson Park", "Scunthorpe United", "Sussex Pickup", "Mike", "Essex Hall", "Grape Street", "Pakistan Cricket", "Assessment Centre", "J R", "Shitake"]) assert.equal(isOffensive(ok), false, ok);
});
