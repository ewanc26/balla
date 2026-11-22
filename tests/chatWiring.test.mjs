import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const CHAT_METHODS = [
  'listConvos',
  'listConvoRequests',
  'getUnreadCounts',
  'getConvo',
  'getConvoForMembers',
  'getMessages',
  'sendMessage',
  'updateRead',
  'acceptConvo',
  'muteConvo',
  'unmuteConvo',
  'leaveConvo',
];

test('metadata declares exactly the chat RPCs Balla calls, all on the chat audience', () => {
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  const chat = tokens.filter((token) => token.startsWith('rpc:chat.bsky.'));
  assert.equal(chat.length, CHAT_METHODS.length);
  const audience = '?aud=did:web:api.bsky.chat#bsky_chat';
  for (const method of CHAT_METHODS) {
    assert.ok(chat.includes(`rpc:chat.bsky.convo.${method}${audience}`), method);
  }
  assert.equal(tokens.some((token) => token.includes('include:chat.bsky')), false);
  assert.equal(tokens.some((token) => token.includes('rpc:chat.bsky.*')), false);
});

test('the agent routes chat through the documented proxy helper', () => {
  const agent = read('../src/lib/agent.ts');
  const model = read('../src/lib/chatModel.ts');
  assert.match(agent, /export function getChatAgent\(\): Agent/);
  assert.match(agent, /candidate\.withProxy\(CHAT_SERVICE_TYPE, CHAT_SERVICE_DID\)/);
  assert.match(agent, /typeof candidate\.withProxy === 'function'/);
  assert.match(model, /CHAT_SERVICE_DID = 'did:web:api\.bsky\.chat'/);
  assert.match(model, /CHAT_SERVICE_TYPE = 'bsky_chat'/);
});

test('chat screens call the chat proxy, never log message content', () => {
  const inbox = read('../src/screens/ChatScreen.tsx');
  const convo = read('../src/screens/ConversationScreen.tsx');
  const settings = read('../src/screens/ChatSettingsScreen.tsx');
  for (const file of [inbox, convo]) {
    assert.match(file, /getChatAgent\(\)/);
    assert.doesNotMatch(file, /console\.(log|debug|info)/);
  }
  assert.match(inbox, /listConvos\(/);
  assert.match(inbox, /listConvoRequests\(/);
  assert.match(inbox, /getUnreadCounts\(/);
  assert.match(convo, /getMessages\(/);
  assert.match(convo, /sendMessage\(/);
  assert.match(convo, /updateRead\(/);
  assert.match(convo, /acceptConvo\(/);
  assert.match(convo, /muteConvo\(/);
  assert.match(convo, /unmuteConvo\(/);
  assert.match(convo, /leaveConvo\(/);
  assert.match(convo, /buildPostEmbed/);
  assert.match(settings, /CHAT_AUDIENCE/);
  assert.match(settings, /Linking\.openURL/);
});

test('chat has navigation entry points and explicit web paths', () => {
  const app = read('../App.tsx');
  const header = read('../src/components/AppHeader.tsx');
  const rail = read('../src/components/AppRail.tsx');
  const linking = read('../src/lib/webLinking.ts');
  assert.match(app, /<Stack\.Screen name="Chat" component=\{ChatScreen\} \/>/);
  assert.match(app, /<Stack\.Screen name="Conversation" component=\{ConversationScreen\} \/>/);
  assert.match(app, /name="ChatSettings"[\s\S]{0,120}component=\{ChatSettingsScreen\}/);
  assert.match(app, /onOpenMessages=\{openMessages\}/);
  assert.match(app, /navigationRef\.navigate\('Chat'\)/);
  assert.match(header, /accessibilityLabel="Messages"/);
  assert.match(rail, /accessibilityLabel="Messages"/);
  assert.match(linking, /Chat: 'messages'/);
  assert.match(linking, /Conversation: 'messages\/:convoId'/);
  assert.match(linking, /ChatSettings: 'messages\/settings'/);
});

test('web linking gives every Stack screen a path', () => {
  const app = read('../App.tsx');
  const linking = read('../src/lib/webLinking.ts');
  const names = [...app.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((match) => match[1]);
  for (const name of names) {
    assert.match(linking, new RegExp(`\\b${name}:`), `${name} has a web path`);
  }
});
