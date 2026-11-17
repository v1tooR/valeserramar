import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { errorMessage } from "../api/client";
import { Button, Notice } from "./ui";
export function useRemote<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [value, setValue] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const id = ++sequence.current;
    setLoading(true);
    setError("");
    setValue(null);
    try {
      const data = await fetchRef.current();
      if (id === sequence.current) setValue(data);
    } catch (e) {
      if (id === sequence.current) setError(errorMessage(e));
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return () => {
      sequence.current++;
    };
  }, deps);
  return { value, error, loading, reload };
}
export function RemoteStatus({
  resource,
}: {
  resource: { error: string; loading: boolean; reload: () => Promise<void> };
}) {
  return (
    <View style={{ gap: 12 }}>
      {resource.loading && <ActivityIndicator color="#1D6B54" />}
      {!!resource.error && (
        <>
          <Notice tone="amber">{resource.error}</Notice>
          <Button
            secondary
            title="Tentar novamente"
            onPress={resource.reload}
          />
        </>
      )}
    </View>
  );
}
