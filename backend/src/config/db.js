const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    if (error.message.includes("ECONNREFUSED")) {
      console.error("-> Hint: Ensure local MongoDB service is running (e.g. net start MongoDB or mongod) or update MONGO_URI in .env.");
    } else if (error.message.includes("IP that isn't whitelisted") || error.message.includes("Could not connect to any servers")) {
      console.error("-> Hint: Your IP address is not whitelisted in MongoDB Atlas. Go to Network Access in Atlas dashboard and add 0.0.0.0/0 (or your current IP).");
    }
    process.exit(1);
  }
};

module.exports = connectDB;