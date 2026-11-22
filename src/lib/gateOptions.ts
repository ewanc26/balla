import type { QuoteAccess, ReplyAccess } from './interactionGates.ts';

/** One copy of the gate option copy, shared by the composer and both editors. */
export const REPLY_OPTIONS: Array<{ value: ReplyAccess; label: string; detail: string }> = [
  { value: 'everyone', label: 'Everyone', detail: 'Anyone on Bluesky can reply' },
  { value: 'mentioned', label: 'Mentioned accounts', detail: 'Only people named in the post' },
  { value: 'following', label: 'People you follow', detail: 'Anyone in your following list' },
  { value: 'followers', label: 'People who follow you', detail: 'Anyone following your account' },
  { value: 'list', label: 'People on a list', detail: 'Choose one of your lists' },
  { value: 'nobody', label: 'Nobody', detail: 'Close replies on this post' },
];

export const QUOTE_OPTIONS: Array<{ value: QuoteAccess; label: string; detail: string }> = [
  { value: 'everyone', label: 'Anyone', detail: 'This post can be quoted' },
  { value: 'nobody', label: 'Nobody', detail: 'Disable quotes of this post' },
];
