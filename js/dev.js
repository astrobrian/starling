
const DEV = false;
const PARAMS = DEV ? new URLSearchParams(location.search) : new URLSearchParams();

function dropSwitches(...names) {
  try {
    const kept = location.search.slice(1).split("&").filter((kv) => kv && !names.includes(kv.split("=")[0]));
    history.replaceState(history.state, "", location.pathname + (kept.length ? "?" + kept.join("&") : "") + location.hash);
  } catch (e) { /* (fine: it just stays in the address) */ }
}
