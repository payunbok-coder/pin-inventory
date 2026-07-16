(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PIN_SHARED_ORDER_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ROOM_STORAGE_KEY = "pinInventorySharedRoomV1";
  const ROOM_ID_PATTERN = /^[a-f0-9]{48}$/;

  function isValidRoomId(value) {
    return ROOM_ID_PATTERN.test(String(value || ""));
  }

  function roomIdFromHash(hash) {
    try {
      const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
      const roomId = params.get("room") || "";
      return isValidRoomId(roomId) ? roomId : "";
    } catch (_error) {
      return "";
    }
  }

  function createRoomId(cryptoSource) {
    if (!cryptoSource || typeof cryptoSource.getRandomValues !== "function") {
      throw new Error("Secure random values are unavailable");
    }
    const bytes = new Uint8Array(24);
    cryptoSource.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function resolveRoom(options) {
    const location = options?.location || {};
    const storage = options?.storage;
    const cryptoSource = options?.cryptoSource;
    const storedRoomId = storage?.getItem(ROOM_STORAGE_KEY) || "";
    const linkedRoomId = roomIdFromHash(location.hash);
    const joinedFromLink = Boolean(linkedRoomId && linkedRoomId !== storedRoomId);
    const roomId = linkedRoomId || (isValidRoomId(storedRoomId) ? storedRoomId : createRoomId(cryptoSource));
    storage?.setItem(ROOM_STORAGE_KEY, roomId);
    return { roomId, joinedFromLink };
  }

  function buildSharedLink(location, roomId) {
    if (!isValidRoomId(roomId)) return "";
    const origin = String(location?.origin || "").replace(/\/$/, "");
    const pathname = String(location?.pathname || "/");
    return `${origin}${pathname}#room=${roomId}`;
  }

  return {
    ROOM_STORAGE_KEY,
    isValidRoomId,
    roomIdFromHash,
    createRoomId,
    resolveRoom,
    buildSharedLink,
  };
});
