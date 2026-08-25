import useSWR from 'swr';
import { getMember, getMemberCoupons } from '../api/members';
import { getMemberOrders } from '../api/orders';
import type { Coupon, Member } from '@smart-dining/contracts';

export function useMember(memberId: string | null) {
  return useSWR<Member>(
    memberId ? ['member', memberId] : null,
    async () => {
      const { member } = await getMember(memberId!);
      return member;
    },
    { revalidateOnFocus: true, dedupingInterval: 5000 },
  );
}

export function useMemberCoupons(memberId: string | null) {
  return useSWR<Coupon[]>(
    memberId ? ['coupons', memberId] : null,
    async () => {
      const { coupons } = await getMemberCoupons(memberId!);
      return coupons;
    },
    { revalidateOnFocus: false, dedupingInterval: 10_000 },
  );
}

export function useMemberOrders(memberId: string | null, limit = 20) {
  return useSWR(
    memberId ? ['orders', memberId, limit] : null,
    async () => {
      const { orders } = await getMemberOrders(memberId!, limit);
      return orders;
    },
    { revalidateOnFocus: false, dedupingInterval: 10_000 },
  );
}
