import { APP_ENTRY_PATH } from "@/lib/site";

type AppEntryHrefOpts = {
  fromStart?: boolean;
  open?: string;
  fromDraft?: string;
};

/** Build `/app` href for client-side (Next.js router) navigation — avoids full page reload. */
export function buildAppEntryHref(opts: AppEntryHrefOpts = {}): string {
  const params = new URLSearchParams();
  if (opts.fromStart) params.set("from", "start");
  if (opts.open) params.set("open", opts.open);
  if (opts.fromDraft) params.set("fromDraft", opts.fromDraft);
  const qs = params.toString();
  return qs ? `${APP_ENTRY_PATH}?${qs}` : APP_ENTRY_PATH;
}
