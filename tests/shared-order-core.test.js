const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ROOM_STORAGE_KEY,
  isValidRoomId,
  roomIdFromHash,
  createRoomId,
  resolveRoom,
  buildSharedLink,
} = require("../shared-order-core.js");

function fakeCrypto() {
  return {
    getRandomValues(bytes) {
      bytes.forEach((_, index) => { bytes[index] = index; });
      return bytes;
    },
  };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("creates a strong 48-character room id", () => {
  const roomId = createRoomId(fakeCrypto());
  assert.equal(roomId, "000102030405060708090a0b0c0d0e0f1011121314151617");
  assert.equal(isValidRoomId(roomId), true);
  assert.equal(isValidRoomId("short"), false);
});

test("reads a valid room id from a hash and ignores invalid values", () => {
  const roomId = "a".repeat(48);
  assert.equal(roomIdFromHash(`#room=${roomId}`), roomId);
  assert.equal(roomIdFromHash("#room=not-safe"), "");
});

test("joining a different shared link replaces the stored room", () => {
  const oldRoom = "a".repeat(48);
  const linkedRoom = "b".repeat(48);
  const storage = memoryStorage({ [ROOM_STORAGE_KEY]: oldRoom });

  const result = resolveRoom({
    location: { hash: `#room=${linkedRoom}` },
    storage,
    cryptoSource: fakeCrypto(),
  });

  assert.deepEqual(result, { roomId: linkedRoom, joinedFromLink: true });
  assert.equal(storage.getItem(ROOM_STORAGE_KEY), linkedRoom);
});

test("reuses the same room and builds a shareable URL", () => {
  const roomId = "c".repeat(48);
  const storage = memoryStorage({ [ROOM_STORAGE_KEY]: roomId });
  const result = resolveRoom({
    location: { hash: `#room=${roomId}` },
    storage,
    cryptoSource: fakeCrypto(),
  });

  assert.deepEqual(result, { roomId, joinedFromLink: false });
  assert.equal(
    buildSharedLink({ origin: "https://example.com", pathname: "/pin/" }, roomId),
    `https://example.com/pin/#room=${roomId}`,
  );
});
