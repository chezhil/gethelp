// Dynamic config so the same source can be exported for two hosts.
//
// GitHub Pages serves this repo from a /gethelp path prefix, which every
// asset URL has to carry. Cloud Run serves it from the root of its own
// domain, where that same prefix would 404 every file. Everything else lives
// in app.json — this only overrides the one field that differs.
const base = require("./app.json");

module.exports = () => {
  const baseUrl = process.env.GETHELP_BASE_URL ?? "/gethelp";
  const experiments = { ...base.expo.experiments };
  if (baseUrl) experiments.baseUrl = baseUrl;
  else delete experiments.baseUrl;
  return { ...base.expo, experiments };
};
