import mongoose from "mongoose";
import dns from "dns";

// Keep the local Windows workaround while letting cloud hosts use their own
// resolver for MongoDB Atlas SRV records.
if (process.platform === "win32") {
  dns.setServers(["8.8.8.8"]);
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
