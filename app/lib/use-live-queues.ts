import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import { startLive, type LiveSocket } from "~/lib/live";

/**
 * Keeps the open page live: when a queue changes (a new report, a photo decided, a selfie sent, a support
 * reply, a hold, another staff member's decision), the page and the counters re-read their loaders.
 * The socket carries no data, only which queue moved. The 60 s re-read on navigation stays as the fallback.
 */
export function useLiveQueues() {
  const revalidator = useRevalidator();
  const ref = useRef(revalidator);
  useEffect(() => {
    ref.current = revalidator;
  });

  useEffect(() => {
    const url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/live`;
    let later: ReturnType<typeof setTimeout> | undefined;
    // A read already under way may predate the change: wait for it, then read again.
    const refresh = () => {
      clearTimeout(later);
      if (ref.current.state === "idle") void ref.current.revalidate();
      else later = setTimeout(refresh, 500);
    };
    const live = startLive({ url, connect: (u) => new WebSocket(u) as unknown as LiveSocket, onChange: refresh, onReconnect: refresh });
    return () => {
      clearTimeout(later);
      live.stop();
    };
  }, []);
}
