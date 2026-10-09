import Register from "../components/Auth/Register";

function RegisterPage({
  onLogin,
  onRegisterSuccess,
}) {
  return (
    <Register
      onLogin={onLogin}
      onRegisterSuccess={onRegisterSuccess}
    />
  );
}

export default RegisterPage;