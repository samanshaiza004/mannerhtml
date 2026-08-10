export function nextIndex(index: number, length: number): number {
  return length === 0 ? -1 : (index + 1 + length) % length;
}

export function previousIndex(index: number, length: number): number {
  return length === 0 ? -1 : (index - 1 + length) % length;
}

export function edgeIndex(edge: "first" | "last", length: number): number {
  if (length === 0) return -1;
  return edge === "first" ? 0 : length - 1;
}
