// A suppression with a reason is not penalised (spec §15.3).

interface Client {
  request: (path: string) => Promise<string>;
}

export const call = async (client: Client): Promise<string> => {
  // @ts-expect-error upstream types omit the stream overload (nodejs/undici#3421)
  return client.request("/v1", { stream: true });
};

export const parse = (raw: unknown): number => {
  const value = raw as any; // the shape of this external JSON is unknown until runtime
  return Number(value.count);
};
