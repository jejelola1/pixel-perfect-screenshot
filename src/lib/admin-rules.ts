export function canChangeAdminRole(actorId: string, targetId: string, makeAdmin: boolean) {
  return makeAdmin || actorId !== targetId;
}

export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}