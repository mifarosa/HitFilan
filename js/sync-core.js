// Pure merge rules for cloud sync, kept free of Firebase so they can be tested.
//
// A document is { kind, data, updatedAt, deleted }. For each id the newest
// version wins; equal times mean both sides already agree.

// Returns what to write locally (remote is newer) and what to upload (local is
// newer, or missing from the cloud). Local tombstones for documents the cloud
// never had are not uploaded.
export function planMerge(local, remote) {
  const toApply = [];
  const toPush = [];
  for (const [id, r] of remote) {
    const l = local.get(id);
    if (!l || r.updatedAt > l.updatedAt) toApply.push([id, r]);
    else if (l.updatedAt > r.updatedAt) toPush.push(id);
  }
  for (const [id, l] of local) {
    if (!remote.has(id) && !l.deleted) toPush.push(id);
  }
  return { toApply, toPush };
}

// Firestore field values for a local document. Data travels as a JSON string,
// so nested arrays and empty values need no special handling.
export function toCloud(doc) {
  return {
    kind: doc.kind,
    data: doc.deleted ? null : JSON.stringify(doc.data),
    // Records from before tracking existed have time 0; 1 keeps any cloud edit newer.
    updatedAt: Math.max(1, doc.updatedAt || 0),
    deleted: !!doc.deleted,
  };
}

export function fromCloud(fields) {
  let data = null;
  try {
    data = fields.data ? JSON.parse(fields.data) : null;
  } catch { /* corrupt document: treat as empty */ }
  return {
    kind: fields.kind,
    data,
    updatedAt: Number(fields.updatedAt) || 0,
    deleted: !!fields.deleted || data == null,
  };
}
