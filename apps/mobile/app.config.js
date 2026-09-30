// Extends app.json. TURNOUT_LOCAL_DEVICE=1 builds a version you can install on your own iPhone from Xcode
// with the team's generic provisioning profile, which can't include push notifications or universal links.
// Store/TestFlight builds (EAS) never set it and keep both.
const { withEntitlementsPlist } = require("expo/config-plugins");

const withoutPushOrLinks = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults["aps-environment"];
    delete c.modResults["com.apple.developer.associated-domains"];
    return c;
  });

module.exports = ({ config }) => {
  if (process.env.TURNOUT_LOCAL_DEVICE !== "1") return config;
  const { associatedDomains: _unused, ...ios } = config.ios;
  return withoutPushOrLinks({ ...config, ios });
};
