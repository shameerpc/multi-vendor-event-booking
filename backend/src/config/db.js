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
      console.error("-> Hint: Ensure local MongoDB service is running (net start MongoDB) or update MONGO_URI in .env to use MongoDB Atlas cloud URI.");
    }
    process.exit(1);
  }
};

module.exports = connectDB;