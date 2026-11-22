import React, { useLayoutEffect } from 'react';
import { LoginScreen } from './LoginScreen';

/**
 * Sign-in stays in one place: this wraps the existing login form inside the
 * signed-in stack. Finishing a new sign-in switches the active account, which
 * rebuilds the app shell, so no extra navigation is needed here.
 */
export function AddAccountScreen({ navigation }: { navigation: any }) {
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Add an account' });
  }, [navigation]);

  return (
    <LoginScreen
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
