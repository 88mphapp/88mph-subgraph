import {
  ECreateVest,
  EUpdateVest,
  EWithdraw,
  Transfer
} from "../generated/Vesting/Vesting02";
import { ZERO_DEC, normalize, DELIMITER } from "./utils";
import { Vest } from "../generated/schema";

export function handleCreateVest(event: ECreateVest): void {
  // TODO: Create Vest entity
}

export function handleUpdateVest(event: EUpdateVest): void {
  // TODO: Update Vest entity
}

export function handleWithdraw(event: EWithdraw): void {
  // TODO: Update Vest entity
}

export function handleTransfer(event: Transfer): void {
  // TODO: Update Vest entity
}
