import { ByteArray, crypto } from "@graphprotocol/graph-ts";

export function keccak256(s: string): ByteArray {
  return crypto.keccak256(ByteArray.fromUTF8(s));
}
