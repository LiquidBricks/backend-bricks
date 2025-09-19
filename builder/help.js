export const s = {
  INTERNALS: Symbol('INTERNALS'),
  IDENTITY: {
    GROUP: Symbol('IDENTITY_GROUP'),
    COMPONENT: Symbol('IDENTITY_COMPONENT'),
    TASK: Symbol('IDENTITY_TASK'),
  }
}
export function isAComponent(group) {
  return group?.[s.IDENTITY.COMPONENT]
}
export function getCodeLocation(depth = 2) {
  const e = new Error();
  const stack = e.stack?.split("\n") ?? [];

  // Skip the first line (it's the error message)
  const callerLine = stack[depth] ?? ""; // adjust if wrapped
  const match = callerLine.match(/at (.*?) \((.*?):(\d+):(\d+)\)/) ||
    callerLine.match(/at (.*?):(\d+):(\d+)/);

  const [, fn = null, file = import.meta.url, line = null, col = null] = match || [];

  return {
    file,
    line: Number(line),
    column: Number(col),
    functionName: fn,
    stack: stack.join("\n"),
  }
}