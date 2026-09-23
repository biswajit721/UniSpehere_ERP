import { useCallback, useEffect, useRef, useState } from "react";
import { extractErrorMessage } from "./errorMessage";

export interface Remote<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads data for a query identified by `key`. While `key` is null nothing is requested (the field is
 * "waiting for a parent"). When the key changes the old data is dropped immediately and a stale response
 * that arrives late can never overwrite a newer one - this is what keeps cascading dropdowns from showing
 * options that belong to the previous selection.
 */
export function useRemote<T>(key: string | null, fetcher: () => Promise<T>): Remote<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: key !== null, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const id = ++requestId.current;
    if (key === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState({ data: null, loading: true, error: null });
    fetcherRef
      .current()
      .then((data) => id === requestId.current && setState({ data, loading: false, error: null }))
      .catch((err) => id === requestId.current && setState({ data: null, loading: false, error: extractErrorMessage(err, "Could not load this list.") }));
    return () => {
      requestId.current += 1; // invalidate the in-flight request
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
