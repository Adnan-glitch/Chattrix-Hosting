import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const submitHandler = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return alert("Passwords do not match");
    }

    setLoading(true);

    try {
      const { data } = await api.post("/auth/register", {
        firstName,
        lastName,
        email,
        password,
      });

      login(data);
      navigate("/chat");
    } catch (error) {
      alert(error.response?.data?.message || "Registration failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#020617] px-4">
      {/* Wrapper */}
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Main Title */}
        <h2 className="text-3xl font-bold text-center mb-8 text-white">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">
            Chattrix
          </span>
        </h2>

        {/* Register Card */}
        <div className="w-full bg-surface p-8 rounded-2xl shadow-xl">
          <h3 className="text-2xl font-bold text-white text-center mb-6">
            Create your account
          </h3>

          <form onSubmit={submitHandler} className="space-y-4">
            <input
              type="text"
              required
              placeholder="First Name"
              className="w-full p-3 text-white rounded-lg bg-bg border border-borderColor focus:outline-none focus:ring-2 focus:ring-primary transition"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <input
              type="text"
              required
              placeholder="Last Name"
              className="w-full p-3 rounded-lg bg-bg border border-borderColor focus:outline-none focus:ring-2 focus:ring-primary transition"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

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

            <input
              type="password"
              required
              placeholder="Confirm Password"
              className="w-full p-3 rounded-lg bg-bg border border-borderColor focus:outline-none focus:ring-2 focus:ring-primary transition"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>

          <p className="text-sm text-center mt-6 text-textMuted">
            Already have an account?{" "}
            <Link to="/" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
