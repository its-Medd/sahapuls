import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from '../lib/api';
import { getSocket } from '../lib/socket';

/** Abort stale fetches, keep visible data during refresh and expose failures without erasing data. */
export function useResource<T>(
  path: string | null,
  initial: T,
  refreshMs = 0,
  merge?: (snapshot: T, current: T) => T,
) {
  const [data, setInternalData] = useState<T>(initial);
  const mutationCount = useRef(0);
  const dataPath = useRef(path);
  const initialRef = useRef(initial);
  const setData = useCallback((update: T | ((previous: T) => T)) => {
    mutationCount.current += 1;
    setInternalData(update);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (dataPath.current !== path) {
      dataPath.current = path;
      setInternalData(initialRef.current);
    }
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const version = mutationCount.current;
    setLoading(true);
    setError(undefined);
    const timeout = setTimeout(
      () => controller.abort(new Error('Request timed out; retry.')),
      10_000,
    );
    requestJson<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted)
          setInternalData((current) =>
            mutationCount.current !== version && merge ? merge(value, current) : value,
          );
      })
      .catch((err: unknown) => {
        if (
          !controller.signal.aborted ||
          (controller.signal.reason instanceof Error &&
            controller.signal.reason.message.includes('timed out'))
        )
          setError(err instanceof Error ? err.message : 'Could not load data. Retry.');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (
          !controller.signal.aborted ||
          (controller.signal.reason instanceof Error &&
            controller.signal.reason.message.includes('timed out'))
        )
          setLoading(false);
      });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [path, revision, merge]);
  useEffect(() => {
    const socket = getSocket();
    socket.on('connect', reload);
    const timer = refreshMs ? setInterval(reload, refreshMs) : undefined;
    return () => {
      socket.off('connect', reload);
      clearInterval(timer);
    };
  }, [reload, refreshMs]);
  return {
    data: dataPath.current === path ? data : initialRef.current,
    setData,
    loading: loading || dataPath.current !== path,
    error: dataPath.current === path ? error : undefined,
    reload,
  };
}
