import type { Segment, SegmentKind } from '../types/segment.types';

const VALID_KINDS: ReadonlySet<SegmentKind> = new Set([
  'warmup',
  'work',
  'recovery',
  'cooldown',
  'rest',
  'set',
]);

const VALID_END_BY: ReadonlySet<string> = new Set(['distanceM', 'durationSec', 'reps']);

const MAX_DEPTH = 2;

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const reasonAt = (path: string, msg: string): string => `${path}: ${msg}`;

const validateNode = (
  node: unknown,
  path: string,
  depth: number,
): ValidationResult => {
  if (!node || typeof node !== 'object') {
    return { ok: false, reason: reasonAt(path, 'segment must be an object') };
  }
  if (depth > MAX_DEPTH) {
    return { ok: false, reason: reasonAt(path, `depth ${depth} exceeds max ${MAX_DEPTH}`) };
  }

  const seg = node as Partial<Segment>;
  if (typeof seg.id !== 'string' || seg.id.length === 0) {
    return { ok: false, reason: reasonAt(path, 'id must be a non-empty string') };
  }
  if (!seg.kind || !VALID_KINDS.has(seg.kind)) {
    return { ok: false, reason: reasonAt(path, `kind "${String(seg.kind)}" is not valid`) };
  }

  if (seg.kind === 'set') {
    if (typeof seg.repetitions !== 'number' || seg.repetitions < 1) {
      return { ok: false, reason: reasonAt(path, 'set node requires repetitions >= 1') };
    }
    if (!Array.isArray(seg.children) || seg.children.length < 1) {
      return { ok: false, reason: reasonAt(path, 'set node requires children >= 1') };
    }
    if (seg.end !== undefined) {
      return { ok: false, reason: reasonAt(path, 'set node must not have end') };
    }
    for (let i = 0; i < seg.children.length; i++) {
      const childResult = validateNode(seg.children[i], `${path}.children[${i}]`, depth + 1);
      if (!childResult.ok) return childResult;
    }
    return { ok: true };
  }

  // Non-set
  if (seg.children !== undefined) {
    return { ok: false, reason: reasonAt(path, `kind "${seg.kind}" must not have children`) };
  }
  if (!seg.end || typeof seg.end !== 'object') {
    return { ok: false, reason: reasonAt(path, 'end is required for non-set nodes') };
  }
  if (!VALID_END_BY.has(seg.end.by)) {
    return { ok: false, reason: reasonAt(path, `end.by "${String(seg.end.by)}" is not valid`) };
  }
  if (typeof seg.end.value !== 'number' || seg.end.value < 0) {
    return { ok: false, reason: reasonAt(path, 'end.value must be a non-negative number') };
  }
  return { ok: true };
};

/**
 * Pure validator for a Segment[] tree, mirroring the SegmentTreeConsistency
 * class-validator rules. Used at the AI→DB seam where DTO validation does not run.
 *
 * Returns the first failure encountered; does not collect every error.
 */
export const validateSegmentTree = (segments: unknown): ValidationResult => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, reason: 'segments must be a non-empty array' };
  }
  for (let i = 0; i < segments.length; i++) {
    const result = validateNode(segments[i], `segments[${i}]`, 0);
    if (!result.ok) return result;
  }
  return { ok: true };
};

/**
 * Structural quality gate for a RUN day (sportType !== 'other'). Beyond being a
 * valid tree, a real running session must have a warmup, a main effort
 * (work or set), and a cooldown — otherwise it collapses to a single legacy
 * "main" block (the degenerate output we want to reject and regenerate).
 *
 * Returns ok:false with a human-readable reason naming what is missing.
 */
export const isStructurallyCompleteRun = (segments: unknown): ValidationResult => {
  const tree = validateSegmentTree(segments);
  if (!tree.ok) return tree;

  const top = segments as Segment[];
  const has = (kind: SegmentKind) => top.some((s) => s.kind === kind);
  const missing: string[] = [];
  if (!has('warmup')) missing.push('warmup');
  if (!has('work') && !has('set')) missing.push('main (work/set)');
  if (!has('cooldown')) missing.push('cooldown');

  if (missing.length > 0) {
    return { ok: false, reason: `run is missing required segment(s): ${missing.join(', ')}` };
  }
  return { ok: true };
};
