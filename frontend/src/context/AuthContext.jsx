import { createContext, useContext, useState } from "react";

// Restore the session synchronously so a page refresh keeps the user logged in
// instead of flashing/redirecting to login on the very first render.
function getStoredSession() {
  try {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      return { token: storedToken, user: JSON.parse(storedUser) };
    }
  } catch (error) {
    console.error("Failed to restore session:", error);
  }
  return { token: null, user: null };
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(getStoredSession);
  const { token, user } = session;

  const login = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    setSession({ token, user });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setSession({ token: null, user: null });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook + provider pair
export const useAuth = () => {
  return useContext(AuthContext);
};