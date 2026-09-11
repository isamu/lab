interface Client {
  request: (path: string) => Promise<string>;
}

export const call = async (client: Client): Promise<string> => {
  // @ts-expect-error
  return client.request("/v1", { stream: true });
};

export const parse = (raw: unknown): number => {
  const value = raw as any;
  return Number(value.count);
};

// eslint-disable-next-line no-console
export const log = (message: string): void => console.log(message);
