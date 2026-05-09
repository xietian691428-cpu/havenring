"use client";

/**
 * Loads `UserEntitlements` via `subscriptionService` (API + cache + Supabase fallback).
 * Tier / limits are never hardcoded here.
 */
import { useEffect, useState } from "react";
import {
  getFreeEntitlements,
  loadSubscriptionStatus,
  readCachedSubscriptionStatus,
} from "../services/subscriptionService";

export function useSubscriptionStatus(session) {
  const [entitlements, setEntitlements] = useState(() =>
    readCachedSubscriptionStatus()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadSubscriptionStatus(session)
      .then((next) => {
        if (active) setEntitlements(next);
      })
      .catch(() => {
        if (active) {
          setEntitlements(
            session ? readCachedSubscriptionStatus() : getFreeEntitlements()
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  return { entitlements, loading };
}
