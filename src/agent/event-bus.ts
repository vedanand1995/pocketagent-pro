type Kind = "cmd" | "out" | "err";
type Listener = (line: string, kind: Kind) => void;

const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function broadcast(line: string, kind: Kind = "out"): void {
  listeners.forEach((fn) => fn(line, kind));
}
