import {
  getCodeLocation, s,
} from "./help.js";
import assert from "node:assert";
import { createHash } from 'node:crypto'


export function component(name) {

  const monad = {
    [s.IDENTITY.COMPONENT]: true,
    [s.INTERNALS]: {
      name,
      nodes: {
        data: new Map(),
        tasks: new Map(),
      },
      debugInfo: (({
        file, line, column, functionName
      }) => ({ file, line, column, functionName }))(getCodeLocation(3)),
      init() {
        const { file, line, column } = monad[s.INTERNALS].debugInfo
        const url = `vscode://file/${file.slice(7)}:${line}:${column}`;
      }
    },
    data(name, definition) {
      const { deps, fnc } = checkDataDefinition(definition);

      const [n] = normalizeNames(name, 'data');
      ensureNew([n], monad[s.INTERNALS].nodes.data, 'data');

      const normalizedDeps = normalizeDeps(deps);
      monad[s.INTERNALS].nodes.data.set(n, { deps: normalizedDeps, fnc });
      return monad;
    },
    addTask(name, definition) {
      const [n] = normalizeNames(name, 'task');
      ensureNew([n], monad[s.INTERNALS].nodes.tasks, 'task');

      const { deps, fnc } = checkTaskDefinition(definition);

      const normalizedDeps = normalizeDeps(deps);
      monad[s.INTERNALS].nodes.tasks.set(n, { deps: normalizedDeps, fnc });
      return monad;
    },
    hash() {
      const data = Array.from(monad[s.INTERNALS].nodes.data.entries())
        .map(([name, { deps, fnc }]) => ({
          name,
          deps: [...deps].sort(),
          fnc: String(fnc).trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const tasks = Array.from(monad[s.INTERNALS].nodes.tasks.entries())
        .map(([name, { deps, fnc }]) => ({
          name,
          deps: [...deps].sort(),
          fnc: String(fnc).trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const descriptor = {
        name: monad[s.INTERNALS].name,
        data,
        tasks,
      };
      const json = JSON.stringify(descriptor);
      return createHash('sha256').update(json).digest('hex');
    },
    explain() {
      console.log({
        data: Array.from(monad[s.INTERNALS].nodes.data.keys()),
        tasks: Array.from(monad[s.INTERNALS].nodes.tasks.keys()),
      })
    },
  }

  monad[s.INTERNALS].init()
  return monad
}



function checkDataDefinition(definition) {
  assert(definition && typeof definition === 'object', 'Requires an options object');
  const { deps = [], fnc = () => { }, type = "immediate" } = definition;
  assert(typeof fnc === 'function', 'fnc must be a function');
  return { deps, fnc };
}

function checkTaskDefinition(definition) {
  assert(definition && typeof definition === 'object', 'Requires an options object');
  const { deps = [], fnc = () => { } } = definition;
  assert(typeof fnc === 'function', 'fnc must be a function');
  return { deps, fnc };
}


function normalizeNames(nameOrNames, label = 'name') {
  assert(nameOrNames !== undefined, `Requires a ${label} or list of ${label}s`);
  const list = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
  assert(list.length > 0, `Requires at least one ${label}`);
  const normalized = list.map(n => {
    assert(typeof n === 'string', `${label}s must be strings`);
    const t = n.trim();
    assert(t !== '', `${label}s must be non-empty`);
    return t;
  });
  const seen = new Set();
  for (const n of normalized) {
    assert(!seen.has(n), `Duplicate ${label} provided: "${n}"`);
    seen.add(n);
  }
  return normalized;
}


function ensureNew(names, existing, label = 'name') {
  for (const n of names) {
    if (typeof existing.has === 'function') {
      assert(!existing.has(n), `${label.charAt(0).toUpperCase() + label.slice(1)} "${n}" already exists`);
    } else {
      assert(!existing[n], `${label.charAt(0).toUpperCase() + label.slice(1)} "${n}" already exists`);
    }
  }
}

function normalizeDeps(deps) {
  assert(Array.isArray(deps), 'deps must be an array');
  const depRe = /^(data|task):[A-Za-z0-9_.-]+$/;
  return deps.map(d => {
    assert(typeof d === 'string', 'deps must contain strings');
    const t = d.trim();
    assert(depRe.test(t), 'deps must be in the form "data:name" or "task:name"');
    return t;
  });
}
