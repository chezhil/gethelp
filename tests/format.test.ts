import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directionsUrl, formatDistance, formatEta } from "../lib/format.ts";

// These two formatters were duplicated across the facility card and the
// history list, with different rounding on each side. One definition, tested
// once, is the point of the shared module.
describe("formatEta", () => {
  it("rounds to whole minutes under an hour", () => {
    assert.equal(formatEta(60), "1 min");
    assert.equal(formatEta(510), "9 min");
    assert.equal(formatEta(0), "0 min");
  });

  it("splits into hours and minutes past an hour", () => {
    assert.equal(formatEta(4500), "1 h 15 min");
    assert.equal(formatEta(9000), "2 h 30 min");
  });

  it("drops a trailing '0 min' on a whole number of hours", () => {
    assert.equal(formatEta(3600), "1 h");
    assert.equal(formatEta(7200), "2 h");
  });

  it("returns null when there is no ETA, so callers pick their own placeholder", () => {
    assert.equal(formatEta(undefined), null);
    assert.equal(formatEta(Number.NaN), null);
    assert.equal(formatEta(Number.POSITIVE_INFINITY), null);
    assert.equal(formatEta(-5), null);
  });
});

describe("formatDistance", () => {
  it("uses metres below a kilometre", () => {
    assert.equal(formatDistance(0), "0 m");
    assert.equal(formatDistance(450.4), "450 m");
    assert.equal(formatDistance(999), "999 m");
  });

  it("switches to kilometres at 1000m, to one decimal", () => {
    assert.equal(formatDistance(1000), "1.0 km");
    assert.equal(formatDistance(15200), "15.2 km");
  });

  it("returns an empty string rather than 'NaN m' when there is no distance", () => {
    assert.equal(formatDistance(undefined), "");
    assert.equal(formatDistance(Number.NaN), "");
  });
});

// This link is how someone actually gets to the hospital, so the failure mode
// worth pinning is a malformed URL that drops the destination.
describe("directionsUrl", () => {
  const url = directionsUrl({ lat: 12.9784, lng: 77.6408 });

  it("targets Google Maps' directions endpoint with the documented api flag", () => {
    assert.ok(url.startsWith("https://www.google.com/maps/dir/?"));
    assert.match(url, /(\?|&)api=1(&|$)/);
  });

  it("sends exact coordinates, so a repeated hospital name cannot pick the wrong branch", () => {
    assert.match(url, /destination=12\.9784%2C77\.6408/);
  });

  it("asks for driving, matching the ETA shown next to it", () => {
    assert.match(url, /travelmode=driving/);
  });

  // The previous form sent `destination_place_id=` (empty, and not a valid
  // value) plus a `q=` parameter that belongs to /maps/search, not /maps/dir.
  it("sends no empty or borrowed parameters", () => {
    assert.doesNotMatch(url, /destination_place_id/);
    assert.doesNotMatch(url, /[?&]q=/);
    for (const pair of new URL(url).searchParams.entries()) {
      assert.ok(pair[1].length > 0, `parameter ${pair[0]} was sent empty`);
    }
  });

  it("handles southern and western hemispheres without mangling the sign", () => {
    const south = directionsUrl({ lat: -33.8688, lng: -70.6693 });
    assert.match(south, /destination=-33\.8688%2C-70\.6693/);
  });
});
