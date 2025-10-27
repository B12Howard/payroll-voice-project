import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider, ALLOWED_EMAILS } from './firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for redirect result
    getRedirectResult(auth).then((result) => {
      if (result) {
        // User just signed in via redirect
        console.log('Signed in via redirect:', result.user);
      }
    }).catch((error) => {
      console.error('Redirect error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if user's email is in the allowlist
        if (ALLOWED_EMAILS.includes(firebaseUser.email)) {
          setUser(firebaseUser);
          setError('');
        } else {
          // User signed in but not authorized
          setUser(null);
          setError('Access denied. Your email is not authorized.');
          await signOut(auth);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setError('');
      await signInWithRedirect(auth, googleProvider);
      // User will be redirected to Google, then back to the app
      // The redirect result will be handled in the useEffect
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
