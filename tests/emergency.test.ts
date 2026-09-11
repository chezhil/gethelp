import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_EMERGENCY_NUMBER,
  emergencyNumberFor,
  detectRegion,
  localEmergencyNumber,
} from "../lib/emergency.ts";

// The one button in this app that has to work when everything else has gone
// wrong. It was hardcoded to 112 — correct in India and the EU, a dead number
// across most of the Americas.
describe("emergencyNumberFor", () => {
  it("dials 911 across North America", () => {
    for (const region of ["US", "CA", "MX"]) {
      assert.equal(emergencyNumberFor(region), "911", `${region} should dial 911`);
    }
  });

  it("keeps 112 where 112 is right", () => {
    // India's unified number, and the EU standard.
    for (const region of ["IN", "DE", "FR", "ES", "IT", "PL", "IE", "NL"]) {
      assert.equal(emergencyNumberFor(region), "112", `${region} should dial 112`);
    }
  });

  it("uses the number people actually know in the UK and Australasia", () => {
    assert.equal(emergencyNumberFor("GB"), "999");
    assert.equal(emergencyNumberFor("AU"), "000");
    assert.equal(emergencyNumberFor("NZ"), "111");
  });

  it("uses the medical line, not the police line, where a country splits them", () => {
    assert.equal(emergencyNumberFor("JP"), "119"); // fire/ambulance, not 110
    assert.equal(emergencyNumberFor("CN"), "120"); // ambulance, not 110
    assert.equal(emergencyNumberFor("BR"), "192"); // SAMU, not 190
    assert.equal(emergencyNumberFor("IL"), "101"); // Magen David Adom, not 100
    assert.equal(emergencyNumberFor("AE"), "998"); // ambulance, not 999
    assert.equal(emergencyNumberFor("SA"), "997"); // Red Crescent, not 999
  });

  it("accepts a full locale, not just a bare region code", () => {
    assert.equal(emergencyNumberFor("en-US"), "911");
    assert.equal(emergencyNumberFor("pt-BR"), "192");
    assert.equal(emergencyNumberFor("en_AU"), "000");
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    assert.equal(emergencyNumberFor("us"), "911");
    assert.equal(emergencyNumberFor("  Gb  "), "999");
  });

  // Detection can be wrong — a traveller's handset, a VPN, a browser
  // reporting a locale with no region. 112 is reachable from a GSM phone
  // almost everywhere, so it is the right answer when we do not know.
  it("falls back to 112 when the region is unknown, empty or nonsense", () => {
    for (const region of [undefined, null, "", "   ", "ZZ", "XX-YY", "klingon"]) {
      assert.equal(
        emergencyNumberFor(region as string | undefined),
        DEFAULT_EMERGENCY_NUMBER,
        `${JSON.stringify(region)} should fall back`
      );
    }
  });

  it("never returns an empty string — the button must always dial something", () => {
    for (const region of [undefined, "", "US", "IN", "ZZ", "en-Latn-US"]) {
      const number = emergencyNumberFor(region);
      assert.ok(number.length > 0, `empty number for ${JSON.stringify(region)}`);
      assert.match(number, /^\d+$/, `non-numeric number for ${JSON.stringify(region)}`);
    }
  });

  it("does not mistake a four-letter script subtag for a region", () => {
    // zh-Hans-CN must resolve on CN, not on "Hans".
    assert.equal(emergencyNumberFor("CN"), "120");
    assert.equal(emergencyNumberFor("Hans"), DEFAULT_EMERGENCY_NUMBER);
  });
});

describe("detectRegion / localEmergencyNumber", () => {
  it("never throws, whatever the environment reports", () => {
    assert.doesNotThrow(() => detectRegion());
    assert.doesNotThrow(() => localEmergencyNumber());
  });

  it("always yields a dialable number on this machine", () => {
    assert.match(localEmergencyNumber(), /^\d+$/);
  });

  it("agrees with the pure mapping for whatever region it detected", () => {
    assert.equal(localEmergencyNumber(), emergencyNumberFor(detectRegion()));
  });
});
