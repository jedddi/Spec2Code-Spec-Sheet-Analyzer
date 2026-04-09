/**
 * Single-use flag for "home → /chat" redirect: user row is already in DB but
 * the assistant reply must be streamed once. Must NOT be inferred from
 * "last message is user" alone (that retriggers on every refresh).
 */

const PREFIX = "zaigo-chat-pending-handoff:";

export function getChatHandoffStorageKey(sessionId: string) {
  return `${PREFIX}${sessionId}`;
}

export function setPendingChatHandoff(sessionId: string) {
  try {
    sessionStorage.setItem(getChatHandoffStorageKey(sessionId), "1");
  } catch {
    /* private mode / disabled storage */
  }
}

export function hasPendingChatHandoff(sessionId: string): boolean {
  try {
    return sessionStorage.getItem(getChatHandoffStorageKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

export function clearPendingChatHandoff(sessionId: string) {
  try {
    sessionStorage.removeItem(getChatHandoffStorageKey(sessionId));
  } catch {
    /* noop */
  }
}
