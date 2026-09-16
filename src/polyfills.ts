import { Buffer } from "buffer";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

if (!("global" in globalThis)) {
  Object.assign(globalThis, { global: globalThis });
}
