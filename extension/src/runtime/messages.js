export const MESSAGE_TYPES = Object.freeze({
  GET_ACTIVE_TAB_CONTEXT: 'GET_ACTIVE_TAB_CONTEXT',
  OPEN_BOOKMARK_FOLDER: 'OPEN_BOOKMARK_FOLDER',
  OPEN_URL: 'OPEN_URL',
  REFRESH_BADGE: 'REFRESH_BADGE',
  SYNC_REVIEW_REMINDER: 'SYNC_REVIEW_REMINDER',
  FETCH_URL_HEALTH: 'FETCH_URL_HEALTH',
  ABORT_URL_HEALTH: 'ABORT_URL_HEALTH'
});

export function getMessageType(request) {
  return request && typeof request.type === 'string' ? request.type : '';
}

export const runtimeMessages = Object.freeze({
  getActiveTabContext() {
    return { type: MESSAGE_TYPES.GET_ACTIVE_TAB_CONTEXT };
  },
  openBookmarkFolder(parentId) {
    return { type: MESSAGE_TYPES.OPEN_BOOKMARK_FOLDER, parentId: String(parentId || '') };
  },
  openUrl(url) {
    return { type: MESSAGE_TYPES.OPEN_URL, url: String(url || '') };
  },
  refreshBadge() {
    return { type: MESSAGE_TYPES.REFRESH_BADGE };
  },
  syncReviewReminder() {
    return { type: MESSAGE_TYPES.SYNC_REVIEW_REMINDER };
  },
  fetchUrlHealth({ url, timeoutMs, requestId }) {
    return {
      type: MESSAGE_TYPES.FETCH_URL_HEALTH,
      url: String(url || ''),
      timeoutMs: Number(timeoutMs || 0),
      requestId: String(requestId || '')
    };
  },
  abortUrlHealth(requestId) {
    return { type: MESSAGE_TYPES.ABORT_URL_HEALTH, requestId: String(requestId || '') };
  }
});
