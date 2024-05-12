require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// server

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pbmq8lu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userDB = client.db("DishDashDB").collection("users");
        const galleryDB = client.db("DishDashDB").collection("gallery");
        const foodDB = client.db("DishDashDB").collection("foods");

        // users email and name service
        app.get("/users", async (req, res) => {
            const cursor = await userDB.find().toArray();
            res.send(cursor);
        });

        app.post("/users", async (req, res) => {
            const user = req.body;
            const result = await userDB.insertOne(user);
            res.send(result);
        });

        // gallery service
        app.get("/gallery", async (req, res) => {
            const cursor = await galleryDB.find().toArray();
            res.send(cursor);
        });

        app.post("/gallery", async (req, res) => {
            const data = req.body;
            const result = await galleryDB.insertOne(data);
            res.send(result);
        });

        // add food service
        app.get("/foods", async (req, res) => {
            const email = req.query.email;
            const search = req.query.search;
            const id = req.query.id;
            const totalPage = req.query.page;
            const activePage = req.query.activePage;
            const pageNo = req.query.pageNo;
            
            if (email) {
                // filter data using email
                const cursor = await foodDB.find({ email: email }).toArray();
                return res.send(cursor);
            } else if (search) {
                // search function
                const query = search.charAt().toUpperCase() + search.slice(1);
                const cursor = await foodDB
                    .find({
                        $or: [
                            { foodCategory: { $eq: query } },
                            { foodName: { $eq: query } },
                        ],
                    })
                    .toArray();
                return res.send(cursor);
            } else if (id) {
                // filter data using id
                const cursor = await foodDB
                    .find({ _id: new ObjectId(id) })
                    .toArray();
                res.send(cursor);
            } else if (totalPage) {
                // get total data length
                const cursor = await foodDB.find().toArray();
                console.log(cursor.length);
                const pages = cursor.length;
                return res.send({ pages });
            } else if (activePage) {
                // Pagination
                const cursor = await foodDB
                    .find()
                    .skip((pageNo - 1) * 10)
                    .limit(10)
                    .toArray();
                return res.send(cursor);
            } else {
                // get all food data
                const cursor = await foodDB.find().toArray();
                return res.send(cursor);
            }
        });

        app.post("/foods", async (req, res) => {
            const food = req.body;
            food.purchase = 0;
            const result = await foodDB.insertOne(food);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Server is running...");
});

app.listen(port, () => console.log(`Server is running on port: ${port}`));
