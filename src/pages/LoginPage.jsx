import Login from "../components/Auth/Login";

function LoginPage({ onRegister, onLoginSuccess, isIntroRevealing = false }) {
  return (
    <Login
      onRegister={onRegister}
      onLoginSuccess={onLoginSuccess}
      isIntroRevealing={isIntroRevealing}
    />
  );
}

export default LoginPage;
