// The folder chaff runs in, where a run without chaff.yaml resolves paths. A build without a process puts its own module in this one's place.

export const workingDir = (): string => process.cwd();
