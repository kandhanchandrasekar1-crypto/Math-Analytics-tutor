import { useState } from "react";
import Login from "./pages/Login/Login";
import Home  from "./pages/Home/Home";
import Profile from "./pages/Profile/Profile";

function App() {
  const token = localStorage.getItem("token");
  const [page, setPage] = useState("home"); // "home" | "profile"

  if (!token) return <Login />;

  return (
    <>
      {page === "home"    && <Home    onNavigate={setPage} />}
      {page === "profile" && <Profile onNavigate={setPage} />}
    </>
  );
}

export default App;
