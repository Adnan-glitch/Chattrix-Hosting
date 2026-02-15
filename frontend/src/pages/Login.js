import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
      });

      login(data);
      navigate("/chat");
    } catch (error) {
      alert(error.response?.data?.message || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#020617] px-4">
      
      {/* Wrapper to stack heading + card */}
      <div className="w-full max-w-md flex flex-col items-center">

        {/* Main App Title */}
        <h2 className="text-3xl font-bold text-center mb-8 text-white">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">
            Chattrix
          </span>
        </h2>

        {/* Login Card */}
        <div className="w-full bg-surface p-8 rounded-2xl shadow-xl">
          <h3 className="text-2xl font-bold text-white text-center mb-6">
            Let’s get you back in
          </h3>

          <form onSubmit={submitHandler} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Email"
              className="w-full p-3 rounded-lg bg-bg border border-borderColor focus:outline-none focus:ring-2 focus:ring-primary transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              required
              placeholder="Password"
              className="w-full p-3 rounded-lg bg-bg border border-borderColor focus:outline-none focus:ring-2 focus:ring-primary transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="text-sm text-center mt-6 text-textMuted">
            New user?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

export default Login;
