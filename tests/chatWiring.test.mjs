import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const CONVO_METHODS = [
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
  'getConvoMembers',
  'lockConvo',
  'unlockConvo',
  'addReaction',
  'removeReaction',
  'deleteMessageForSelf',
  'updateAllRead',
];
const GROUP_METHODS = [
  'createGroup',
  'addMembers',
  'removeMembers',
  'editGroup',
  'createJoinLink',
  'editJoinLink',
  'enableJoinLink',
  'disableJoinLink',
  'listJoinRequests',
  'approveJoinRequest',
  'rejectJoinRequest',
  'updateJoinRequestsRead',
  'requestJoin',
  'withdrawJoinRequest',
  'getJoinLinkPreviews',
];
const NOTIFICATION_METHODS = ['getPreferences', 'putPreferences'];
const CHAT_METHODS = [...CONVO_METHODS, ...GROUP_METHODS, ...NOTIFICATION_METHODS];

test('metadata declares exactly the chat RPCs Balla calls, all on the chat audience', () => {
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  const chat = tokens.filter((token) => token.startsWith('rpc:chat.bsky.'));
  assert.equal(tokens.length, 112);
  assert.equal(chat.length, CHAT_METHODS.length);
  const audience = '?aud=did:web:api.bsky.chat#bsky_chat';
  for (const method of CONVO_METHODS) {
    assert.ok(chat.includes(`rpc:chat.bsky.convo.${method}${audience}`), method);
  }
  for (const method of GROUP_METHODS) {
    assert.ok(chat.includes(`rpc:chat.bsky.group.${method}${audience}`), method);
  }
  for (const method of NOTIFICATION_METHODS) {
    assert.ok(chat.includes(`rpc:chat.bsky.notification.${method}${audience}`), method);
  }
  assert.equal(tokens.some((token) => token.includes('include:chat.bsky')), false);
  assert.equal(tokens.some((token) => token.includes('rpc:chat.bsky.*')), false);
  assert.equal(tokens.some((token) => /chatAccount|chat:account/.test(token)), false);
});

test('share-via-chat sends the post as a record embed from the post menu', () => {
  const model = read('../src/lib/shareViaChatModel.ts');
  const sheet = read('../src/components/ShareViaChatSheet.tsx');
  const postMenu = read('../src/components/PostMenu.tsx');
  assert.match(model, /app\.bsky\.embed\.record/);
  assert.match(model, /chat\.bsky\.convo\.defs#messageInput/);
  assert.match(sheet, /getConvoForMembers/);
  assert.match(sheet, /sendMessage/);
  assert.match(sheet, /listConvos/);
  assert.match(sheet, /buildShareMessage/);
  assert.match(sheet, /recentConvos/);
  assert.match(postMenu, /ShareViaChatSheet/);
  assert.match(postMenu, /Send via direct message/);
  assert.match(postMenu, /canShareViaChat/);
  const tokens = JSON.parse(read('../oauth-client-metadata.json')).scope.split(/\s+/);
  assert.ok(tokens.includes('rpc:chat.bsky.convo.getConvoForMembers?aud=did:web:api.bsky.chat#bsky_chat'));
  assert.ok(tokens.includes('rpc:chat.bsky.convo.sendMessage?aud=did:web:api.bsky.chat#bsky_chat'));
});

test('the agent routes chat through the documented proxy helper', () => {
  const agent = read('../src/lib/agent.ts');
  const model = read('../src/lib/chatModel.ts');
  assert.match(agent, /export function getChatAgent\(\): Agent/);
  assert.match(agent, /candidate\.withProxy\(CHAT_SERVICE_TYPE, CHAT_SERVICE_DID\)/);
  assert.match(agent, /typeof candidate\.withProxy === 'function'/);
  assert.match(model, /CHAT_SERVICE_DID = SERVICE_HOSTS\.chatDid/);
  assert.match(model, /CHAT_SERVICE_TYPE = 'bsky_chat'/);
});

test('chat screens call the chat proxy, never log message content', () => {
  const inbox = read('../src/screens/ChatScreen.tsx');
  const convo = read('../src/screens/ConversationScreen.tsx');
  const settings = read('../src/screens/ChatSettingsScreen.tsx');
  const convoSettings = read('../src/screens/ConversationSettingsScreen.tsx');
  const joinGroup = read('../src/screens/JoinGroupScreen.tsx');
  const createGroup = read('../src/screens/CreateGroupScreen.tsx');
  const joinRequests = read('../src/screens/JoinRequestsScreen.tsx');
  const notifications = read('../src/screens/ChatNotificationSettingsScreen.tsx');
  for (const file of [
    inbox,
    convo,
    convoSettings,
    joinGroup,
    createGroup,
    joinRequests,
    notifications,
  ]) {
    assert.match(file, /getChatAgent\(\)/);
    assert.doesNotMatch(file, /console\.(log|debug|info)/);
  }
  assert.doesNotMatch(settings, /console\.(log|debug|info)/);
  assert.match(inbox, /listConvos\(/);
  assert.match(inbox, /listConvoRequests\(/);
  assert.match(inbox, /getUnreadCounts\(\{\s*includeGroupChats: true\s*\}\)|includeGroupChats: true/);
  assert.doesNotMatch(inbox, /getUnreadCounts\(\{\}\)/);
  assert.match(inbox, /updateAllRead\(/);
  assert.match(convo, /getMessages\(/);
  assert.match(convo, /sendMessage\(/);
  assert.match(convo, /updateRead\(/);
  assert.match(convo, /acceptConvo\(/);
  assert.match(convo, /muteConvo\(/);
  assert.match(convo, /unmuteConvo\(/);
  assert.match(convo, /leaveConvo\(/);
  assert.match(convo, /buildPostEmbed/);
  assert.match(convo, /buildReplyRef/);
  assert.match(convo, /groupReactions/);
  assert.match(convo, /MessageActionsSheet/);
  assert.match(convo, /GroupParticipantsSheet/);
  assert.match(convo, /getConvoMembers\(/);
  assert.match(convo, /participantCount\(/);
  assert.match(convo, /accessibilityLabel=\{`Group participants/);
  assert.match(convoSettings, /getConvoMembers\(/);
  assert.match(convoSettings, /editGroup\(/);
  assert.match(convoSettings, /removeMembers\(/);
  assert.match(convoSettings, /lockConvo\(/);
  assert.match(convoSettings, /unlockConvo\(/);
  assert.match(convoSettings, /canOwnerChangeLock/);
  assert.match(createGroup, /createGroup\(/);
  assert.match(joinGroup, /getJoinLinkPreviews\(/);
  assert.match(joinGroup, /requestJoin\(/);
  assert.match(joinGroup, /joinRequestCount\(preview\?\.convo\)/);
  assert.doesNotMatch(joinGroup, /joinRequestCount\(\{\s*kind:\s*preview\s*\}/);
  assert.match(joinRequests, /listJoinRequests\(/);
  assert.match(joinRequests, /approveJoinRequest\(/);
  assert.match(joinRequests, /rejectJoinRequest\(/);
  assert.match(notifications, /getPreferences\(/);
  assert.match(notifications, /putPreferences\(/);
  assert.match(settings, /CHAT_AUDIENCE/);
  assert.match(settings, /openExternalUrl/);
});

test('a host without chat degrades to an honest Messages state', () => {
  const inbox = read('../src/screens/ChatScreen.tsx');
  const serviceModel = read('../src/lib/chatServiceModel.ts');
  const serviceRuntime = read('../src/lib/chatService.ts');
  const serviceScreen = read('../src/screens/ChatServiceScreen.tsx');

  // The inbox classifies the real list failure and shows one explanatory state.
  assert.match(inbox, /chatServiceStateFromError\(err\)/);
  assert.match(inbox, /isServiceWideFailure\(state\)/);
  assert.match(inbox, /Messages aren’t available here/);
  assert.match(inbox, /chatServiceCopy\(serviceState\)/);
  assert.match(inbox, /openExternalUrl\(CHAT_SERVICE_DOCS_URL\)/);
  assert.match(inbox, /setServiceState\(null\)/);
  // No fake compose controls survive when the service is unavailable.
  const blockStart = inbox.indexOf('if (serviceState && isServiceWideFailure');
  const blockEnd = inbox.indexOf('  return (\n    <FlatList', blockStart);
  const unavailable = inbox.slice(blockStart, blockEnd);
  const healthy = inbox.slice(blockEnd);
  assert.match(unavailable, /Check again/);
  assert.doesNotMatch(unavailable, /New group/);
  assert.doesNotMatch(unavailable, /sendMessage\(/);
  assert.match(healthy, /New group/);

  // The probe makes one real proxy read and never reads message text.
  assert.match(serviceRuntime, /getChatAgent\(\)\.chat\.bsky\.convo\.listConvos\(\{ limit: 1 \}\)/);
  assert.match(serviceRuntime, /chatServiceStateFromError\(err\)/);
  assert.doesNotMatch(serviceRuntime, /console\.|AsyncStorage|lastMessage/);
  assert.match(serviceModel, /CHAT_SERVICE_DOCS_URL/);
  assert.match(serviceModel, /message text is/i);

  // Advanced → Chat reports real facts; it does not fake an endpoint override.
  assert.match(serviceScreen, /checkChatService\(\)/);
  assert.match(serviceScreen, /chatServiceCopy\(state\)/);
  assert.match(serviceScreen, /CHAT_AUDIENCE/);
  assert.match(serviceScreen, /CHAT_SERVICE_DID/);
  assert.match(serviceScreen, /openExternalUrl\(CHAT_SERVICE_DOCS_URL\)/);
  assert.match(serviceScreen, /Balla does not show an override that cannot work/);
  assert.doesNotMatch(serviceScreen, /onPress=\{\(\) => \{\}\}/);
  assert.doesNotMatch(serviceScreen, /console\.(log|debug|info)/);
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
  assert.match(linking, /ChatService: 'settings\/advanced\/chat'/);
  assert.match(linking, /ChatNotificationSettings: 'messages\/settings\/notifications'/);
  assert.match(linking, /CreateGroup: 'messages\/new-group'/);
  assert.match(linking, /JoinGroup: 'messages\/join'/);
  assert.match(linking, /JoinRequests: 'messages\/:convoId\/requests'/);
  assert.match(linking, /ConversationSettings: 'messages\/:convoId\/settings'/);
});

test('web linking gives every Stack screen a path', () => {
  const app = read('../App.tsx');
  const linking = read('../src/lib/webLinking.ts');
  const names = [...app.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((match) => match[1]);
  for (const name of names) {
    assert.match(linking, new RegExp(`\\b${name}:`), `${name} has a web path`);
  }
});

test('chat report subjects carry ids only, never message text', () => {
  const moderation = read('../src/lib/moderation.ts');
  const model = read('../src/lib/chatGroupModel.ts');
  assert.match(model, /chat\.bsky\.convo\.defs#messageRef/);
  assert.match(model, /chat\.bsky\.convo\.defs#convoRef/);
  assert.match(moderation, /reportChatMessage/);
  assert.match(moderation, /reportChatConversation/);
  assert.match(moderation, /buildMessageReportSubject/);
  assert.match(moderation, /buildConvoReportSubject/);
  const reportSection = model.slice(
    model.indexOf('export function buildMessageReportSubject'),
    model.indexOf('/** A message action is only available')
  );
  assert.doesNotMatch(reportSection, /message\.text|item\.text/);
  assert.doesNotMatch(model, /console\.|AsyncStorage/);
});

test('message text actions copy exact text and translate to the primary language', () => {
  const sheet = read('../src/components/MessageActionsSheet.tsx');
  const model = read('../src/lib/chatGroupModel.ts');
  assert.match(model, /export function messageTextForAction/);
  assert.match(sheet, /messageTextForAction\(message\)/);
  assert.match(sheet, /Clipboard\.setStringAsync\(messageText\)/);
  assert.match(sheet, /accessibilityLabel="Copy message text"/);
  assert.match(sheet, />Copy message text<\/Text>/);
  assert.match(sheet, /accessibilityLabel="Translate message text"/);
  assert.match(sheet, /translateText\(messageText, preferences\.primaryLanguage\)/);
  assert.match(sheet, /'Show the original message'/);
  assert.match(sheet, /'Show the translation'/);
  assert.match(sheet, /messageText \? \(/);
  assert.doesNotMatch(sheet, /console\.(log|info|debug)/);
  assert.doesNotMatch(sheet, /AsyncStorage/);
});

test('self-delete uses the conversation id from the route, not the message', () => {
  const sheet = read('../src/components/MessageActionsSheet.tsx');
  const call = sheet.match(
    /deleteMessageForSelf\(\{[\s\S]{0,160}?\}\)/
  );
  assert.ok(call, 'deleteMessageForSelf call is present');
  assert.match(call[0], /convoId: \(convoId \|\| ''\)\.trim\(\)/);
  assert.doesNotMatch(call[0], /message\?\.convoId/);
});
