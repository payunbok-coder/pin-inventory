(function () {
  "use strict";

  const FIREBASE_VERSION = "12.15.0";
  const core = window.PIN_SHARED_ORDER_CORE;
  const appApi = window.PIN_APP;
  const storage = getStorage();
  const elements = {
    dot: document.getElementById("syncDot"),
    status: document.getElementById("syncStatus"),
    roomLabel: document.getElementById("roomLabel"),
    shareButton: document.getElementById("shareOrderButton"),
    newRoomButton: document.getElementById("newSharedOrderButton"),
  };
  let room;
  let sharedLink = "";
  let writeHandler = null;
  let writeQueue = Promise.resolve();
  const pendingOperations = [];

  if (!core || !appApi || !elements.status) return;

  try {
    room = core.resolveRoom({ location: window.location, storage, cryptoSource: window.crypto });
    sharedLink = core.buildSharedLink(window.location, room.roomId);
    if (window.location.hash !== `#room=${room.roomId}`) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#room=${room.roomId}`);
    }
    elements.roomLabel.textContent = `Room ${room.roomId.slice(-6).toUpperCase()}`;
  } catch (_error) {
    setStatus("Secure room unavailable — local only", "error");
    return;
  }

  window.addEventListener("pin-order-local-change", (event) => {
    const operation = event.detail;
    if (!operation) return;
    if (!writeHandler) pendingOperations.push(operation);
    else enqueueWrite(operation);
  });

  elements.shareButton.addEventListener("click", shareRoom);
  elements.newRoomButton.addEventListener("click", createNewRoom);
  window.addEventListener("online", () => setStatus("Reconnecting…", "connecting"));
  window.addEventListener("offline", () => setStatus("Offline — saved on this device", "offline"));

  initializeSharedOrder();

  function getStorage() {
    try {
      return window.localStorage;
    } catch (_error) {
      return window.PIN_ORDER_STORE.createMemoryStorage();
    }
  }

  function setStatus(message, state) {
    elements.status.textContent = message;
    elements.dot.className = `sync-dot is-${state || "connecting"}`;
  }

  function configIsReady(config) {
    return Boolean(config && config.apiKey && config.authDomain && config.projectId && config.appId);
  }

  async function initializeSharedOrder() {
    const config = window.PIN_FIREBASE_CONFIG;
    if (!configIsReady(config)) {
      setStatus("Firebase setup pending — local only", "offline");
      return;
    }

    setStatus("Connecting securely…", "connecting");
    try {
      const [firebaseApp, firebaseAuth, firestore] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
      ]);

      const firebase = firebaseApp.initializeApp(config);
      const auth = firebaseAuth.getAuth(firebase);
      await firebaseAuth.signInAnonymously(auth);
      const db = firestore.getFirestore(firebase);
      const itemsRef = firestore.collection(db, "rooms", room.roomId, "items");
      const initialSnapshot = await firestore.getDocs(itemsRef);
      const remoteItems = snapshotItems(initialSnapshot);

      if (initialSnapshot.empty && !room.joinedFromLink) {
        await uploadLocalOrder(firestore, db, itemsRef, auth.currentUser.uid);
      } else {
        appApi.replaceOrderFromSync(remoteItems);
      }

      firestore.onSnapshot(
        itemsRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          appApi.replaceOrderFromSync(snapshotItems(snapshot));
          if (!navigator.onLine) setStatus("Offline — changes will sync", "offline");
          else if (snapshot.metadata.hasPendingWrites) setStatus("Saving changes…", "connecting");
          else setStatus("Live sync on", "live");
        },
        () => setStatus("Sync paused — local copy is safe", "error"),
      );

      writeHandler = (operation) => writeOperation(operation, firestore, db, itemsRef, auth.currentUser.uid);
      pendingOperations.splice(0).forEach(enqueueWrite);
      setStatus("Live sync on", "live");
    } catch (error) {
      console.error("Shared Order connection failed", error);
      setStatus("Could not connect — local copy is safe", "error");
    }
  }

  function snapshotItems(snapshot) {
    const items = {};
    snapshot.forEach((itemDocument) => {
      const quantity = window.PIN_ORDER_STORE.normalizeQuantity(itemDocument.data()?.quantity);
      if (quantity) items[itemDocument.id] = quantity;
    });
    return items;
  }

  async function uploadLocalOrder(firestore, db, itemsRef, userId) {
    const entries = Object.entries(appApi.getOrderState());
    if (entries.length === 0) return;
    const batch = firestore.writeBatch(db);
    entries.forEach(([productId, quantity]) => {
      batch.set(firestore.doc(itemsRef, productId), {
        quantity,
        updatedAt: firestore.serverTimestamp(),
        updatedBy: userId,
      });
    });
    await batch.commit();
  }

  function enqueueWrite(operation) {
    writeQueue = writeQueue
      .then(() => writeHandler(operation))
      .catch((error) => {
        console.error("Shared Order write failed", error);
        setStatus("Sync paused — local copy is safe", "error");
      });
  }

  async function writeOperation(operation, firestore, db, itemsRef, userId) {
    if (operation.type === "set") {
      const quantity = window.PIN_ORDER_STORE.normalizeQuantity(operation.quantity);
      if (!quantity) return;
      await firestore.setDoc(firestore.doc(itemsRef, operation.productId), {
        quantity,
        updatedAt: firestore.serverTimestamp(),
        updatedBy: userId,
      });
    } else if (operation.type === "remove") {
      await firestore.deleteDoc(firestore.doc(itemsRef, operation.productId));
    } else if (operation.type === "clear") {
      const snapshot = await firestore.getDocs(itemsRef);
      const batch = firestore.writeBatch(db);
      snapshot.forEach((itemDocument) => batch.delete(itemDocument.ref));
      await batch.commit();
    }
  }

  async function shareRoom() {
    const shareData = {
      title: "PIN Inventory Shared Order",
      text: "Open this link to work on the same PIN Inventory order:",
      url: sharedLink,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(sharedLink);
      appApi.showToast("Shared Order link copied");
    } catch (error) {
      if (error?.name !== "AbortError") appApi.showToast("Could not share the link");
    }
  }

  function createNewRoom() {
    const confirmed = window.confirm("Start a new empty Shared Order? The old room will stay available from its existing link.");
    if (!confirmed) return;
    const nextRoomId = core.createRoomId(window.crypto);
    storage.setItem(core.ROOM_STORAGE_KEY, nextRoomId);
    appApi.resetLocalOrder();
    window.location.hash = `room=${nextRoomId}`;
    window.location.reload();
  }

  window.PIN_SHARED_ORDER = {
    getRoomId: () => room.roomId,
    getSharedLink: () => sharedLink,
  };
})();
