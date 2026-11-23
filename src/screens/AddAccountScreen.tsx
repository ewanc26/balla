import React, { useLayoutEffect } from 'react';
import { LoginScreen } from './LoginScreen';

/**
 * Sign-in stays in one place: this wraps the existing login form inside the
 * signed-in stack. Finishing a new sign-in switches the active account, which
 * rebuilds the app shell, so no extra navigation is needed here. A PDS
 * directory selection arrives as the identifier, so the OAuth resolver treats
 * it as a service URL while the person can still edit it to a full handle.
 */
export function AddAccountScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Add an account' });
  }, [navigation]);

  const initialIdentifier =
    typeof route?.params?.identifier === 'string' ? route.params.identifier : '';

  return (
    <LoginScreen
      initialIdentifier={initialIdentifier}
      onLoggedIn={() => {
        try {
          if (navigation.isFocused()) navigation.goBack();
        } catch {
          // The active-account change already rebuilt the shell.
        }
      }}
    />
  );
}
