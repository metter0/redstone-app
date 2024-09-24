import isScreen from "./screenHelper.js";

export default function truncateString(s, disableTruncate = false) {
  if (isScreen("xxl") || (disableTruncate && !isScreen("xs"))) return s;
  if (s?.length <= 11) {
    return s;
  }
  return s?.slice(0, 7) + " . . . " + s?.slice(-4);
}
