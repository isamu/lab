// How a language package is imported: by name, at run time. A build without a file system puts its own module in this one's place.

export const importPackage = (specifier: string): Promise<unknown> => import(specifier);
