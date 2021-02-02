import {
  CreateClone as CreateCloneEvent
} from '../generated/ZeroCouponBondFactory/ZeroCouponBondFactory'
import { ZeroCouponBond } from '../generated/templates'

export function handleCreateClone(event: CreateCloneEvent): void {
  ZeroCouponBond.create(event.params._clone)
}