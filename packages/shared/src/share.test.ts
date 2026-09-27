import { test } from "node:test";
import assert from "node:assert/strict";
import { activityEmoji, groupShareMessage, whatsappUrl } from "./share.ts";

const base = {
  name: "Tuesday Basketball", activity: "basketball", location: "Riverside", timezone: "America/Toronto",
  cap: 14, startsAt: "2026-09-29T23:30:00.000Z", confirmed: 11, link: "https://t.example/g/abc",
};

test("share message: what, when, where, how many more", () => {
  assert.equal(
    groupShareMessage(base),
    "🏀 Tuesday Basketball\n📅 Tue, Sep 29 · 7:30 PM\n📍 Riverside\n👥 11/14 in · need 3 more!\n\nTap to join: https://t.example/g/abc",
  );
});

test("share message: full, no cap, cancelled", () => {
  assert.match(groupShareMessage({ ...base, confirmed: 14 }), /full, join the waitlist/);
  assert.match(groupShareMessage({ ...base, cap: null, location: null }), /👥 11 in so far/);
  assert.match(groupShareMessage({ ...base, cancelled: true }), /Cancelled this week/);
});

test("emoji from activity or name; WhatsApp link encodes text", () => {
  assert.equal(activityEmoji(null, "Sunday Soccer"), "⚽");
  assert.equal(activityEmoji("poker"), "🃏");
  assert.equal(activityEmoji(null, "Book club"), "📣");
  assert.equal(whatsappUrl("a b\nc"), "https://wa.me/?text=a%20b%0Ac");
});
