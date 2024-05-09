require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// server
app.get("/", (req, res) => {
    res.send("Server is running...");
});

app.listen(port, () => console.log(`Server is running on port: ${port}`));
